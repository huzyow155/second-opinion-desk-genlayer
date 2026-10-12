# Second-Opinion Desk

> **Bias-Cancelled Dispute Adjudication Workbench on GenLayer Studionet (Preview)**

Second-Opinion Desk is the official dApp interface for **MirrorJudge** (`SCHEMA_VERSION = "2.0.0"`), an Intelligent Contract deployed on GenLayer Studionet (Preview). It solves the critical vulnerability of LLM position bias by evaluating dispute evidence twice: canonically and then mirrored (parties swapped, criteria inverted, evidence re-ordered), enforced behind a 4-phase evidence-closing and readiness protocol (`OPEN -> CLOSED -> JUDGED -> FINAL`). Verdicts that withstand their own mirror image receive a stability certificate.

---

## Current Deployed Addresses (`SCHEMA_VERSION = "2.0.0"`, GenLayer Studionet (Preview))

| Role | Contract Address | Deploy Transaction Hash | Explorer Link |
| :--- | :--- | :--- | :--- |
| **MirrorJudge (Intelligent Contract)** | `0x2cb49A03fcc9b8c65E3cd9348826b2d13808d8FE` | `0x44ba27e9354b15b01724ab824b229f26d599d6a92a814e44653ec446c7d7ca55` | [Explorer](https://explorer-studio.genlayer.com/address/0x2cb49A03fcc9b8c65E3cd9348826b2d13808d8FE) |
| **MirrorJudgeConsumer (Escrow / Downstream)** | `0xEC8B7B09AE03cef02ae42bCD8ba28C530D809251` | `0x3d4401d91c6c4688098ce28a07ae35708767e3967266e844d294aa88b530e4f1` | [Explorer](https://explorer-studio.genlayer.com/address/0xEC8B7B09AE03cef02ae42bCD8ba28C530D809251) |

- **Production Preview URL**: [https://second-opinion-desk-genlayer.vercel.app](https://second-opinion-desk-genlayer.vercel.app)
- **Canonical Contract Repository**: [huzyow155/mirrorjudge-genlayer](https://github.com/huzyow155/mirrorjudge-genlayer)
- **Local Contract Reference**: [`contracts-reference/MirrorJudge.py`](./contracts-reference/MirrorJudge.py) and [`contracts-reference/consumer.py`](./contracts-reference/consumer.py) (unmodified byte-for-byte copies)
- **Network Coordinates**: GenLayer Studionet (Preview), Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`

### Superseded Historical Deployments

| Address | Role | Superseded Reason |
| :--- | :--- | :--- |
| `0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D` | MirrorJudge (v1.0.0) | Superseded by v2.0.0 with enforceable 4-phase evidence-closing and readiness lifecycle |
| `0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837` | Consumer (v1.0.0) | Pointed to superseded v1.0.0 MirrorJudge address |
| `0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17` | MirrorJudge | Pre-hardening deployment lacking strict criterion weight bounds |
| `0x294FFDec366826F8682CFAAEbaf25DcAeBda9317` | Consumer | Pointed to superseded MirrorJudge address |
| `0x30552D40A956d2D753AbAD429c90cB07f65Dabd0` | MirrorJudge | Early prototype (unhardened LLM prompt) |
| `0xd146F4102dCca75dF2977091A3aFd3307D236f78` | MirrorJudgeCore | Milestone 1 core prototype |
| `0x2106760ca2BD2a55be57A8B68373F65afCdc2Fe2` | Probe | Milestone 0 runtime diagnostic |

---

## Deployed Source Code Integrity

The intelligent contract code deployed on GenLayer Studionet (Preview) matches the local reference files byte-for-byte:

- **MirrorJudge (`contracts-reference/MirrorJudge.py`)**:
  - **Deploy Transaction Hash**: `0x44ba27e9354b15b01724ab824b229f26d599d6a92a814e44653ec446c7d7ca55`
  - **Local Source Hash (SHA256)**: `283f756ac2f0d140a4a37d94427b55ad9a24a2c5ac57f74c72ac025b38b578de`
  - **Deployed Source Hash (SHA256)**: `283f756ac2f0d140a4a37d94427b55ad9a24a2c5ac57f74c72ac025b38b578de`
  - **Match Result**: `true`
- **MirrorJudgeConsumer (`contracts-reference/consumer.py`)**:
  - **Deploy Transaction Hash**: `0x3d4401d91c6c4688098ce28a07ae35708767e3967266e844d294aa88b530e4f1`
  - **Local Source Hash (SHA256)**: `d78391907a407d84bf4d9a9da4ef7f257176a4484b72e86f598bd9ea500ed8ad`
  - **Deployed Source Hash (SHA256)**: `d78391907a407d84bf4d9a9da4ef7f257176a4484b72e86f598bd9ea500ed8ad`
  - **Match Result**: `true`
- **Verification Method**: `eth_getTransactionByHash` on deploy tx -> base64-decode `data.contract_code` -> sha256 -> compare to local file hash (`node scripts/test_live_reads.mjs`).

---

## 4-Phase Readiness & Finalization Lifecycle (`SCHEMA_VERSION = "2.0.0"`)

| Phase | Status | Permitted Actions & Guardrails | Transition Rule |
| :---: | :---: | :--- | :--- |
| **1** | `OPEN` | `add_evidence` ($\le 3$ items/party, $\le 1200$ chars) before `evidence_deadline_ts` (`+600s`) and before party calls `mark_ready`. `mark_ready` requires $\ge 1$ evidence item from caller. | Auto-transitions to `CLOSED` when both parties mark ready, or via `close_evidence` once `now >= evidence_deadline_ts`. |
| **2** | `CLOSED` | Only `party_1` or `party_2` may call `judge(case_id)`. No new evidence may be added while `CLOSED`. | `DECIDED\|*\|STABLE` $\to$ `JUDGED` (sets `judged_at_ts`). `INSUFFICIENT\|NONE\|NA` $\to$ `FINAL`. `UNSTABLE\|NONE\|UNSTABLE` $\to$ reopens `OPEN` with fresh `600s` window and reset `ready` flags. |
| **3** | `JUDGED` | Only `party_1` or `party_2` may call `finalize(case_id)`. Each party may acknowledge at most once. | Transitions to `FINAL` when both parties acknowledge (`final_acks` both `true`), or when a party calls `finalize` after `judged_at_ts + 300s`. |
| **4** | `FINAL` | Terminal state (`"case is closed"`). `outcome_for_consumer` unlocks (`"PARTY_1"`, `"PARTY_2"`, `"SPLIT"`, or `"NO_DECISION"`). | Downstream `MirrorJudgeConsumer.settle_dispute(case_id)` executes once (`"already settled"` on repeat calls; `"dispute is still pending"` before `FINAL`). |

---

## Persistent On-Chain Demos (No Wallet Needed)

Reviewers can inspect these verified cases on GenLayer Studionet (Preview) immediately without a wallet:

| Demo | Case ID | Category | Lifecycle Path | Status | Verdict |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Demo A** | `43288877b73b` | Software Milestone | Both parties `mark_ready` $\to$ `judge` $\to$ dual-ack `finalize` $\to$ `SETTLED_PARTY_1` | `FINAL` | `DECIDED\|PARTY_1\|STABLE` |
| **Demo B** | `6df124828b58` | Commercial Lease | One-sided evidence + `600s` window expiry $\to$ `close_evidence` $\to$ `judge` $\to$ `ESCALATED_TO_ARBITRATOR` | `FINAL` | `INSUFFICIENT\|NONE\|NA` |
| **Demo C** | `f9462ef8b2b5` | Infrastructure SLA | Both parties `mark_ready` $\to$ `judge` $\to$ P1 ack + `300s` review window `finalize` $\to$ `SETTLED_SPLIT` | `FINAL` | `DECIDED\|SPLIT\|STABLE` |
| **Demo D** | `19f9bad34102` | Escrow Addendum | Both parties `mark_ready` $\to$ `judge` (`UNSTABLE`) $\to$ automatically reopened to `OPEN` for Round 2 | `OPEN` | `UNSTABLE\|NONE\|UNSTABLE` |

### On-Chain Verification of `UNSTABLE` Case (`19f9bad34102`)

`UNSTABLE` means the canonical and mirrored passes disagreed, so no verdict is issued: the contract automatically reopens the case (`status = "OPEN"`, `ready = {"PARTY_1": false, "PARTY_2": false}`, `is_decided = false`, `outcome_for_consumer = "PENDING"`) with a fresh 600-second evidence window so both parties can submit Round 2 evidence.

- **`open_case` Tx**: `0xeb96d6421daac8e85e7648517452fae593ca15b6ab51e2c793b29b6569b0e00b`
- **Party 1 `add_evidence` Tx**: `0xb77ac30acb220664c574941c463ac9b5d2899655baee3fe6e0ce1882056314f7`
- **Party 1 `mark_ready` Tx**: `0xe83357fdf5e64f6062b7ebdb71a923c4a4289e320cf1a5dd0f8c0cead0574f29`
- **Party 2 `add_evidence` Tx**: `0x90a35868f67391f5bd9d5284afc7008f87977e42c3f33f9031fe62626e7408c5`
- **Party 2 `mark_ready` Tx**: `0xcf01f31e39c003de1a280b19dd0d1754c2fc57db455ddd353b463845beac5ef6`
- **`judge` Tx**: `0xfd6a4e5acb7404ff8d060a5618246a98e535a66641e18fe23ffbe488c81b92de` (`ACCEPTED`, `leaderResult: SUCCESS`, `26.66s`)
- **RPC View Call**: `readContract({ address: "0x2cb49A03fcc9b8c65E3cd9348826b2d13808d8FE", functionName: "get_certificate", args: ["19f9bad34102"] })`
- **Field Read**: `JSON.parse(certificate).current_decision === "UNSTABLE|NONE|UNSTABLE"`, `status === "OPEN"`, and `is_decided === false`
- **UI Verification Proof**: [`docs/UNSTABLE_CASE_UI_PROOF.md`](./docs/UNSTABLE_CASE_UI_PROOF.md) and [`docs/unstable_case_19f9bad34102.png`](./docs/unstable_case_19f9bad34102.png)

---

## Two-Page Architecture (Zero Content Overlap)

1. **Landing Page (`/`)**:
   - Marketing and technical explainer.
   - Explains the position-bias flaw in commercial LLMs, how dual-pass mirroring cancels it deterministically, and the 4-phase evidence-closing and finalization protocol.
   - Clarifies why GenLayer is mandatory (consensus execution of non-deterministic LLM calls on-chain).
   - Contains a clear **"Launch Dispute Workbench"** CTA button.
   - Contains **zero wallet connections, zero contract reads, and zero case data**.

2. **Workbench Page (`/app`)**:
   - Complete interactive dispute operations interface.
   - **No-Wallet View**: Persistent on-chain demo cases browsable immediately via public view methods without connecting any wallet.
   - **Wallet Connection (EIP-6963)**: Multi-wallet discovery (MetaMask, Rabby, etc.) with explicit cross-extension switching between Party 1 and Party 2.
   - **Zero-Gas Guidance**: Clear notice explaining that MirrorJudge does not require a payment value for case creation, evidence, or adjudication.
   - **Case Specification Builder**: 1 to 6 criteria summing to 10,000 bp (100%), opposing address, and party aliases with strict integer weight validation (`1 <= weight_bp <= 10000`).
   - **Client-Side Discovery**: Discovers newly opened `case_id` values using `get_latest_case_for_pair` (never calculates hashes locally).
   - **4-Phase Readiness & Finalization Stepper**: Displays on-chain `OPEN -> CLOSED -> JUDGED -> FINAL` progression, per-party readiness chips (`ready.PARTY_1`, `ready.PARTY_2`), evidence deadline and review window countdowns, `mark_ready`, `close_evidence`, party-gated `judge()`, and dual-acknowledgment `finalize()`.
   - **Stability Certificate Viewer**: On-chain breakdown of stability status with exact token decision parsing (`parseDecision()`), criteria weights, evidence entries, and round history.
   - **Downstream Consumer Integration**: Inspects `outcome_for_consumer` and triggers `settle_dispute` on the consumer contract once `status == "FINAL"`.

---

## How to Try It (Step-by-Step)

### Option 1: Web App Preview
1. Open the deployed application URL: [https://second-opinion-desk-genlayer.vercel.app](https://second-opinion-desk-genlayer.vercel.app)
2. Review the explainer on the landing page, then click **"Launch Dispute Workbench"**.
3. On `/app`, explore **Demo A**, **Demo B**, **Demo C**, and **Demo D** without connecting a wallet. Inspect the 4-phase lifecycle stepper, criteria, evidence logs, and stability certificates.
4. Click **"Connect Wallet"** to connect via MetaMask or Rabby (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`).
5. Open a new dispute with 1-6 criteria summing to 10,000 basis points.
6. Submit evidence ($\le 1200$ characters) and click **"Mark Evidence Ready"** as Party 1.
7. Switch extensions using the explicit **"Switch Wallet"** button to Party 2, submit evidence, and click **"Mark Evidence Ready"** (auto-transitions `OPEN -> CLOSED`).
8. Click **"Execute judge()"** as either party and observe the consensus progress modal (`CLOSED -> JUDGED`).
9. Acknowledge finalization from both parties (`JUDGED -> FINAL`) and trigger downstream consumer settlement (`settle_dispute`).

### Option 2: Local Development
```bash
git clone https://github.com/huzyow155/second-opinion-desk-genlayer.git
cd second-opinion-desk-genlayer
npm install
npm run dev
```

Run the automated test suite or production build:
```bash
npm run test:parser   # Decision string parser & weight validation unit tests (~1s)
npm run test:e2e      # On-chain 9-step E2E lifecycle + negative checks (~160-200s)
npm run test:ui       # Headless browser UI verification across Demos A, B, C, and D (~15-20s)
npm run test:all      # Full sequential suite: test:parser && test:e2e && test:ui (~180-220s)
npm run build         # Production TypeScript + Vite bundle
```

---

## Automated Verification & End-to-End Test Suite

All test scripts import the single source of truth (`src/config/chain.ts` and `src/services/contractService.ts`) without duplicating contract addresses or receipt-verification logic:

| Script | Command | Expected Runtime | Coverage |
| :--- | :--- | :---: | :--- |
| **Decision & Weight Parser** (`scripts/test_decision_parser.mjs`) | `npm run test:parser` | `~1s` | Verifies exact pipe-delimited token parsing (`DECIDED\|PARTY_1\|STABLE`, `DECIDED\|PARTY_2\|STABLE`, `DECIDED\|SPLIT\|STABLE`, `UNSTABLE\|NONE\|UNSTABLE`, `INSUFFICIENT\|NONE\|NA`), confirms `UNSTABLE\|NONE\|UNSTABLE` has `isStable === false` and `badgeType === 'unstable'`, and tests `validateCriteriaWeights` bounds (`-1`, `0`, `10001`, non-integers, sum $\neq 10000$). |
| **On-Chain E2E** (`scripts/run_fresh_e2e.mjs`) | `npm run test:e2e` | `~160–200s` | Executes a fresh 9-step dispute lifecycle on GenLayer Studionet using real `contractService.ts` functions (`executeOpenCase` $\to$ `executeAddEvidence` P1 $\to$ `executeMarkReady` P1 $\to$ `executeAddEvidence` P2 $\to$ `executeMarkReady` P2 $\to$ `executeJudge` P1 $\to$ `executeFinalize` P1 ack 1 $\to$ `executeFinalize` P2 ack 2 $\to$ `executeConsumerSettle`). Asserts `status_name === 'ACCEPTED'`, every `leader_receipt` entry has `execution_result === 'SUCCESS'`, and `verifyPostWriteState` readback `verified === true` after each write. Also runs negative checks (`open_case` with `weight_bp = -1` and `10001`, nonexistent case lookup `{ ok: true, data: null }`, and unreachable RPC `http://127.0.0.1:9` `{ ok: false }`). Writes full trace to [`scripts/fresh_e2e_evidence.json`](./scripts/fresh_e2e_evidence.json) (latest fresh case `7923db9ec56d`). |
| **Headless Browser Certificate UI** (`scripts/capture_unstable_ui.mjs`) | `npm run test:ui` | `~15–20s` | Launches the production build in headless Chromium (`page.goto` timeout 30s, `waitForSelector` timeout 20s, guaranteed browser close in `finally`), loads Demo A (`43288877b73b`), Demo B (`6df124828b58`), Demo C (`f9462ef8b2b5`), and Demo D (`19f9bad34102`) from Studionet RPC, asserts rendered `data-badge-type` (`stable`, `insufficient`, `split`, `unstable`), verifies `OPEN (Evidence reopened for Round 2)` on Demo D, and confirms `0` standalone `STABLE` occurrences (`/(?<!UN)STABLE/`) on Demo D. |
| **Full Suite** | `npm run test:all` | `~180–220s` | Runs `npm run test:parser && npm run test:e2e && npm run test:ui` sequentially. |

---

## 5-Gate Verification Matrix

| Gate | Description | Status | Verification Detail |
| :---: | :--- | :---: | :--- |
| **1** | Real UI Caller Verification | **PASSED** | On-chain contract calls verified against Studionet via `genlayer-js`. |
| **2** | Positive + Negative No-Wallet Check | **PASSED** | Positive: Demos A, B, C, and D return real data. Negative: `nonexistent99` safely returns `{}`. |
| **3** | 0-GEN Funding Guidance | **PASSED** | Persistent notice informs users: MirrorJudge does not require a payment value for case creation, evidence, or adjudication. |
| **4** | Full Flow Latency Documented | **PASSED** | Dual-pass consensus + 4-phase lifecycle verified on-chain (tracked with real-time UI timer). |
| **5** | Banned Wording Grep | **PASSED** | Zero occurrences of banned terminology across all files and documentation. |

---

## Tech Stack

- **Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, dark charcoal surface with refined silver frames and metallic borders
- **SDK**: `genlayer-js` 1.1.8
- **Wallets**: EIP-6963 multi-wallet standard, MetaMask, Rabby
- **Deployment**: Vercel CLI (SPA configuration)

---

## License

MIT License. Developed for the GenLayer Studionet (Preview) developer ecosystem.
