// Go-Back-N ARQ State Machine

import { PacketFrame, WindowSlot } from '../types';

export class GoBackNSender {
  public baseIndex: number = 0;       // Global frame index of oldest unacked frame
  public nextSeqIndex: number = 0;     // Global frame index of next frame to send
  public totalFrames: number;
  public windowSize: number;
  public modulus: number;
  public currentRtoMs: number;
  public timerExpiresAt: number | null = null;
  public inFlightFrames: Map<number, WindowSlot> = new Map(); // globalIndex -> WindowSlot
  public retransmissionsCount: number = 0;
  public isCompleted: boolean = false;

  constructor(totalFrames: number, windowSize: number, modulus: number = 64, initialRtoMs: number = 300) {
    this.totalFrames = totalFrames;
    this.modulus = modulus;
    // Go-Back-N condition: Window size <= Modulus - 1
    this.windowSize = Math.min(windowSize, modulus - 1);
    this.currentRtoMs = initialRtoMs;
  }

  setWindowSize(newSize: number) {
    this.windowSize = Math.max(1, Math.min(newSize, this.modulus - 1));
  }

  canSend(): boolean {
    return (
      !this.isCompleted &&
      this.nextSeqIndex < this.totalFrames &&
      this.nextSeqIndex < this.baseIndex + this.windowSize
    );
  }

  onSend(simTimeMs: number): PacketFrame | null {
    if (!this.canSend()) return null;

    const frameIndex = this.nextSeqIndex;
    const seq = frameIndex % this.modulus;
    const isRetrans = (this.inFlightFrames.get(frameIndex)?.retransmissions || 0) > 0;
    const retransCount = this.inFlightFrames.get(frameIndex)?.retransmissions || 0;

    const frameId = `gbn-f${frameIndex}-s${seq}-try${retransCount}`;

    const slot: WindowSlot = {
      seqNumber: seq,
      state: 'sent_unacked',
      frameId,
      sentAt: simTimeMs,
      timerExpiresAt: simTimeMs + this.currentRtoMs,
      retransmissions: retransCount,
    };
    this.inFlightFrames.set(frameIndex, slot);

    // If this is the oldest unacked frame, start or reset timer
    if (this.timerExpiresAt === null) {
      this.timerExpiresAt = simTimeMs + this.currentRtoMs;
    }

    this.nextSeqIndex++;

    return {
      id: frameId,
      seqNumber: seq,
      type: 'DATA',
      payloadLength: 1024,
      payloadPreview: `GBN Frame #${frameIndex}`,
      checksum: (0x1234 + frameIndex) & 0xFFFF,
      isRetransmission: isRetrans,
      retransmissionCount: retransCount,
      sentAt: simTimeMs,
      direction: 'sender_to_receiver',
      progress: 0,
      status: 'in_flight',
    };
  }

  // Cumulative ACK: ACK n acknowledges all frames up to seq n
  onCumulativeAckReceived(ackSeq: number, simTimeMs: number): {
    valid: boolean;
    framesAcked: number;
    advancedBase: boolean;
  } {
    if (this.baseIndex >= this.totalFrames) {
      this.isCompleted = true;
      return { valid: false, framesAcked: 0, advancedBase: false };
    }

    // Determine how many frames from baseIndex are acknowledged by ackSeq
    let ackedCount = 0;
    let scanIndex = this.baseIndex;

    while (scanIndex < this.nextSeqIndex) {
      const seq = scanIndex % this.modulus;
      ackedCount++;
      if (seq === ackSeq) {
        // Found matching sequence number in window
        // Remove acknowledged frames from tracking map
        for (let i = this.baseIndex; i <= scanIndex; i++) {
          this.inFlightFrames.delete(i);
        }

        const oldBase = this.baseIndex;
        this.baseIndex = scanIndex + 1;

        if (this.baseIndex === this.nextSeqIndex) {
          // No more outstanding unacked frames
          this.timerExpiresAt = null;
        } else {
          // Still outstanding frames; restart timer for oldest remaining frame
          this.timerExpiresAt = simTimeMs + this.currentRtoMs;
        }

        if (this.baseIndex >= this.totalFrames) {
          this.isCompleted = true;
        }

        return { valid: true, framesAcked: ackedCount, advancedBase: this.baseIndex > oldBase };
      }
      scanIndex++;
    }

    // If ackSeq is outside the current outstanding window, it's a duplicate or out-of-order ACK
    return { valid: false, framesAcked: 0, advancedBase: false };
  }

