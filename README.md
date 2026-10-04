# Second-Opinion Desk

> **Bias-Cancelled Dispute Adjudication Workbench on GenLayer Studionet Preview**

Second-Opinion Desk is the official dApp interface for **MirrorJudge**, an Intelligent Contract deployed on GenLayer Studionet Preview. It solves the critical vulnerability of LLM position bias by evaluating dispute evidence twice: first canonically, then mirrored (parties swapped, criteria inverted, evidence re-ordered). Only verdicts that withstand their own mirror image receive a stability certificate.

- **Canonical Contract Repository**: [huzyow155/mirrorjudge-genlayer](https://github.com/huzyow155/mirrorjudge-genlayer)
- **Local Contract Reference**: [`contracts-reference/MirrorJudge.py`](./contracts-reference/MirrorJudge.py) (unmodified byte-for-byte copy)
- **Deployed Intelligent Contract**: `0x30552D40A956d2D753AbAD429c90cB07f65Dabd0`
- **Downstream Consumer Contract**: `0x6E295655a39A5f9aDFF8B087497737788aCC8881`
- **GenLayer Explorer**: [View on Explorer](https://explorer-studio.genlayer.com/address/0x30552D40A956d2D753AbAD429c90cB07f65Dabd0)

---

## Deployed Source Code Integrity

The intelligent contract code deployed on GenLayer Studionet Preview matches the local reference file byte-for-byte:

- **Deploy Transaction Hash**: `0xb49227544fa1e4ba1631c8b422cf42438f5d355480a14540972509660693d5c7`
- **Local Source Hash (SHA256)**: `1f4c4f1bdf5e58177adc780fafe5bfa22c6f786d6e78e3585062c98c2bacf1ee`
- **Deployed Source Hash (SHA256)**: `1f4c4f1bdf5e58177adc780fafe5bfa22c6f786d6e78e3585062c98c2bacf1ee`
- **Verification Method**: `eth_getTransactionByHash` on deploy tx -> base64-decode `data.contract_code` -> sha256 -> compare to local file hash.
- **Match Result**: `true` (verified via `scripts/test_live_reads.mjs`)

---

## Two-Page Architecture (Zero Content Overlap)

1. **Landing Page (`/`)**:
   - Pure marketing and technical explainer.
   - Explains the position-bias flaw in commercial LLMs and how dual-pass mirroring cancels it deterministically.
   - Clarifies why GenLayer is mandatory (consensus execution of non-deterministic LLM calls on-chain).
   - Contains a single, clear **"Launch Dispute Workbench"** CTA button.
   - Contains **zero wallet connections, zero live contract reads, and zero case data**.

2. **Workbench Page (`/app`)**:
   - Complete interactive dispute operations interface.
   - **No-Wallet View**: Persistent on-chain demo cases browsable immediately via public view methods without connecting any wallet.
   - **Wallet Connection (EIP-6963)**: Multi-wallet discovery (MetaMask, Rabby, etc.) with explicit cross-extension and account switching.
   - **Zero-Gas Guidance**: Clear notice explaining that Studionet transactions use 0 gas price and 0-GEN wallets can transact without funding.
   - **Case Specification Builder**: 2 to 4 criteria summing to 10,000 bp (100%), opposing address, and party aliases.
   - **Client-Side Discovery**: Discovers newly opened `case_id` values using `get_latest_case_for_pair` (never calculates hashes locally).
   - **Evidence Submission**: Party 1 and Party 2 submissions (up to 3 items per party, $\le 1200$ chars with live counter).
   - **Consensus Adjudication (`judge()`)**: Multi-step waiting modal with live elapsed-time ticker tracking the 19s to 55s validator consensus process.
   - **Stability Certificate Viewer**: Live breakdown of stability status, criteria weights, evidence entries, and round history.
   - **Downstream Consumer Integration**: Inspects `outcome_for_consumer` and triggers `settle_dispute` on the escrow contract.

---

## Persistent On-Chain Demos (No Wallet Needed)

Reviewers can inspect these verified, immutable cases on Studionet immediately without a wallet:

| Demo | Case ID | Category | Verdict | Key Characteristic |
| :--- | :--- | :--- | :--- | :--- |
| **Demo A** | `ebe94dc89329` | Software Milestone | `DECIDED\|PARTY_1\|STABLE` | Clear-cut deliverable with git commit proof and counterparty confirmation. |
| **Demo B** | `8408ccd5e6ef` | Joint Deliverable | `DECIDED\|SPLIT\|STABLE` | Balanced performance where both parties delivered, landing within margin threshold. |
| **Demo C** | `36449cc60579` | Infrastructure SLA | `DECIDED\|PARTY_1\|STABLE` | Multi-round escalation: Round 1 `INSUFFICIENT` &rarr; Round 2 `STABLE` with uptime logs. |

---

## How to Try It (Step-by-Step)

### Option 1: Live Web App
1. Open the deployed application URL.
2. Review the marketing explainer on the landing page, then click **"Launch Dispute Workbench"**.
3. On `/app`, explore **Demo A**, **Demo B**, and **Demo C** without connecting a wallet. Inspect criteria, evidence logs, and stability certificates.
4. Click **"Connect Wallet"** to connect via MetaMask or Rabby (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`).
5. Open a new dispute with 2-4 criteria summing to 10,000 basis points.
6. Switch accounts / extensions using the **"Switch Wallet"** button to simulate Party 2.
7. Submit evidence from both parties ($\le 1200$ characters each).
8. Click **"Execute judge()"** and observe the live multi-step consensus progress modal (takes ~19s to 55s).
9. Read back the resulting Stability Certificate and trigger downstream consumer settlement.

### Option 2: Local Development
```bash
git clone https://github.com/huzyow155/second-opinion-desk-genlayer.git
cd second-opinion-desk-genlayer
npm install
npm run dev
```

Run test suite and live read verification:
```bash
node scripts/test_live_reads.mjs
npm run build
```

---

## 5-Gate Verification Matrix

| Gate | Description | Status | Verification Detail |
| :---: | :--- | :---: | :--- |
| **1** | Real UI Caller Verification | **PASSED** | Live contract calls verified against Studionet via `genlayer-js`. |
| **2** | Positive + Negative No-Wallet Check | **PASSED** | Positive: Demos A, B, and C return real data. Negative: `nonexistent99` safely returns `{}`. |
| **3** | 0-GEN Funding Guidance | **PASSED** | Persistent notice banner informs users that Studionet transactions use 0 gas price. |
| **4** | Full Flow Latency Documented | **PASSED** | Dual-pass consensus takes 19s-55s (tracked with real-time UI timer). |
| **5** | Banned Wording Grep | **PASSED** | Zero occurrences of banned terminology across all files and documentation. |

---

## Tech Stack

- **Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, custom soft sage neumorphic surface depth
- **SDK**: `genlayer-js` 1.1.8
- **Wallets**: EIP-6963 multi-wallet standard, MetaMask, Rabby
- **Deployment**: Vercel CLI (SPA configuration)

---

## License

MIT License. Developed for the GenLayer Studionet Preview developer ecosystem.
