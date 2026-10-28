// Real UDP Socket File Transfer Engine with Binary Frame Protocol and SHA-256 Verification

import dgram from 'dgram';
import crypto from 'crypto';

export enum UdpMessageType {
  SYN = 1,
  SYN_ACK = 2,
  DATA = 3,
  ACK = 4,
  FIN = 5,
  FIN_ACK = 6,
  RST = 7,
}

export interface UdpPacketHeader {
  magic: number;          // 2 bytes: 0x4142 ('A', 'B')
  version: number;        // 1 byte: 0x01
  msgType: UdpMessageType;// 1 byte
  flags: number;          // 1 byte
  reserved: number;       // 1 byte
  seqNumber: number;      // 4 bytes uint32
  ackNumber: number;      // 4 bytes uint32
  windowSize: number;     // 2 bytes uint16
  payloadLength: number;  // 2 bytes uint16
  sessionId: number;      // 4 bytes uint32
  checksum: number;       // 2 bytes uint16
  timestampMicros: bigint;// 8 bytes uint64
}

export const HEADER_SIZE = 32;

// Compute 16-bit Internet Checksum (RFC 1071)
export function computeInternetChecksum(buf: Buffer): number {
  let sum = 0;
  for (let i = 0; i < buf.length - 1; i += 2) {
    sum += buf.readUInt16BE(i);
  }
  if (buf.length % 2 === 1) {
    sum += buf[buf.length - 1] << 8;
  }
  while (sum >> 16) {
    sum = (sum & 0xffff) + (sum >> 16);
  }
  return ~sum & 0xffff;
}

export function encodePacket(header: UdpPacketHeader, payload: Buffer): Buffer {
  const buf = Buffer.alloc(HEADER_SIZE + payload.length);
  buf.writeUInt16BE(0x4142, 0);
  buf.writeUInt8(header.version, 2);
  buf.writeUInt8(header.msgType, 3);
  buf.writeUInt8(header.flags, 4);
  buf.writeUInt8(0, 5); // reserved
  buf.writeUInt32BE(header.seqNumber, 6);
  buf.writeUInt32BE(header.ackNumber, 10);
  buf.writeUInt16BE(header.windowSize, 14);
  buf.writeUInt16BE(payload.length, 16);
  buf.writeUInt32BE(header.sessionId, 18);
  buf.writeUInt16BE(0, 22); // Checksum set to 0 initially
  buf.writeBigUInt64BE(header.timestampMicros, 24);

  if (payload.length > 0) {
    payload.copy(buf, HEADER_SIZE);
  }

  // Calculate checksum over entire packet with checksum field = 0
  const csum = computeInternetChecksum(buf);
  buf.writeUInt16BE(csum, 22);

  return buf;
}

export function decodePacket(raw: Buffer): { header: UdpPacketHeader; payload: Buffer; isValid: boolean } | null {
  if (raw.length < HEADER_SIZE) return null;

  const magic = raw.readUInt16BE(0);
  if (magic !== 0x4142) return null;

  const version = raw.readUInt8(2);
  const msgType = raw.readUInt8(3) as UdpMessageType;
  const flags = raw.readUInt8(4);
  const reserved = raw.readUInt8(5);
  const seqNumber = raw.readUInt32BE(6);
  const ackNumber = raw.readUInt32BE(10);
  const windowSize = raw.readUInt16BE(14);
  const payloadLength = raw.readUInt16BE(16);
  const sessionId = raw.readUInt32BE(18);
  const checksum = raw.readUInt16BE(22);
  const timestampMicros = raw.readBigUInt64BE(24);

  // Validate packet length
  if (raw.length < HEADER_SIZE + payloadLength) return null;

  // Validate checksum by zeroing checksum slot in copy
  const verifyBuf = Buffer.from(raw);
  verifyBuf.writeUInt16BE(0, 22);
  const calculatedCsum = computeInternetChecksum(verifyBuf);
  const isValid = calculatedCsum === checksum;

  const payload = raw.subarray(HEADER_SIZE, HEADER_SIZE + payloadLength);

  return {
    header: {
      magic,
      version,
      msgType,
      flags,
      reserved,
      seqNumber,
      ackNumber,
      windowSize,
      payloadLength,
      sessionId,
      checksum,
      timestampMicros,
    },
    payload,
    isValid,
  };
}

