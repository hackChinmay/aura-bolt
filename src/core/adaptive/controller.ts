// AURA-BOLT Burst-Aware Adaptive Controller & Recovery-Cost Optimizer

import { ControllerDecision, ExperimentConfig, ProtocolType } from '../types';
import { BurstStatistics, RttEstimate } from './burstDetector';

export class AuraBoltAdaptiveController {
  private decisionHistory: ControllerDecision[] = [];
  private lastEvaluationTimeMs: number = 0;
  private minIntervalBetweenDecisionsMs: number = 300; // Decision boundary interval
  private consecutiveFallbacks: number = 0;
  private pendingVerificationDecision: ControllerDecision | null = null;

  constructor(private config: ExperimentConfig) {}

  // Run the 8-Step Closed-Loop: OBSERVE -> PREDICT -> SELECT -> APPLY -> MEASURE -> VERIFY -> UPDATE -> FALLBACK
  evaluate(
    simTimeMs: number,
    currentProtocol: ProtocolType,
    currentWindow: number,
    currentRto: number,
    rttData: RttEstimate,
    burstStats: BurstStatistics,
    receiverBufferOccupancy: number,
    windowUtilization: number,
    measuredGoodputKbps: number
  ): {
    decisionMade: boolean;
    decision?: ControllerDecision;
    newWindow: number;
    newRto: number;
    mode: 'OPTIMAL' | 'CONSERVATIVE_RECOVERY' | 'PROBING' | 'FALLBACK';
  } {
    // Check if enough time has passed to observe steady-state impact of previous change
    if (simTimeMs - this.lastEvaluationTimeMs < this.minIntervalBetweenDecisionsMs) {
      return {
        decisionMade: false,
        newWindow: currentWindow,
        newRto: currentRto,
        mode: 'OPTIMAL',
      };
    }

    // STEP 6: VERIFY previous decision if pending
    if (this.pendingVerificationDecision) {
      this.pendingVerificationDecision.observedGoodputKbps = measuredGoodputKbps;
      const predicted = this.pendingVerificationDecision.candidates.find(
        c => c.windowSize === this.pendingVerificationDecision?.selectedWindow
      )?.predictedGoodputKbps || measuredGoodputKbps;

      const error = Math.abs(predicted - measuredGoodputKbps);
      this.pendingVerificationDecision.predictionError = Math.round(error * 10) / 10;

      // STEP 7: UPDATE status
      if (measuredGoodputKbps < predicted * 0.45 && this.pendingVerificationDecision.selectedWindow > currentWindow) {
        // Severe underperformance: trigger safe fallback
        this.pendingVerificationDecision.status = 'REVERTED';
        this.consecutiveFallbacks++;
      } else {
        this.pendingVerificationDecision.status = 'VERIFIED';
        this.consecutiveFallbacks = 0;
      }
      this.pendingVerificationDecision = null;
    }

    this.lastEvaluationTimeMs = simTimeMs;

    // STEP 1: OBSERVE current metrics
    const srtt = rttData.srtt;
    const rttvar = rttData.rttvar;
    const recentLoss = burstStats.recentLossRate;
    const isBadChannel = this.config.enableBurstAwareness
      ? burstStats.channelStateEstimate === 'BAD' || burstStats.consecutiveLosses >= 2
      : recentLoss > 0.15; // If ablation disabled, ignore burst clustering

    const bdp = burstStats.bdpFrames;
    const maxWindowLimit = Math.min(
      this.config.maxWindowSize,
      this.config.receiverBufferSize,
      Math.floor(this.config.seqNumberModulus / 2) // Safety invariant W <= M/2
    );

    // STEP 2: PREDICT - Evaluate candidate window sizes
    const candidateWindowSizes = [
      1,
      2,
      4,
      Math.max(1, Math.floor(currentWindow / 2)),
      currentWindow,
      Math.min(maxWindowLimit, currentWindow + 2),
      Math.min(maxWindowLimit, Math.max(1, bdp)),
      maxWindowLimit,
    ];
    const uniqueCandidates = Array.from(new Set(candidateWindowSizes)).sort((a, b) => a - b);

    // Weights J(c) = alpha*Goodput - beta*Latency - gamma*Retrans - delta*Buffer
    const { alpha, beta, gamma, delta } = this.config;

    const scoredCandidates = uniqueCandidates.map(w => {
      // Check physical feasibility
      let isFeasible = true;
      let rejectionReason: string | undefined;

      if (w > this.config.receiverBufferSize) {
        isFeasible = false;
        rejectionReason = `Window ${w} exceeds receiver buffer capacity ${this.config.receiverBufferSize}`;
      } else if (w > Math.floor(this.config.seqNumberModulus / 2)) {
        isFeasible = false;
        rejectionReason = `Window ${w} violates sequence modulus safety W <= M/2 (${this.config.seqNumberModulus / 2})`;
      }

      // Predicted Goodput model (Kbps)
      // Base link capacity * min(1, w / BDP) * (1 - lossImpact)
      const bdpNorm = Math.max(1, bdp);
      const pipeOccupancyRatio = Math.min(1.0, w / bdpNorm);
      
      // Burst loss penalty: in GBN, 1 loss causes w retransmissions; in SR/AURA-BOLT, loss causes single retransmission
      const burstPenaltyFactor = (this.config.enableBurstAwareness && isBadChannel)
        ? (1.0 + burstStats.meanBurstLength * 0.4)
        : 1.0;

      const effectiveLossImpact = Math.min(0.9, recentLoss * burstPenaltyFactor);
      const predictedGoodput = Math.max(
        10,
        burstStats.estimatedBandwidthKbps * pipeOccupancyRatio * (1 - effectiveLossImpact)
      );

      // Predicted Latency model (ms)
      // Base RTT + queuing delay proportional to window exceeding BDP + loss recovery time
      const queuingDelay = Math.max(0, (w - bdpNorm) * 8);
      const recoveryLatency = effectiveLossImpact * (srtt + 2 * rttvar);
      const predictedP95Latency = srtt + queuingDelay + recoveryLatency;

      // Predicted Retransmission Cost (expected retransmitted frames per RTT)
      const predictedRetransCost = w * effectiveLossImpact;

      // Predicted Buffer Occupancy
      const predictedBufferUsage = Math.min(this.config.receiverBufferSize, Math.round(w * (0.3 + effectiveLossImpact * 0.7)));

      // Normalized Multi-Objective Utility Function
      const normGoodput = predictedGoodput / Math.max(1, burstStats.estimatedBandwidthKbps); // 0 to 1
      const normLatency = Math.min(1.0, predictedP95Latency / Math.max(10, srtt * 3));       // 0 to 1
      const normRetrans = Math.min(1.0, predictedRetransCost / Math.max(1, w));              // 0 to 1
      const normBuffer = predictedBufferUsage / Math.max(1, this.config.receiverBufferSize); // 0 to 1

      const objectiveScore = isFeasible
        ? (alpha * normGoodput) - (beta * normLatency) - (gamma * normRetrans) - (delta * normBuffer)
        : -999;

      return {
        windowSize: w,
        protocol: currentProtocol,
        predictedGoodputKbps: Math.round(predictedGoodput),
        predictedP95LatencyMs: Math.round(predictedP95Latency),
        predictedRetransCost: Math.round(predictedRetransCost * 10) / 10,
        predictedBufferUsage,
        objectiveScore: Math.round(objectiveScore * 1000) / 1000,
        isFeasible,
        rejectionReason,
      };
    });

    // STEP 3: SELECT highest objective score among feasible candidates
    const feasibleScored = scoredCandidates.filter(c => c.isFeasible);
    feasibleScored.sort((a, b) => b.objectiveScore - a.objectiveScore);

    let selectedWindow = currentWindow;
    let mode: 'OPTIMAL' | 'CONSERVATIVE_RECOVERY' | 'PROBING' | 'FALLBACK' = 'OPTIMAL';
    let reason = '';
    let expectedOutcome = '';

    // STEP 8: FALLBACK check
    if (this.consecutiveFallbacks >= 2) {
      mode = 'FALLBACK';
      selectedWindow = Math.max(1, Math.floor(currentWindow / 2));
      reason = 'Consecutive prediction verification failures. Reverting to safe conservative window.';
      expectedOutcome = 'Stabilize channel and reduce retransmission pressure.';
    } else if (isBadChannel && burstStats.consecutiveLosses >= 2) {
      // Conservative Recovery mode under burst loss
      mode = 'CONSERVATIVE_RECOVERY';
      selectedWindow = Math.max(1, Math.min(4, Math.floor(currentWindow / 2)));
      reason = this.config.enableBurstAwareness
        ? `Gilbert-Elliott burst loss detected (${burstStats.consecutiveLosses} consecutive losses, BAD state). Shrinking window to limit in-flight drops.`
        : `High packet loss rate observed (${Math.round(recentLoss * 100)}%). Reducing window.`;
      expectedOutcome = 'Minimize packet drops during active correlated fade.';
    } else if (feasibleScored.length > 0) {
      const best = feasibleScored[0];
      selectedWindow = best.windowSize;

      if (selectedWindow > currentWindow) {
        mode = 'PROBING';
        reason = `Channel is in GOOD state with low loss (${Math.round(recentLoss * 100)}%) and available BDP (${bdp} frames). Increasing sending window from ${currentWindow} to ${selectedWindow}.`;
        expectedOutcome = `Improve pipe utilization and useful throughput toward ${best.predictedGoodputKbps} Kbps.`;
      } else if (selectedWindow < currentWindow) {
        mode = 'CONSERVATIVE_RECOVERY';
        reason = `High retransmission cost or buffer pressure detected. Objective optimizer selected smaller window ${selectedWindow} over ${currentWindow}.`;
        expectedOutcome = `Lower P95 latency toward ${best.predictedP95LatencyMs} ms and curtail duplicate transmissions.`;
      } else {
        mode = 'OPTIMAL';
        reason = `Current window size ${currentWindow} achieves optimal balance across Goodput, P95 latency, and buffer occupancy.`;
        expectedOutcome = 'Maintain high-efficiency steady state.';
      }
    }

    // Adaptive RTO computation (RFC 6298 Jacobson-Karels)
    const selectedRto = rttData.rto;

    // STEP 4: APPLY - Build Decision Record
    const decision: ControllerDecision = {
      id: `dec-${Date.now()}-${this.decisionHistory.length + 1}`,
      timestamp: simTimeMs,
      step: mode === 'FALLBACK' ? 'FALLBACK' : 'APPLY',
      currentProtocol,
      selectedProtocol: currentProtocol,
      previousWindow: currentWindow,
      selectedWindow,
      previousRto: currentRto,
      selectedRto,
      mode,
      inputs: {
        srtt: Math.round(srtt),
        rttvar: Math.round(rttvar),
        recentLossRate: Math.round(recentLoss * 1000) / 1000,
        burstProbability: burstStats.pGoodToBad,
        channelState: burstStats.channelStateEstimate,
        receiverBufferOccupancy,
        windowUtilization: Math.round(windowUtilization * 100) / 100,
        measuredGoodputKbps: Math.round(measuredGoodputKbps),
        bdpFrames: bdp,
      },
      candidates: scoredCandidates,
      reason,
      expectedOutcome,
      status: 'AWAITING_VERIFICATION',
    };

    this.pendingVerificationDecision = decision;
    this.decisionHistory.push(decision);

    return {
      decisionMade: true,
      decision,
      newWindow: selectedWindow,
      newRto: selectedRto,
      mode,
    };
  }

  getDecisionHistory(): ControllerDecision[] {
    return [...this.decisionHistory];
  }
}
