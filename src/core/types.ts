// AURA-BOLT Protocol and Simulation Core Types

export type ProtocolType = 'stop_and_wait' | 'go_back_n' | 'selective_repeat' | 'aura_bolt' | 'loss_rate_adaptive';

export type FrameType = 'DATA' | 'ACK' | 'NACK' | 'SYN' | 'FIN' | 'RST';

export type FrameStatus = 
  | 'queued'
  | 'in_flight'
  | 'delivered'
  | 'lost'
  | 'corrupted'
  | 'ack_in_flight'
  | 'acked'
  | 'ack_lost'
  | 'retransmitted'
  | 'rejected';

export interface PacketFrame {
  id: string;
  seqNumber: number;
  ackNumber?: number;
  type: FrameType;
  payloadLength: number;
  payloadPreview?: string;
  checksum: number;
  isCorrupted?: boolean;
  isRetransmission: boolean;
  retransmissionCount: number;
  
  // Timestamps in milliseconds (simulation time or wall-clock)
  sentAt: number;
  arrivedAt?: number;
  ackedAt?: number;
  rttSample?: number;
  
  // Routing and animation state
  direction: 'sender_to_receiver' | 'receiver_to_sender';
  progress: number; // 0.0 to 1.0 for UI visualization
  status: FrameStatus;
  lossReason?: string;
}

export interface WindowSlot {
  seqNumber: number;
  state: 'empty' | 'sent_unacked' | 'acked' | 'buffered_out_of_order' | 'ready_to_send';
  frameId?: string;
  sentAt?: number;
  timerExpiresAt?: number;
  retransmissions: number;
}

export interface ChannelMetrics {
  currentRtt: number;
  srtt: number; // Smoothed RTT
  rttvar: number; // RTT variance
  rto: number; // Retransmission Timeout
  lossRate: number; // Moving average loss rate
  burstState: 'GOOD' | 'BAD'; // Gilbert-Elliott state
  burstLengthCurrent: number;
  consecutiveLosses: number;
  bandwidthDelayProduct: number;
  estimatedBandwidthKbps: number;
}

export interface ControllerDecision {
  id: string;
  timestamp: number;
  step: 'OBSERVE' | 'PREDICT' | 'SELECT' | 'APPLY' | 'MEASURE' | 'VERIFY' | 'FALLBACK';
  currentProtocol: ProtocolType;
  selectedProtocol: ProtocolType;
  previousWindow: number;
  selectedWindow: number;
  previousRto: number;
  selectedRto: number;
  mode: 'OPTIMAL' | 'CONSERVATIVE_RECOVERY' | 'PROBING' | 'FALLBACK';
  
  // Inputs
  inputs: {
    srtt: number;
    rttvar: number;
    recentLossRate: number;
    burstProbability: number;
    channelState: 'GOOD' | 'BAD';
    receiverBufferOccupancy: number;
    windowUtilization: number;
    measuredGoodputKbps: number;
    bdpFrames: number;
  };
  
  // Scored candidate configurations
  candidates: Array<{
    windowSize: number;
    protocol: ProtocolType;
    predictedGoodputKbps: number;
    predictedP95LatencyMs: number;
    predictedRetransCost: number;
    predictedBufferUsage: number;
    objectiveScore: number;
    isFeasible: boolean;
    rejectionReason?: string;
  }>;
  
  reason: string;
  expectedOutcome: string;
  observedGoodputKbps?: number;
  predictionError?: number;
  status: 'AWAITING_VERIFICATION' | 'VERIFIED' | 'REVERTED';
}

export interface ExperimentConfig {
  id: string;
  name: string;
  protocol: ProtocolType;
  isAdaptive: boolean;
  totalFrames: number;
  payloadSize: number; // bytes per frame
  oneWayDelayMs: number;
  jitterMs: number;
  packetLossRate: number; // 0 to 0.5
  ackLossRate: number; // 0 to 0.3
  bandwidthKbps: number;
  
  // Impairment pattern
  lossPattern: 'random' | 'burst' | 'alternating' | 'sudden_degradation' | 'recovery';
  burstMeanLength: number;
  burstProbabilityGoodToBad: number;
  burstProbabilityBadToBad: number;
  
  // Window parameters
  initialWindowSize: number;
  maxWindowSize: number;
  receiverBufferSize: number;
  initialRtoMs: number;
  seqNumberModulus: number; // e.g. 16, 64, 256
  
  // Adaptive weights J(c) = alpha*Goodput - beta*Latency - gamma*Retrans - delta*Buffer
  alpha: number; // Goodput weight
  beta: number;  // Latency weight
  gamma: number; // Retransmission weight
  delta: number; // Buffer weight
  
  // Ablation flag
  enableBurstAwareness: boolean;
  
  // Reproducibility
  randomSeed: number;
  executionMode: 'simulation' | 'real_udp';
}

export interface MetricSnapshot {
  timestamp: number;
  elapsedMs: number;
  framesSentTotal: number;
  framesDeliveredTotal: number;
  framesRetransmittedTotal: number;
  acksReceivedTotal: number;
  bytesDeliveredTotal: number;
  goodputKbps: number;
  transmissionThroughputKbps: number;
  retransmissionRatio: number;
  currentWindowSize: number;
  windowUtilization: number;
  receiverBufferUsage: number;
  srttMs: number;
  rtoMs: number;
  lossRateMeasured: number;
  currentChannelState: 'GOOD' | 'BAD';
}

export interface ExperimentSummary {
  experimentId: string;
  protocol: ProtocolType;
  config: ExperimentConfig;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'failed';
  
  // High-level outcomes
  totalFramesRequested: number;
  totalDataFramesSent: number;
  totalRetransmissions: number;
  totalAcksSent: number;
  totalPacketsLost: number;
  totalAcksLost: number;
  
  finalGoodputKbps: number;
  meanDeliveryLatencyMs: number;
  p95DeliveryLatencyMs: number;
  retransmissionRatio: number;
  senderUtilization: number;
  peakBufferUsage: number;
  
  // Verification
  originalPayloadHash?: string;
  reconstructedPayloadHash?: string;
  integrityVerified: boolean;
  
  // Adaptive performance
  adaptationDecisionsCount: number;
  meanPredictionError: number;
  timeSpentInRecoveryMs: number;
}