export interface LiveUdpTransferTelemetry {
  sessionId: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  totalBytes: number;
  bytesSent: number;
  bytesReceived: number;
  totalChunks: number;
  chunksAcked: number;
  retransmissions: number;
  senderOriginalSha256: string;
  receiverReconstructedSha256: string;
  integrityVerified: boolean;
  elapsedMs: number;
  goodputKbps: number;
  currentWindow: number;
  recentPacketEvents: Array<{
    seq: number;
    type: string;
    size: number;
    status: string;
    timestamp: number;
  }>;
}

export class RealUdpFileTransferSession {
  private senderSocket: dgram.Socket | null = null;
  private receiverSocket: dgram.Socket | null = null;
  private senderPort: number = 19001;
  private receiverPort: number = 19002;
  private sessionId: number = Math.floor(Math.random() * 1000000);
  private chunkSize: number = 1024;
  private chunks: Buffer[] = [];
  private totalChunks: number = 0;
  private senderOriginalHash: string = '';
  private receivedChunksMap: Map<number, Buffer> = new Map();
  private reconstructedBuffer: Buffer = Buffer.alloc(0);
  private reconstructedHash: string = '';

  private senderBase: number = 0;
  private nextSeqNum: number = 0;
  private windowSize: number = 8;
  private inFlightTimers: Map<number, NodeJS.Timeout> = new Map();
  private rtoMs: number = 250;
  private retransmissionsCount: number = 0;

  private startTime: number = 0;
  private endTime: number = 0;
  private isFinished: boolean = false;
  private telemetryEvents: Array<{
    seq: number;
    type: string;
    size: number;
    status: string;
    timestamp: number;
  }> = [];

  constructor(private fileData: Buffer, private packetLossRate: number = 0.05) {
    // Generate chunks
    const numChunks = Math.ceil(fileData.length / this.chunkSize);
    for (let i = 0; i < numChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, fileData.length);
      this.chunks.push(fileData.subarray(start, end));
    }
    this.totalChunks = this.chunks.length;
    this.senderOriginalHash = crypto.createHash('sha256').update(fileData).digest('hex');
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    await this.initSockets();

