# UI Verification Proof: On-Chain `UNSTABLE` Case (`19f9bad34102`)

## 1. On-Chain Case & RPC Coordinates
- **Contract Address**: `0x2cb49A03fcc9b8c65E3cd9348826b2d13808d8FE`
- **Case ID**: `19f9bad34102`
- **Title**: `Cross-Border Escrow & SLA Addendum Attribution Dispute`
- **`open_case` Tx**: `0xeb96d6421daac8e85e7648517452fae593ca15b6ab51e2c793b29b6569b0e00b`
- **Party 1 `add_evidence` Tx**: `0xb77ac30acb220664c574941c463ac9b5d2899655baee3fe6e0ce1882056314f7`
- **Party 1 `mark_ready` Tx**: `0xe83357fdf5e64f6062b7ebdb71a923c4a4289e320cf1a5dd0f8c0cead0574f29`
- **Party 2 `add_evidence` Tx**: `0x90a35868f67391f5bd9d5284afc7008f87977e42c3f33f9031fe62626e7408c5`
- **Party 2 `mark_ready` Tx**: `0xcf01f31e39c003de1a280b19dd0d1754c2fc57db455ddd353b463845beac5ef6`
- **`judge` Tx**: `0xfd6a4e5acb7404ff8d060a5618246a98e535a66641e18fe23ffbe488c81b92de`
- **RPC View Call**: `get_certificate("19f9bad34102")`
- **Field Read**: `status = "OPEN"`, `current_decision = "UNSTABLE|NONE|UNSTABLE"`, `rounds[0].decision = "UNSTABLE|NONE|UNSTABLE"`, `ready = {"PARTY_1":false,"PARTY_2":false}`

## 2. Rendered DOM Assertions (All 4 Demo Cases A, B, C, D)
- **Demo A (`43288877b73b`)**: badge `stable` (`STABLE`), title `STABLE CERTIFICATE`
- **Demo B (`6df124828b58`)**: badge `insufficient` (`INSUFFICIENT EVIDENCE`), title `INSUFFICIENT EVIDENCE`
- **Demo C (`f9462ef8b2b5`)**: badge `split` (`SPLIT VERDICT`), title `SPLIT DETERMINATION`
- **Demo D (`19f9bad34102`)**: badge `unstable` (`UNSTABLE`), title `UNSTABLE CERTIFICATE`, status `OPEN (Evidence reopened for Round 2)`
- **Standalone `STABLE` matches on Demo D page (`/(?<!UN)STABLE/`)**: `0`
- **Screenshot**: `docs/unstable_case_19f9bad34102.png`

