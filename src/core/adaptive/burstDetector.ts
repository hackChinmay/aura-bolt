// Burst Loss Detector and Jacobson-Karels RTT/RTO Estimator

export interface RttEstimate {
  srtt: number;      // Smoothed RTT (ms)
  rttvar: number;    // RTT variance (ms)
  rto: number;       // Retransmission Timeout (ms)
  minRtt: number;
  maxRtt: number;
  sampleCount: number;
}

export interface BurstStatistics {
  channelStateEstimate: 'GOOD' | 'BAD';
  recentLossRate: number;
  meanBurstLength: number;
  maxBurstObserved: number;
  burstsCount: number;
  pGoodToBad: number; // Transition estimate
  pBadToBad: number;
  consecutiveLosses: number;
  bdpFrames: number;
  estimatedBandwidthKbps: number;
}

export class BurstDetectorAndRttEstimator {
  // Jacobson-Karels RTT estimator parameters (RFC 6298)
  private alpha: number = 0.125;
  private beta: number = 0.25;
  private minRto: number = 40;
  private maxRto: number = 3000;

  public srtt: number;
  public rttvar: number;
  public rto: number;
  private minRtt: number = Infinity;
  private maxRtt: number = 0;
  private sampleCount: number = 0;

  // Loss and burst tracking
  private outcomeHistory: Array<{ simTimeMs: number; isSuccess: boolean }> = [];
  private historyCapacity: number = 40;
  private currentRunLength: number = 0;
  private currentRunIsLoss: boolean = false;
  private observedBurstLengths: number[] = [];
  private consecutiveLosses: number = 0;

  // Bandwidth tracking
  private totalPayloadBytesReceived: number = 0;
  private firstByteTimeMs: number | null = null;
  private lastByteTimeMs: number = 0;

  constructor(initialRttMs: number = 100, initialRtoMs: number = 300) {
    this.srtt = initialRttMs;
    this.rttvar = initialRttMs / 2;
    this.rto = Math.max(this.minRto, Math.min(this.maxRto, initialRtoMs));
  }

  // Update RTT sample (Karn's algorithm: caller must only pass non-retransmitted samples)
  recordRttSample(sampleMs: number) {
    if (sampleMs <= 0) return;
    this.sampleCount++;
    this.minRtt = Math.min(this.minRtt, sampleMs);
    this.maxRtt = Math.max(this.maxRtt, sampleMs);

    if (this.sampleCount === 1) {
      this.srtt = sampleMs;
      this.rttvar = sampleMs / 2;
    } else {
      const diff = Math.abs(this.srtt - sampleMs);
      this.rttvar = (1 - this.beta) * this.rttvar + this.beta * diff;
      this.srtt = (1 - this.alpha) * this.srtt + this.alpha * sampleMs;
    }

    // RFC 6298: RTO = SRTT + max(G, 4 * RTTVAR)
    const rawRto = this.srtt + 4 * this.rttvar;
    this.rto = Math.max(this.minRto, Math.min(this.maxRto, Math.round(rawRto)));
  }

  // Double RTO on timeout (Exponential backoff for safety)
  onTimeoutBackoff() {
    this.rto = Math.min(this.maxRto, this.rto * 1.5);
  }

  // Record outcome of frame transmission (1 = ACKed, 0 = Lost/Timed out)
  recordTransmissionOutcome(simTimeMs: number, isSuccess: boolean) {
    this.outcomeHistory.push({ simTimeMs, isSuccess });
    if (this.outcomeHistory.length > this.historyCapacity) {
      this.outcomeHistory.shift();
    }

    if (!isSuccess) {
      this.consecutiveLosses++;
      if (this.currentRunIsLoss) {
        this.currentRunLength++;
      } else {
        this.currentRunIsLoss = true;
        this.currentRunLength = 1;
      }
    } else {
      this.consecutiveLosses = 0;
      if (this.currentRunIsLoss) {
        this.observedBurstLengths.push(this.currentRunLength);
        this.currentRunIsLoss = false;
        this.currentRunLength = 0;
      }
    }
  }