    // Start sending pipeline
    this.pumpSender();
  }

  private initSockets(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.receiverSocket = dgram.createSocket('udp4');
      this.senderSocket = dgram.createSocket('udp4');

      this.receiverSocket.on('error', (err) => console.error('Receiver socket error:', err));
      this.senderSocket.on('error', (err) => console.error('Sender socket error:', err));

      this.receiverSocket.on('message', (msg) => this.handleReceiverMessage(msg));
      this.senderSocket.on('message', (msg) => this.handleSenderMessage(msg));

      this.receiverSocket.bind(this.receiverPort, '127.0.0.1', () => {
        this.senderSocket!.bind(this.senderPort, '127.0.0.1', () => {
          resolve();
        });
      });
    });
  }

  private pumpSender() {
    if (this.isFinished) return;

    while (
      this.nextSeqNum < this.totalChunks &&
      this.nextSeqNum < this.senderBase + this.windowSize
    ) {
      this.sendChunk(this.nextSeqNum);
      this.nextSeqNum++;
    }
  }

  private sendChunk(seq: number) {
    if (seq >= this.totalChunks) return;
    const payload = this.chunks[seq];

    const header: UdpPacketHeader = {
      magic: 0x4142,
      version: 1,
      msgType: UdpMessageType.DATA,
      flags: 0,
      reserved: 0,
      seqNumber: seq,
      ackNumber: 0,
      windowSize: this.windowSize,
      payloadLength: payload.length,
      sessionId: this.sessionId,
      checksum: 0,
      timestampMicros: BigInt(Date.now() * 1000),
    };

    const encoded = encodePacket(header, payload);

    // Controlled impairment simulation for demonstration of real recovery
    const shouldDrop = Math.random() < this.packetLossRate;
    if (shouldDrop) {
      this.telemetryEvents.push({
        seq,
        type: 'DATA',
        size: payload.length,
        status: 'DROPPED_IN_TRANSIT',
        timestamp: Date.now(),
      });
    } else {
      this.senderSocket?.send(encoded, this.receiverPort, '127.0.0.1');
      this.telemetryEvents.push({
        seq,
        type: 'DATA',
        size: payload.length,
        status: 'TRANSMITTED',
        timestamp: Date.now(),
      });
    }

    // Arm retransmission timer for this chunk
    if (!this.inFlightTimers.has(seq)) {
      const timer = setTimeout(() => {
        if (!this.isFinished && seq >= this.senderBase) {
          this.retransmissionsCount++;
          this.telemetryEvents.push({
            seq,
            type: 'DATA',
            size: payload.length,
            status: 'TIMEOUT_RETRANSMIT',
            timestamp: Date.now(),
          });
          this.inFlightTimers.delete(seq);
          this.sendChunk(seq);
        }
      }, this.rtoMs);
      this.inFlightTimers.set(seq, timer);
    }
  }

  private handleReceiverMessage(msg: Buffer) {
    const decoded = decodePacket(msg);
    if (!decoded || !decoded.isValid) return;

    if (decoded.header.msgType === UdpMessageType.DATA) {
      const seq = decoded.header.seqNumber;
      if (!this.receivedChunksMap.has(seq)) {
        this.receivedChunksMap.set(seq, decoded.payload);
      }

      // Send ACK back to sender
      const ackHeader: UdpPacketHeader = {
        magic: 0x4142,
        version: 1,
        msgType: UdpMessageType.ACK,
        flags: 0,
        reserved: 0,
        seqNumber: 0,
        ackNumber: seq,
        windowSize: this.windowSize,
        payloadLength: 0,
        sessionId: this.sessionId,
        checksum: 0,
        timestampMicros: BigInt(Date.now() * 1000),
      };

      const ackPacket = encodePacket(ackHeader, Buffer.alloc(0));
      this.receiverSocket?.send(ackPacket, this.senderPort, '127.0.0.1');

      // Check if all chunks have arrived
      if (this.receivedChunksMap.size === this.totalChunks && !this.isFinished) {
        this.finishTransfer();
      }
    }
  }

  private handleSenderMessage(msg: Buffer) {
    const decoded = decodePacket(msg);
    if (!decoded || !decoded.isValid) return;

    if (decoded.header.msgType === UdpMessageType.ACK) {
      const ackNum = decoded.header.ackNumber;

      // Clear timer for this chunk
      const timer = this.inFlightTimers.get(ackNum);
      if (timer) {
        clearTimeout(timer);
        this.inFlightTimers.delete(ackNum);
      }

      this.telemetryEvents.push({
        seq: ackNum,
        type: 'ACK',
        size: 0,
        status: 'ACK_RECEIVED',
        timestamp: Date.now(),
      });

      // Advance sender base if this is base
      if (ackNum === this.senderBase) {
        while (!this.inFlightTimers.has(this.senderBase) && this.senderBase < this.nextSeqNum) {
          this.senderBase++;
        }
      }

      this.pumpSender();
    }
  }

  private finishTransfer() {
    this.isFinished = true;
    this.endTime = Date.now();

    // Reconstruct buffer in exact sequence order
    const orderedChunks: Buffer[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      orderedChunks.push(this.receivedChunksMap.get(i) || Buffer.alloc(0));
    }
    this.reconstructedBuffer = Buffer.concat(orderedChunks);
    this.reconstructedHash = crypto.createHash('sha256').update(this.reconstructedBuffer).digest('hex');

    // Clean up timers
    this.inFlightTimers.forEach(t => clearTimeout(t));
    this.inFlightTimers.clear();

    setTimeout(() => {
      this.closeSockets();
    }, 500);
  }

  closeSockets() {
    try {
      this.senderSocket?.close();
      this.receiverSocket?.close();
    } catch {
      // ignore
    }
  }

  getTelemetry(): LiveUdpTransferTelemetry {
    const elapsedMs = Math.max(1, (this.endTime || Date.now()) - this.startTime);
    const bytesDelivered = this.receivedChunksMap.size * this.chunkSize;
    const goodputKbps = Math.round((bytesDelivered * 8) / (elapsedMs));

    return {
      sessionId: this.sessionId,
      status: this.isFinished ? 'completed' : 'running',
      totalBytes: this.fileData.length,
      bytesSent: this.nextSeqNum * this.chunkSize,
      bytesReceived: Math.min(this.fileData.length, bytesDelivered),
      totalChunks: this.totalChunks,
      chunksAcked: this.receivedChunksMap.size,
      retransmissions: this.retransmissionsCount,
      senderOriginalSha256: this.senderOriginalHash,
      receiverReconstructedSha256: this.reconstructedHash || (this.isFinished ? this.senderOriginalHash : 'calculating...'),
      integrityVerified: this.isFinished && (this.senderOriginalHash === this.reconstructedHash),
      elapsedMs,
      goodputKbps,
      currentWindow: this.windowSize,
      recentPacketEvents: this.telemetryEvents.slice(-25),
    };
  }
}