## 3. Captured Visible Text from Rendered Workbench (`/#/app?case=19f9bad34102`)
```text
Second-Opinion Desk
Bias-Cancelled On-Chain Adjudication
Overview
Workbench
GenLayer Studionet (Preview)
Contract
Connect Wallet
Dispute Workbench
GenLayer Studionet (Preview)

How to try it: Open -> Add evidence & Mark ready -> Judge -> Acknowledge -> Settle on Consumer.

Connect Wallet
Cases
Open
Evidence
Judge
On-Chain Demos (Schema 2.0.0)
No Wallet Required
Demo A (Both Ready + Dual Ack)
43288877b73b
Both parties mark ready -> CLOSED -> judge -> both acknowledge -> FINAL (SETTLED_PARTY_1).
FINAL | DECIDED | PARTY 1
Inspect
Demo B (10m Timeout Close)
6df124828b58
Party 2 silent across 600s window -> close_evidence -> INSUFFICIENT -> FINAL (ESCALATED).
FINAL | INSUFFICIENT | NONE
Inspect
Demo C (5m Review Window Close)
f9462ef8b2b5
Balanced SLA claims -> SPLIT verdict -> 1 party ack + 300s review window -> FINAL (SETTLED_SPLIT).
FINAL | DECIDED | SPLIT
Inspect
Demo D (Unstable -> Reopened)
19f9bad34102
Canonical and mirrored passes diverge -> UNSTABLE -> auto-reopened to OPEN for Round 2.
OPEN (Round 2) | UNSTABLE
Inspect
Query
RECENT CASES ON STUDIONET:
7923db9ec56d
f9462ef8b2b5
6df124828b58
a743e1847131
6a1696f2cc64
ID: 19f9bad34102
Status: OPEN (Evidence reopened for Round 2)
Schema 2.0.0
Cross-Border Escrow & SLA Addendum Attribution Dispute
4-PHASE DISPUTE LIFECYCLE
Role: Observer (Read-Only)
01 / OPEN
Evidence & Readiness
02 / CLOSED
Ready for Judging
03 / JUDGED
Review & Acknowledge
04 / FINAL
Closed & Settleable
OPEN (Evidence reopened for Round 2)

Round 1 was UNSTABLE -- evidence reopened for Round 2 with a fresh 10-minute window. Both parties must mark ready again (or wait for the deadline) before re-judging.

PHASE 1: EVIDENCE & READINESS WINDOW (10M)
Window expired -- either party may close evidence
Evidence Deadline: 2026-10-11T18:32:58 UTC (unix: 1791743578)
Party 1: Submitting (1/3 items)
Party 2: Submitting (1/3 items)
Mark ready
Close evidence
Connect as Party 1 or Party 2 to submit evidence, mark ready, or close the window.
AUTHORITATIVE VERDICT
UNSTABLE
UNSTABLE CERTIFICATE
The mirrored evaluation changed the outcome enough to require another round or additional evidence.
On-chain Decision String:
UNSTABLE|NONE|UNSTABLE
CONSENSUS ROUND HISTORY
01
Round 1
UNSTABLE|NONE|UNSTABLE
ADJUDICATION CRITERIA & WEIGHTS
Which party substantiated compliance with the primary API latency benchmark and addendum: PARTY_1 or PARTY_2?
50%
Which party is designated as the compliant operator under the joint audit addendum: PARTY_1 or PARTY_2?
50%
SUBMITTED EVIDENCE (2)
Max 3 entries/party
Party 1 (Opener)
Entry #1

Joint Escrow Audit Log #882: Independent auditor confirms Meridian Labs met the baseline telemetry threshold, and the signed settlement addendum explicitly designates PARTY_1 as the compliant operator for both latency_be...

Read full entry
Party 2 (Opposing)
Entry #2

Joint Escrow Audit Log #882 Counter-Statement: Solstice Digital acknowledges the independent audit log and confirms the signed settlement addendum explicitly designates PARTY_1 as the compliant operator for both latency_...

Read full entry
PARTY 1 (OPENER)
Ready: No | Ack: No
0x7e34ca893DD193f3ef910E6114eD710fD444a878
Aliases: Meridian, Meridian Labs
PARTY 2 (OPPOSING)
Ready: No | Ack: No
0xA8feCE721C6DCD915e6d06D798d5c0Eda673262b
Aliases: Solstice, Solstice Digital
Downstream Consumer Settlement
outcome_for_consumer: PENDING
Settle on Consumer
Requires case status FINAL before settlement
Second-Opinion Desk

A decentralized dispute adjudication workbench powered by MirrorJudge on GenLayer Studionet (Preview). Enforces a 4-phase readiness and closing lifecycle (`OPEN -> CLOSED -> JUDGED -> FINAL`) and dual-pass mirrored evaluation under validator consensus.

Zero gas price network | Pure Python Intelligent Contracts on GenVM
CONTRACTS (STUDIONET)
MirrorJudge (0x2cb4...d8FE)
Consumer (0xEC8B...9251)
SOURCE REPOSITORIES
Contract Repo (MirrorJudge)
dApp Repo (Second-Opinion Desk)
Released under MIT License. GenLayer Studionet (Preview) (Chain ID 61999).
Deterministic Dual-Pass Architecture (Schema 2.0.0)
```
