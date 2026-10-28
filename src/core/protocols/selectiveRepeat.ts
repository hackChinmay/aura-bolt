// Selective Repeat ARQ State Machine

import { PacketFrame, WindowSlot } from '../types';

export interface SRFrameEntry {
  globalIndex: number;
  seqNumber: number;
  state: 'sent_unacked' | 'acked' | 'ready_to_send';
  frameId: string;
  sentAt: number;
  timerExpiresAt: number;
  retransmissions: number;
}

export class SelectiveRepeatSender {
  public baseIndex: number = 0;       // Oldest unacked frame index
  public nextSeqIndex: number = 0;     // Next frame index to send
  public totalFrames: number;
  public windowSize: number;
  public modulus: number;
  public currentRtoMs: number;
  public frameTable: Map<number, SRFrameEntry> = new Map(); // globalIndex -> entry
  public retransmissionsCount: number = 0;
  public isCompleted: boolean = false;

  constructor(totalFrames: number, windowSize: number, modulus: number = 64, initialRtoMs: number = 300) {
    this.totalFrames = totalFrames;
    this.modulus = modulus;
    // Strict Selective Repeat safety condition: Ws <= M / 2
    const maxSafeWindow = Math.floor(modulus / 2);
    this.windowSize = Math.min(windowSize, maxSafeWindow);
    this.currentRtoMs = initialRtoMs;
  }

  setWindowSize(newSize: number) {
    const maxSafeWindow = Math.floor(this.modulus / 2);
    this.windowSize = Math.max(1, Math.min(newSize, maxSafeWindow));
  }

  canSend(): boolean {
    if (this.isCompleted) return false;

    // Check if there is an unacked frame in ready_to_send (retransmission candidate)
    for (let i = this.baseIndex; i < this.nextSeqIndex; i++) {
      const entry = this.frameTable.get(i);
      if (entry && entry.state === 'ready_to_send') {
        return true;
      }
    }

    // Or check if window can accommodate new fresh frame
    return (
      this.nextSeqIndex < this.totalFrames &&
      this.nextSeqIndex < this.baseIndex + this.windowSize
    );
  }

  onSend(simTimeMs: number): PacketFrame | null {
    if (!this.canSend()) return null;

    // First priority: retransmit frames that timed out
    for (let i = this.baseIndex; i < this.nextSeqIndex; i++) {
      const entry = this.frameTable.get(i);
      if (entry && entry.state === 'ready_to_send') {
        entry.state = 'sent_unacked';
        entry.sentAt = simTimeMs;
        entry.timerExpiresAt = simTimeMs + this.currentRtoMs;
        return {
          id: entry.frameId,
          seqNumber: entry.seqNumber,
          type: 'DATA',
          payloadLength: 1024,
          payloadPreview: `SR Retransmit #${entry.globalIndex}`,
          checksum: (0x55AA + entry.globalIndex) & 0xFFFF,
          isRetransmission: true,
          retransmissionCount: entry.retransmissions,
          sentAt: simTimeMs,
          direction: 'sender_to_receiver',
          progress: 0,
          status: 'in_flight',
        };
      }
    }

    // Second: send fresh frame
    if (this.nextSeqIndex < this.totalFrames && this.nextSeqIndex < this.baseIndex + this.windowSize) {
      const frameIndex = this.nextSeqIndex;
      const seq = frameIndex % this.modulus;
      const frameId = `sr-f${frameIndex}-s${seq}-try0`;

      const entry: SRFrameEntry = {
        globalIndex: frameIndex,
        seqNumber: seq,
        state: 'sent_unacked',
        frameId,
        sentAt: simTimeMs,
        timerExpiresAt: simTimeMs + this.currentRtoMs,
        retransmissions: 0,
      };
      this.frameTable.set(frameIndex, entry);
      this.nextSeqIndex++;

      return {
        id: frameId,
        seqNumber: seq,
        type: 'DATA',
        payloadLength: 1024,
        payloadPreview: `SR Frame #${frameIndex}`,
        checksum: (0x55AA + frameIndex) & 0xFFFF,
        isRetransmission: false,
        retransmissionCount: 0,
        sentAt: simTimeMs,
        direction: 'sender_to_receiver',
        progress: 0,
        status: 'in_flight',
      };
    }

    return null;
  }

  // Individual ACK received for specific sequence number
  onIndividualAckReceived(ackSeq: number, _simTimeMs: number): {
    valid: boolean;
    advancedBase: boolean;
    frameIndex?: number;
  } {
    // Locate the matching unacknowledged frame inside current window [baseIndex ... baseIndex + windowSize - 1]
    const windowEnd = Math.min(this.baseIndex + this.windowSize, this.totalFrames);
    let matchedIndex: number | null = null;

    for (let i = this.baseIndex; i < windowEnd; i++) {
      if (i % this.modulus === ackSeq) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === null) {
      // Out of sender window ACK (duplicate or delayed ACK for already slid frame)
      return { valid: false, advancedBase: false };
    }

    const entry = this.frameTable.get(matchedIndex);
    if (!entry || entry.state === 'acked') {
      return { valid: false, advancedBase: false };
    }

    // Mark individual frame as acknowledged
    entry.state = 'acked';

    // Slide baseIndex forward past all consecutive acknowledged frames
    const oldBase = this.baseIndex;
    while (this.baseIndex < this.totalFrames) {
      const bEntry = this.frameTable.get(this.baseIndex);
      if (bEntry && bEntry.state === 'acked') {
        this.frameTable.delete(this.baseIndex);
        this.baseIndex++;
      } else {
        break;
      }
    }

    if (this.baseIndex >= this.totalFrames) {
      this.isCompleted = true;
    }

    return {
      valid: true,
      advancedBase: this.baseIndex > oldBase,
      frameIndex: matchedIndex,
    };
  }