  recordDeliveredBytes(bytes: number, simTimeMs: number) {
    this.totalPayloadBytesReceived += bytes;
    if (this.firstByteTimeMs === null) {
      this.firstByteTimeMs = simTimeMs;
    }
    this.lastByteTimeMs = simTimeMs;
  }

  getRttEstimates(): RttEstimate {
    return {
      srtt: Math.round(this.srtt * 10) / 10,
      rttvar: Math.round(this.rttvar * 10) / 10,
      rto: Math.round(this.rto),
      minRtt: this.minRtt === Infinity ? 0 : Math.round(this.minRtt),
      maxRtt: Math.round(this.maxRtt),
      sampleCount: this.sampleCount,
    };
  }

  getBurstStatistics(payloadSizeBytes: number = 1024): BurstStatistics {
    const totalSamples = this.outcomeHistory.length;
    const losses = this.outcomeHistory.filter(o => !o.isSuccess).length;
    const recentLossRate = totalSamples > 0 ? losses / totalSamples : 0;

    // Estimate Gilbert-Elliott state: if 2+ consecutive losses or recent loss > 25%, BAD state
    const channelStateEstimate: 'GOOD' | 'BAD' =
      this.consecutiveLosses >= 2 || recentLossRate > 0.25 ? 'BAD' : 'GOOD';

    // Estimate empirical burst statistics
    const allBursts = [...this.observedBurstLengths];
    if (this.currentRunIsLoss && this.currentRunLength > 0) {
      allBursts.push(this.currentRunLength);
    }

    const meanBurstLength = allBursts.length > 0
      ? allBursts.reduce((a, b) => a + b, 0) / allBursts.length
      : 1;

    const maxBurstObserved = allBursts.length > 0
      ? Math.max(...allBursts)
      : 0;

    // Estimate P(G -> B) and P(B -> B)
    let g2bTransitions = 0;
    let goodStates = 0;
    let b2bTransitions = 0;
    let badStates = 0;

    for (let i = 0; i < this.outcomeHistory.length - 1; i++) {
      const curr = this.outcomeHistory[i].isSuccess;
      const next = this.outcomeHistory[i + 1].isSuccess;
      if (curr) {
        goodStates++;
        if (!next) g2bTransitions++;
      } else {
        badStates++;
        if (!next) b2bTransitions++;
      }
    }

    const pGoodToBad = goodStates > 0 ? g2bTransitions / goodStates : 0.05;
    const pBadToBad = badStates > 0 ? b2bTransitions / badStates : 0.70;

    // Estimate Bandwidth & BDP
    let estimatedBandwidthKbps = 1000; // default 1 Mbps
    if (this.firstByteTimeMs !== null && this.lastByteTimeMs > this.firstByteTimeMs) {
      const elapsedSec = (this.lastByteTimeMs - this.firstByteTimeMs) / 1000;
      estimatedBandwidthKbps = Math.max(100, Math.round((this.totalPayloadBytesReceived * 8) / (elapsedSec * 1000)));
    }

    // BDP in frames = (Bandwidth_bps * RTT_sec) / (PayloadBytes * 8)
    const rttSec = this.srtt / 1000;
    const bdpBits = (estimatedBandwidthKbps * 1000) * rttSec;
    const bdpFrames = Math.max(1, Math.round(bdpBits / (payloadSizeBytes * 8)));

    return {
      channelStateEstimate,
      recentLossRate: Math.round(recentLossRate * 1000) / 1000,
      meanBurstLength: Math.round(meanBurstLength * 10) / 10,
      maxBurstObserved,
      burstsCount: allBursts.length,
      pGoodToBad: Math.round(pGoodToBad * 100) / 100,
      pBadToBad: Math.round(pBadToBad * 100) / 100,
      consecutiveLosses: this.consecutiveLosses,
      bdpFrames,
      estimatedBandwidthKbps,
    };
  }
}
