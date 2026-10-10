# UI Verification Proof: On-Chain `UNSTABLE` Case (`cbbed41fefc3`)

## 1. On-Chain Case & RPC Coordinates
- **Production URL**: `https://second-opinion-desk-genlayer.vercel.app/#/app?case=cbbed41fefc3`
- **Contract Address**: `0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D`
- **Case ID**: `cbbed41fefc3`
- **Title**: `Cross-Border Escrow & SLA Addendum Attribution Dispute`
- **`open_case` Tx**: `0xa3e30f86e5677c7b069b3c42bd2769a6f90e27570cca39c24a2017151e4ff2aa`
- **Party 1 `add_evidence` Tx**: `0x1edb1ec2e78ab87cb4396d5548df6426ea47615f36ac4249f73455c9355b3bae`
- **Party 2 `add_evidence` Tx**: `0xa4605d01bf0f17c5ca6264f75f355d9f4a351343058e69021a28eb94c774f8bd`
- **`judge` Tx**: `0x8472dbad8e0bdc0f3049db16ca509e3b539a5d938b2bff5a389aff2d16e2c3a2`
- **RPC View Call**: `get_certificate("cbbed41fefc3")`
- **Field Read**: `current_decision = "UNSTABLE|NONE|UNSTABLE"`, `rounds[0].decision = "UNSTABLE|NONE|UNSTABLE"`

## 2. Rendered DOM Assertions (Live Production Site)
- **Badge text**: `UNSTABLE`
- **Certificate title**: `UNSTABLE CERTIFICATE`
- **On-chain Decision String**: `UNSTABLE|NONE|UNSTABLE`
- **Standalone `STABLE` matches on page (`/(?<!UN)STABLE/gi`)**: `0`
- **Screenshot**: `docs/unstable_case_cbbed41fefc3.png`

## 3. Captured Visible Text from Live Production Workbench (`https://second-opinion-desk-genlayer.vercel.app/#/app?case=cbbed41fefc3`)
```text
Second-Opinion Desk
Bias-Cancelled On-Chain Adjudication
Overview
Workbench
GenLayer Studionet
Contract
Connect Wallet
Dispute Workbench
GenLayer Studionet

MirrorJudge does not require a payment value for case creation, evidence, or adjudication.

Connect Wallet
Cases
Open
Evidence
Judge
On-Chain Demos
No Wallet Required
Demo A
0551168cd4f5
Clear-cut milestone delivery verified via git logs.
DECIDED · PARTY 1
Inspect
Demo B
4e4a3aa372e6
Missing counterparty evidence resolved deterministically without LLM bias.
INSUFFICIENT · NONE
Inspect
Demo C
8f128188b6c6
Balanced deliverable landing within tolerance threshold.
DECIDED · SPLIT
Inspect
Demo D
cbbed41fefc3
Ambiguous addendum attribution where canonical and mirrored passes diverge.
UNSTABLE · NONE · UNSTABLE
Inspect
Query
RECENT CASES ON STUDIONET:
cbbed41fefc3
6c8f8cd1415a
8f128188b6c6
4e4a3aa372e6
0551168cd4f5
ID: cbbed41fefc3
Status: OPEN
Cross-Border Escrow & SLA Addendum Attribution Dispute
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
PARTY 1
0x1d0f0b77EaE3CeA5071470795cd1BC9e25Ab8156
Aliases: Meridian, Meridian Labs
PARTY 2
0xC8014F4390875FA6B3f2E90010739FD4D3b14607
Aliases: Solstice, Solstice Digital
Downstream Consumer Integration
Outcome: PENDING
Second-Opinion Desk

A decentralized dispute adjudication workbench powered by MirrorJudge on GenLayer Studionet Preview. Validates LLM position invariance via dual-pass canonical and mirrored evaluation under validator consensus.

Zero gas price network • Pure Python Intelligent Contracts on GenVM
CONTRACTS (STUDIONET)
MirrorJudge Core
Consumer Settlement
SOURCE REPOSITORIES
Contract Repo (MirrorJudge)
dApp Repo (Second-Opinion Desk)
Released under MIT License. GenLayer Studionet Preview (Chain ID 61999).
Deterministic Dual-Pass Architecture
```