  // Check individual timers for every unacked frame
  checkTimeouts(simTimeMs: number): { timedOutFramesCount: number } {
    if (this.isCompleted) return { timedOutFramesCount: 0 };

    let timedOutCount = 0;
    for (let i = this.baseIndex; i < this.nextSeqIndex; i++) {
      const entry = this.frameTable.get(i);
      if (entry && entry.state === 'sent_unacked') {
        if (simTimeMs >= entry.timerExpiresAt) {
          entry.state = 'ready_to_send';
          entry.retransmissions++;
          this.retransmissionsCount++;
          timedOutCount++;
        }
      }
    }

    return { timedOutFramesCount: timedOutCount };
  }

  getWindowSlots(): WindowSlot[] {
    const slots: WindowSlot[] = [];
    const windowEnd = Math.min(this.baseIndex + this.windowSize, this.totalFrames);
    for (let i = this.baseIndex; i < windowEnd; i++) {
      const entry = this.frameTable.get(i);
      if (entry) {
        slots.push({
          seqNumber: entry.seqNumber,
          state: entry.state,
          frameId: entry.frameId,
          sentAt: entry.sentAt,
          timerExpiresAt: entry.timerExpiresAt,
          retransmissions: entry.retransmissions,
        });
      } else {
        slots.push({
          seqNumber: i % this.modulus,
          state: i < this.nextSeqIndex ? 'sent_unacked' : 'ready_to_send',
          retransmissions: 0,
        });
      }
    }
    return slots;
  }
}

export class SelectiveRepeatReceiver {
  public baseIndex: number = 0;       // Expected contiguous delivery base
  public totalDelivered: number = 0;
  public totalAcksSent: number = 0;
  public windowSize: number;
  public modulus: number;
  public buffer: Map<number, PacketFrame> = new Map(); // globalIndex -> received Frame

  constructor(
    public totalExpectedFrames: number,
    windowSize: number,
    modulus: number = 64
  ) {
    this.modulus = modulus;
    const maxSafe = Math.floor(modulus / 2);
    this.windowSize = Math.min(windowSize, maxSafe);
  }

  onFrameArrival(frame: PacketFrame, simTimeMs: number): {
    accepted: boolean;
    ackFrame: PacketFrame;
    isBufferedOutOfOrder: boolean;
    deliveredNowCount: number;
  } {
    // Map frame sequence number to the closest globalIndex in relation to receiver baseIndex
    // A valid frame must fall within [baseIndex - windowSize ... baseIndex + windowSize - 1]
    let targetIndex: number | null = null;
    const searchStart = Math.max(0, this.baseIndex - this.windowSize);
    const searchEnd = this.baseIndex + this.windowSize;

    for (let i = searchStart; i < searchEnd; i++) {
      if (i % this.modulus === frame.seqNumber) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === null) {
      // Frame sequence number is outside both receiver window and previous ACK memory
      // Drop safely and send duplicate ACK for current seq to help sender recover
      const ackFrame: PacketFrame = {
        id: `sr-ack-out-${frame.seqNumber}-${simTimeMs}`,
        seqNumber: frame.seqNumber,
        ackNumber: frame.seqNumber,
        type: 'ACK',
        payloadLength: 0,
        checksum: (0xFEED ^ frame.seqNumber) & 0xFFFF,
        isRetransmission: true,
        retransmissionCount: 0,
        sentAt: simTimeMs,
        direction: 'receiver_to_sender',
        progress: 0,
        status: 'ack_in_flight',
      };
      this.totalAcksSent++;
      return { accepted: false, ackFrame, isBufferedOutOfOrder: false, deliveredNowCount: 0 };
    }

    // Always send an ACK for this specific frame sequence number so sender knows it arrived
    const ackFrame: PacketFrame = {
      id: `sr-ack-${frame.seqNumber}-${simTimeMs}`,
      seqNumber: frame.seqNumber,
      ackNumber: frame.seqNumber,
      type: 'ACK',
      payloadLength: 0,
      checksum: (0xFEED ^ frame.seqNumber) & 0xFFFF,
      isRetransmission: false,
      retransmissionCount: 0,
      sentAt: simTimeMs,
      direction: 'receiver_to_sender',
      progress: 0,
      status: 'ack_in_flight',
    };
    this.totalAcksSent++;

    // If frame is already in receiver window [baseIndex ... baseIndex + windowSize - 1]
    if (targetIndex >= this.baseIndex && targetIndex < this.baseIndex + this.windowSize) {
      if (!this.buffer.has(targetIndex)) {
        this.buffer.set(targetIndex, frame);
      }

      // Check if this arrival allows in-order delivery starting from baseIndex
      let deliveredCount = 0;
      while (this.buffer.has(this.baseIndex)) {
        this.buffer.delete(this.baseIndex);
        this.baseIndex++;
        this.totalDelivered++;
        deliveredCount++;
      }

      const isBuffered = targetIndex > this.baseIndex - deliveredCount;
      return {
        accepted: true,
        ackFrame,
        isBufferedOutOfOrder: isBuffered,
        deliveredNowCount: deliveredCount,
      };
    }

    // Frame was already delivered in the past (targetIndex < baseIndex), sender just needed re-ACK
    return {
      accepted: false,
      ackFrame,
      isBufferedOutOfOrder: false,
      deliveredNowCount: 0,
    };
  }

  getBufferOccupancy(): number {
    return this.buffer.size;
  }

  isTransferComplete(): boolean {
    return this.totalDelivered >= this.totalExpectedFrames;
  }
}
