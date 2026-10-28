// Stop-and-Wait ARQ State Machine

import { PacketFrame, WindowSlot } from '../types';

export class StopAndWaitSender {
  public baseSeq: number = 0; // 0 or 1
  public nextFrameIndex: number = 0;
  public totalFrames: number;
  public currentSlot: WindowSlot | null = null;
  public timerExpiresAt: number | null = null;
  public currentRtoMs: number;
  public isCompleted: boolean = false;
  public retransmissionsCount: number = 0;

  constructor(totalFrames: number, initialRtoMs: number) {
    this.totalFrames = totalFrames;
    this.currentRtoMs = initialRtoMs;
    this.prepareNextSlot();
  }

  private prepareNextSlot() {
    if (this.nextFrameIndex < this.totalFrames) {
      const seq = this.nextFrameIndex % 2;
      this.currentSlot = {
        seqNumber: seq,
        state: 'ready_to_send',
        retransmissions: 0,
      };
    } else {
      this.currentSlot = null;
      this.isCompleted = true;
    }
  }

  canSend(): boolean {
    return !this.isCompleted && this.currentSlot !== null && this.currentSlot.state === 'ready_to_send';
  }

  onSend(simTimeMs: number): PacketFrame | null {
    if (!this.canSend() || !this.currentSlot) return null;

    const seq = this.currentSlot.seqNumber;
    const isRetrans = this.currentSlot.retransmissions > 0;
    const frameId = `saw-f${this.nextFrameIndex}-s${seq}-try${this.currentSlot.retransmissions}`;

    this.currentSlot.state = 'sent_unacked';
    this.currentSlot.frameId = frameId;
    this.currentSlot.sentAt = simTimeMs;
    this.currentSlot.timerExpiresAt = simTimeMs + this.currentRtoMs;
    this.timerExpiresAt = this.currentSlot.timerExpiresAt;

    return {
      id: frameId,
      seqNumber: seq,
      type: 'DATA',
      payloadLength: 1024,
      payloadPreview: `Chunk[${this.nextFrameIndex}/${this.totalFrames}]`,
      checksum: 0xCAFE ^ seq,
      isRetransmission: isRetrans,
      retransmissionCount: this.currentSlot.retransmissions,
      sentAt: simTimeMs,
      direction: 'sender_to_receiver',
      progress: 0,
      status: 'in_flight',
    };
  }

  onAckReceived(ackNum: number, simTimeMs: number): { valid: boolean; advanced: boolean } {
    if (!this.currentSlot || this.currentSlot.state !== 'sent_unacked') {
      return { valid: false, advanced: false };
    }

    // In alternating-bit S&W, ACK corresponds to the seq of the frame being acknowledged
    if (this.currentSlot.seqNumber === ackNum) {
      this.currentSlot.state = 'acked';
      this.timerExpiresAt = null;
      this.nextFrameIndex++;
      this.prepareNextSlot();
      return { valid: true, advanced: true };
    }

    return { valid: false, advanced: false };
  }

  checkTimeout(simTimeMs: number): { timedOut: boolean; frameToResend?: PacketFrame } {
    if (this.isCompleted || !this.currentSlot || this.currentSlot.state !== 'sent_unacked') {
      return { timedOut: false };
    }

    if (this.timerExpiresAt !== null && simTimeMs >= this.timerExpiresAt) {
      this.currentSlot.retransmissions++;
      this.retransmissionsCount++;
      this.currentSlot.state = 'ready_to_send';
      this.timerExpiresAt = null;
      return { timedOut: true };
    }

    return { timedOut: false };
  }

  getWindowSlots(): WindowSlot[] {
    return this.currentSlot ? [this.currentSlot] : [];
  }
}

export class StopAndWaitReceiver {
  public expectedSeq: number = 0; // 0 or 1
  public totalDelivered: number = 0;
  public totalAcksSent: number = 0;
  public lastAckSeqSent: number = 1; // Initially acknowledge prior state

  constructor(public totalExpectedFrames: number) {}

  onFrameArrival(frame: PacketFrame, simTimeMs: number): {
    accepted: boolean;
    ackFrame: PacketFrame;
    duplicate: boolean;
  } {
    const isExpected = frame.seqNumber === this.expectedSeq;

    if (isExpected) {
      this.totalDelivered++;
      this.lastAckSeqSent = frame.seqNumber;
      this.expectedSeq = (this.expectedSeq + 1) % 2;

      const ackFrame: PacketFrame = {
        id: `saw-ack-${frame.seqNumber}-${simTimeMs}`,
        seqNumber: frame.seqNumber,
        ackNumber: frame.seqNumber,
        type: 'ACK',
        payloadLength: 0,
        checksum: 0xBEEF ^ frame.seqNumber,
        isRetransmission: false,
        retransmissionCount: 0,
        sentAt: simTimeMs,
        direction: 'receiver_to_sender',
        progress: 0,
        status: 'ack_in_flight',
      };
      this.totalAcksSent++;
      return { accepted: true, ackFrame, duplicate: false };
    } else {
      // Duplicate frame: retransmit ACK for the last accepted frame to unblock sender
      const ackFrame: PacketFrame = {
        id: `saw-dup-ack-${this.lastAckSeqSent}-${simTimeMs}`,
        seqNumber: this.lastAckSeqSent,
        ackNumber: this.lastAckSeqSent,
        type: 'ACK',
        payloadLength: 0,
        checksum: 0xBEEF ^ this.lastAckSeqSent,
        isRetransmission: true,
        retransmissionCount: 0,
        sentAt: simTimeMs,
        direction: 'receiver_to_sender',
        progress: 0,
        status: 'ack_in_flight',
      };
      this.totalAcksSent++;
      return { accepted: false, ackFrame, duplicate: true };
    }
  }

  isTransferComplete(): boolean {
    return this.totalDelivered >= this.totalExpectedFrames;
  }
}
