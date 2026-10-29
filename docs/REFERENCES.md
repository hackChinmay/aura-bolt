# Academic & Standards References

This document lists authoritative standards, foundational papers, and academic research relevant to the AURA-BOLT framework. All entries are verified publications.

---

## 1. Classical ARQ & Reliable Transport Foundations

1. **Bartlett, K. A., Scantlebury, R. A., & Wilkinson, P. T.** (1969).  
   *A note on reliable full-duplex transmission over half-duplex links.*  
   Communications of the ACM, 12(5), 260–261.  
   *(Foundational specification of the Alternating Bit Protocol / Stop-and-Wait ARQ).*

2. **Cerf, V., & Kahn, R.** (1974).  
   *A Protocol for Packet Network Intercommunication.*  
   IEEE Transactions on Communications, 22(5), 637–648.  
   *(Introduced sliding-window flow control and end-to-end reliable transmission).*

3. **Tanenbaum, A. S., & Wetherall, D. J.** (2011).  
   *Computer Networks (5th Edition).*  
   Prentice Hall. ISBN: 978-0132126953.  
   *(Reference textbook for sliding-window invariant $W_s + W_r \le M$, Go-Back-N, and Selective Repeat protocol analysis).*

---

## 2. Timing, RTO Estimation & Congestion Control

4. **Jacobson, V.** (1988).  
   *Congestion Avoidance and Control.*  
   ACM SIGCOMM Computer Communication Review, 18(4), 314–329.  
   *(Standard smoothed RTT variance and RTO backoff estimator: $RTO = SRTT + 4 \cdot RTTVAR$).*

5. **Karn, P., & Partridge, C.** (1987).  
   *Improving Round-Trip Time Estimates in Reliable Transport Protocols.*  
   ACM SIGCOMM Computer Communication Review, 17(5), 2–7.  
   *(Karn's algorithm: ambiguity resolution prohibiting RTT sampling from retransmitted segments).*

6. **Cardwell, N., Cheng, Y., Gunn, C. S., Yeganeh, S. H., & Jacobson, V.** (2017).  
   *BBR: Congestion-Based Congestion Control.*  
   Communications of the ACM, 60(2), 58–66.  
   *(Probing Bandwidth-Delay Product pipe bounds without treating all loss as congestion).*

---

## 3. Burst-Loss Channel Modeling

7. **Gilbert, E. N.** (1960).  
   *Capacity of a Burst-Noise Channel.*  
   Bell System Technical Journal, 39(5), 1253–1265.  
   *(Original 2-state discrete Markov chain formulation for correlated error bursts).*

8. **Elliott, E. O.** (1963).  
   *Estimates of Error Rates for Codes on Burst-Noise Channels.*  
   Bell System Technical Journal, 42(5), 1977–1997.  
   *(Extension of Gilbert model introducing non-zero error probabilities in the Good state).*

9. **Park, S. K., & Miller, K. W.** (1988).  
   *Random number generators: good ones are hard to find.*  
   Communications of the ACM, 31(10), 1192–1201.  
   *(31-bit Linear Congruential Generator used for deterministic reproducible simulation).*

---

## 4. Internet Standards & Cryptographic Specifications

10. **Postel, J.** (1980).  
    *User Datagram Protocol.*  
    IETF RFC 768. Standard Internet Protocol.  
    URL: https://www.rfc-editor.org/rfc/rfc768

11. **Braden, R., Borman, D., & Partridge, C.** (1988).  
    *Computing the Internet Checksum.*  
    IETF RFC 1071. Informational RFC.  
    URL: https://www.rfc-editor.org/rfc/rfc1071

12. **Mathis, M., Mahdavi, J., Floyd, S., & Romanow, A.** (1996).  
    *TCP Selective Acknowledgment Options.*  
    IETF RFC 2018. Standards Track.  
    URL: https://www.rfc-editor.org/rfc/rfc2018

13. **Paxson, V., Allman, M., Chu, J., & Sargent, M.** (2011).  
    *Computing TCP's Retransmission Timer.*  
    IETF RFC 6298. Standards Track.  
    URL: https://www.rfc-editor.org/rfc/rfc6298

14. **National Institute of Standards and Technology (NIST)**. (2015).  
    *Secure Hash Standard (SHS).*  
    Federal Information Processing Standards Publication (FIPS PUB) 180-4.  
    DOI: 10.6028/NIST.FIPS.180-4  
    *(Formal specification for SHA-256 cryptographic digest verification).*