  // Timer check: if expired, rewind nextSeqIndex back to baseIndex to retransmit all unacked frames
  checkTimeout(simTimeMs: number): { timedOut: boolean; retransmitBaseIndex?: number } {
    if (this.isCompleted || this.timerExpiresAt === null) {
      return { timedOut: false };
    }

    if (simTimeMs >= this.timerExpiresAt) {
      // Retransmit all frames currently in window starting from base
      const rewindFrom = this.nextSeqIndex;
      this.nextSeqIndex = this.baseIndex; // Rewind
      this.timerExpiresAt = simTimeMs + this.currentRtoMs; // Restart timer

      for (let i = this.baseIndex; i < rewindFrom; i++) {
        const slot = this.inFlightFrames.get(i);
        if (slot) {
          slot.retransmissions++;
          slot.state = 'ready_to_send';
          this.retransmissionsCount++;
        }
      }

      return { timedOut: true, retransmitBaseIndex: this.baseIndex };
    }

    return { timedOut: false };
  }

  getWindowSlots(): WindowSlot[] {
    const slots: WindowSlot[] = [];
    const windowEnd = Math.min(this.baseIndex + this.windowSize, this.totalFrames);
    for (let i = this.baseIndex; i < windowEnd; i++) {
      const seq = i % this.modulus;
      const existing = this.inFlightFrames.get(i);
      if (existing) {
        slots.push(existing);
      } else {
        slots.push({
          seqNumber: seq,
          state: i < this.nextSeqIndex ? 'sent_unacked' : 'ready_to_send',
          retransmissions: 0,
        });
      }
    }
    return slots;
  }
}

export class GoBackNReceiver {
  public expectedSeq: number = 0;
  public expectedGlobalIndex: number = 0;
  public totalDelivered: number = 0;
  public totalAcksSent: number = 0;
  public modulus: number;
  public lastAckSeqSent: number;

  constructor(public totalExpectedFrames: number, modulus: number = 64) {
    this.modulus = modulus;
    this.lastAckSeqSent = (modulus - 1); // Sentinel for initially unacknowledged
  }

  onFrameArrival(frame: PacketFrame, simTimeMs: number): {
    accepted: boolean;
    ackFrame: PacketFrame;
    isDuplicateOrOutOfOrder: boolean;
  } {
    const isExpected = frame.seqNumber === this.expectedSeq;

    if (isExpected) {
      this.totalDelivered++;
      this.lastAckSeqSent = frame.seqNumber;
      this.expectedGlobalIndex++;
      this.expectedSeq = (this.expectedSeq + 1) % this.modulus;

      const ackFrame: PacketFrame = {
        id: `gbn-ack-${frame.seqNumber}-${simTimeMs}`,
        seqNumber: frame.seqNumber,
        ackNumber: frame.seqNumber, // Cumulative ACK acknowledges this frame
        type: 'ACK',
        payloadLength: 0,
        checksum: (0xCAFE + frame.seqNumber) & 0xFFFF,
        isRetransmission: false,
        retransmissionCount: 0,
        sentAt: simTimeMs,
        direction: 'receiver_to_sender',
        progress: 0,
        status: 'ack_in_flight',
      };
      this.totalAcksSent++;
      return { accepted: true, ackFrame, isDuplicateOrOutOfOrder: false };
    } else {
      // Out of order: Go-Back-N receiver drops the frame and re-sends cumulative ACK for last good frame
      const ackFrame: PacketFrame = {
        id: `gbn-dup-ack-${this.lastAckSeqSent}-${simTimeMs}`,
        seqNumber: this.lastAckSeqSent,
        ackNumber: this.lastAckSeqSent,
        type: 'ACK',
        payloadLength: 0,
        checksum: (0xDEAD + this.lastAckSeqSent) & 0xFFFF,
        isRetransmission: true,
        retransmissionCount: 0,
        sentAt: simTimeMs,
        direction: 'receiver_to_sender',
        progress: 0,
        status: 'ack_in_flight',
      };
      this.totalAcksSent++;
      return { accepted: false, ackFrame, isDuplicateOrOutOfOrder: true };
    }
  }

  isTransferComplete(): boolean {
    return this.totalDelivered >= this.totalExpectedFrames;
  }
}
