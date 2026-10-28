// Deterministic Impairment Channel with Gilbert-Elliott Burst Loss Model

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed ? Math.abs(seed) % 2147483647 : 1337;
    if (this.state === 0) this.state = 1337;
  }

  // Linear congruential generator (Park-Miller LCG)
  nextFloat(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }

  // Normal distribution via Box-Muller transform for jitter
  nextGaussian(mean: number, stdDev: number): number {
    let u1 = this.nextFloat();
    let u2 = this.nextFloat();
    while (u1 === 0) u1 = this.nextFloat();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}

export type GilbertElliottState = 'GOOD' | 'BAD';

export class ImpairmentEngine {
  private rng: SeededRandom;
  private channelState: GilbertElliottState = 'GOOD';
  private consecutiveLosses: number = 0;
  private totalDataPacketsProcessed: number = 0;
  private totalDataPacketsDropped: number = 0;
  private totalAcksProcessed: number = 0;
  private totalAcksDropped: number = 0;

  constructor(
    private seed: number,
    private config: {
      oneWayDelayMs: number;
      jitterMs: number;
      packetLossRate: number;
      ackLossRate: number;
      lossPattern: 'random' | 'burst' | 'alternating' | 'sudden_degradation' | 'recovery';
      burstProbabilityGoodToBad: number; // P(G -> B)
      burstProbabilityBadToBad: number;   // P(B -> B)
    }
  ) {
    this.rng = new SeededRandom(seed);
  }

  getChannelState(): GilbertElliottState {
    return this.channelState;
  }

  // Advance Gilbert-Elliott Markov chain for next packet
  private advanceMarkovState(currentSimulationTimeMs: number) {
    // Dynamic pattern modifiers
    let pG2B = this.config.burstProbabilityGoodToBad;
    let pB2B = this.config.burstProbabilityBadToBad;

    if (this.config.lossPattern === 'sudden_degradation') {
      // Simulate degradation mid-way through (e.g. after 1500ms or 20 packets)
      if (currentSimulationTimeMs > 1200 && currentSimulationTimeMs < 3500) {
        pG2B = 0.35;
        pB2B = 0.85;
      }
    } else if (this.config.lossPattern === 'recovery') {
      // Degraded early, recovers after 1800ms
      if (currentSimulationTimeMs < 1800) {
        pG2B = 0.40;
        pB2B = 0.80;
      } else {
        pG2B = 0.02;
        pB2B = 0.20;
      }
    }

    if (this.channelState === 'GOOD') {
      if (this.rng.nextFloat() < pG2B) {
        this.channelState = 'BAD';
      }
    } else {
      if (this.rng.nextFloat() >= pB2B) {
        this.channelState = 'GOOD';
      }
    }
  }

  // Evaluate if outgoing data packet is dropped
  shouldDropDataPacket(simTimeMs: number): { drop: boolean; reason?: string } {
    this.totalDataPacketsProcessed++;
    this.advanceMarkovState(simTimeMs);

    if (this.config.lossPattern === 'random') {
      const drop = this.rng.nextFloat() < this.config.packetLossRate;
      if (drop) {
        this.totalDataPacketsDropped++;
        this.consecutiveLosses++;
        return { drop: true, reason: 'Independent random Bernoulli loss' };
      }
      this.consecutiveLosses = 0;
      return { drop: false };
    }

    if (this.config.lossPattern === 'alternating') {
      const drop = (this.totalDataPacketsProcessed % 3) === 0;
      if (drop) {
        this.totalDataPacketsDropped++;
        return { drop: true, reason: 'Deterministic alternating channel fade' };
      }
      return { drop: false };
    }

    // Burst loss using Gilbert-Elliott model
    // In BAD state, loss probability is high (~80-95%); in GOOD state, background loss is minimal (0-2%)
    let dropProb = this.channelState === 'BAD' ? 0.88 : (this.config.packetLossRate * 0.25);
    const drop = this.rng.nextFloat() < dropProb;
    if (drop) {
      this.totalDataPacketsDropped++;
      this.consecutiveLosses++;
      return {
        drop: true,
        reason: `Gilbert-Elliott Burst (${this.channelState} state, consecutive loss #${this.consecutiveLosses})`
      };
    }

    this.consecutiveLosses = 0;
    return { drop: false };
  }

  // Evaluate if return ACK packet is dropped
  shouldDropAck(): { drop: boolean; reason?: string } {
    this.totalAcksProcessed++;
    const drop = this.rng.nextFloat() < this.config.ackLossRate;
    if (drop) {
      this.totalAcksDropped++;
      return { drop: true, reason: 'Reverse channel ACK loss' };
    }
    return { drop: false };
  }

  // Calculate actual one-way transit delay with Gaussian jitter and minimum physical bound
  calculateTransitDelayMs(): number {
    const jitter = this.config.jitterMs > 0
      ? this.rng.nextGaussian(0, this.config.jitterMs / 2)
      : 0;
    const delay = this.config.oneWayDelayMs + jitter;
    // Lower-bounded by 2ms propagation limit
    return Math.max(2, Math.round(delay * 10) / 10);
  }

  getMetrics() {
    return {
      channelState: this.channelState,
      consecutiveLosses: this.consecutiveLosses,
      totalDataPacketsProcessed: this.totalDataPacketsProcessed,
      totalDataPacketsDropped: this.totalDataPacketsDropped,
      empiricalDataLossRate: this.totalDataPacketsProcessed > 0
        ? this.totalDataPacketsDropped / this.totalDataPacketsProcessed
        : 0,
      totalAcksProcessed: this.totalAcksProcessed,
      totalAcksDropped: this.totalAcksDropped,
      empiricalAckLossRate: this.totalAcksProcessed > 0
        ? this.totalAcksDropped / this.totalAcksProcessed
        : 0
    };
  }
}
