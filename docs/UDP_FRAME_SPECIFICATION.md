# AURA-BOLT UDP Binary Frame Specification

## 1. Frame Architecture Overview

The native UDP transfer engine (`src/core/udpTransfer.ts`) implements reliable data transfer over raw Node.js `dgram` sockets (`udp4`). Every datagram consists of a mandatory **32-byte binary header** followed by an optional payload slice.

All multi-byte numeric fields are encoded in **Network Byte Order (Big-Endian)**.

---

## 2. 32-Byte Binary Frame Layout Table

| Byte Offset | Field Name | Data Type | Size (Bytes) | Endianness | Description & Semantics |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **0 – 1** | `magic` | `uint16` | 2 | Big-Endian | Protocol Magic: `0x4142` (ASCII `'A'`, `'B'`). Verifies frame identity. |
| **2** | `version` | `uint8` | 1 | N/A | Protocol Version. Currently fixed at `0x01`. |
| **3** | `msgType` | `uint8` | 1 | N/A | Control/Data Type: `1`=SYN, `2`=SYN_ACK, `3`=DATA, `4`=ACK, `5`=FIN, `6`=FIN_ACK, `7`=RST. |
| **4** | `flags` | `uint8` | 1 | N/A | Bit flags: `0x01`=Retransmission, `0x02`=Final Chunk, `0x04`=SACK Present. |
| **5** | `reserved` | `uint8` | 1 | N/A | Reserved for alignment and future extension. Must be zero (`0x00`). |
| **6 – 9** | `seqNumber` | `uint32` | 4 | Big-Endian | Monotonically increasing sequence number assigned to this frame. |
| **10 – 13** | `ackNumber` | `uint32` | 4 | Big-Endian | Acknowledgement sequence number. In DATA frames, mirrors last accepted ACK. |
| **14 – 15** | `windowSize` | `uint16` | 2 | Big-Endian | Advertised flow-control window size $W$ from sender/receiver. |
| **16 – 17** | `payloadLength` | `uint16` | 2 | Big-Endian | Size of trailing payload in bytes ($0 \le L_{payload} \le 1400$). |
| **18 – 21** | `sessionId` | `uint32` | 4 | Big-Endian | Unique 32-bit transfer session identifier. Prevents crosstalk across runs. |
| **22 – 23** | `checksum` | `uint16` | 2 | Big-Endian | RFC 1071 16-bit 1's complement Internet Checksum computed over header and payload. |
| **24 – 31** | `timestampMicros`| `uint64` | 8 | Big-Endian | High-resolution microsecond timestamp recorded at transmission instant. |
| **32+** | `payload` | `Buffer` | $N$ | N/A | Raw application data chunk (default chunk size: 1024 bytes). |

---

## 3. Binary Packet Format Diagram

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Magic (0x4142)       |    Version    |   Msg Type    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     Flags     |   Reserved    |        Sequence Number        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     Sequence Number (cont)    |     Acknowledgement Number    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Acknowledgement Number (cont)|          Window Size          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         Payload Length        |           Session ID          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|       Session ID (cont)       |       Internet Checksum       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                   Timestamp (Microseconds, 64-bit)            |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                            Payload ...                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

---

## 4. RFC 1071 16-Bit Internet Checksum

### 4.1 Calculation Algorithm
The checksum field is computed according to standard IETF RFC 1071:
1. The 16-bit checksum field at byte offset `22` is initialized to `0x0000`.
2. Adjacent 8-bit bytes are paired into 16-bit integers and accumulated using 32-bit addition.
3. If an odd byte remains, it is padded with trailing zero byte `0x00` and added.
4. Carries beyond 16 bits are folded back into the lower 16 bits until the sum fits in 16 bits:
   $$sum \leftarrow (sum \ \& \ \text{0xFFFF}) + (sum \gg 16)$$
5. The 1's complement of the result is inverted:
   $$checksum = \sim sum \ \& \ \text{0xFFFF}$$

### 4.2 Verification on Arrival
Upon receiving a datagram at the destination:
1. The packet copy has its checksum field zeroed.
2. The recalculation algorithm is applied across the entire packet buffer.
3. If the newly calculated checksum strictly equals the header's checksum field, the packet is intact.
4. Any mismatch triggers an immediate frame drop before processing.

---

## 5. End-to-End SHA-256 Digest Verification

To provide bit-exact verification of reconstructed payloads across unreliable transport:
1. Prior to transmission, the sender computes the standard cryptographic SHA-256 digest of the complete file buffer:
   $$H_{source} = \text{SHA-256}(Buffer_{source})$$
2. As chunks arrive at the receiver, in-order reassembly buffers store and sequence slices.
3. Upon receiving the `FIN` frame, the receiver concatenates all acknowledged chunks:
   $$Buffer_{reconstructed} = \bigoplus_{k=0}^{N-1} Chunk[k]$$
4. The receiver calculates:
   $$H_{reconstructed} = \text{SHA-256}(Buffer_{reconstructed})$$
5. If $H_{source} == H_{reconstructed}$, the transmission is validated as $100\%$ bit-exact. Any single-bit transposition or drop triggers verification failure.
