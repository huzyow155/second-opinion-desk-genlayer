# Second-Opinion Desk

> **Bias-Cancelled Dispute Adjudication Workbench on GenLayer Studionet Preview**

Second-Opinion Desk is the official dApp interface for **MirrorJudge**, an Intelligent Contract deployed on GenLayer Studionet Preview. It solves the critical vulnerability of LLM position bias by evaluating dispute evidence twice: first canonically, then mirrored (parties swapped, criteria inverted, evidence re-ordered). Only verdicts that withstand their own mirror image receive a stability certificate.

- **Production Preview URL**: [https://second-opinion-desk-genlayer.vercel.app](https://second-opinion-desk-genlayer.vercel.app)
- **Canonical Contract Repository**: [huzyow155/mirrorjudge-genlayer](https://github.com/huzyow155/mirrorjudge-genlayer)
- **Local Contract Reference**: [`contracts-reference/MirrorJudge.py`](./contracts-reference/MirrorJudge.py) (unmodified byte-for-byte copy)
- **Deployed Intelligent Contract**: `0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17`
- **Downstream Consumer Contract**: `0x294FFDec366826F8682CFAAEbaf25DcAeBda9317`
- **GenLayer Explorer**: [View on Explorer](https://explorer-studio.genlayer.com/address/0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17)

---

## Deployed Source Code Integrity

The intelligent contract code deployed on GenLayer Studionet Preview matches the local reference file byte-for-byte:

- **Deploy Transaction Hash**: `0x8e6a7c865bd92a00c1c518325347d164842467e881079cbff68958cda1e474bd`
- **Local Source Hash (SHA256)**: `a1bb39e06e6768505c818ab426d5fbd0b95a03b1c45e2e937ab6ad3074da63d8`
- **Deployed Source Hash (SHA256)**: `a1bb39e06e6768505c818ab426d5fbd0b95a03b1c45e2e937ab6ad3074da63d8`
- **Verification Method**: `eth_getTransactionByHash` on deploy tx -> base64-decode `data.contract_code` -> sha256 -> compare to local file hash.
- **Match Result**: `true` (strictly verified via `scripts/test_live_reads.mjs`)

---

## Two-Page Architecture (Zero Content Overlap)

1. **Landing Page (`/`)**:
   - Pure marketing and technical explainer.
   - Explains the position-bias flaw in commercial LLMs and how dual-pass mirroring cancels it deterministically.
   - Clarifies why GenLayer is mandatory (consensus execution of non-deterministic LLM calls on-chain).
   - Contains a single, clear **"Launch Dispute Workbench"** CTA button.
   - Contains **zero wallet connections, zero contract reads, and zero case data**.

2. **Workbench Page (`/app`)**:
   - Complete interactive dispute operations interface.
   - **No-Wallet View**: Persistent on-chain demo cases browsable immediately via public view methods without connecting any wallet.
   - **Wallet Connection (EIP-6963)**: Multi-wallet discovery (MetaMask, Rabby, etc.) with explicit cross-extension switching between Party 1 and Party 2.
   - **Zero-Gas Guidance**: Clear notice explaining that MirrorJudge does not require a payment value for case creation, evidence, or adjudication.
   - **Case Specification Builder**: 2 to 4 criteria summing to 10,000 bp (100%), opposing address, and party aliases.
   - **Client-Side Discovery**: Discovers newly opened `case_id` values using `get_latest_case_for_pair` (never calculates hashes locally).
   - **Evidence Submission**: Party 1 and Party 2 submissions (up to 3 items per party, $\le 1200$ chars with real-time counter).
   - **Consensus Adjudication (`judge()`)**: Multi-step waiting modal with real-time elapsed timer tracking the 19s to 55s validator consensus process.
   - **Stability Certificate Viewer**: On-chain breakdown of stability status, criteria weights, evidence entries, and round history.
   - **Downstream Consumer Integration**: Inspects `outcome_for_consumer` and triggers `settle_dispute` on the consumer contract.

---

## Persistent On-Chain Demos (No Wallet Needed)

Reviewers can inspect these verified, immutable cases on Studionet immediately without a wallet:

| Demo | Case ID | Category | Verdict | Key Characteristic |
| :--- | :--- | :--- | :--- | :--- |
| **Demo A** | `99f9b7444e2a` | Software Milestone | `DECIDED\|PARTY_1\|STABLE` | Clear-cut deliverable with git commit proof and counterparty confirmation. |
| **Demo B** | `affb287df9cb` | Joint Deliverable | `INSUFFICIENT\|NONE\|NA` | Missing required evidence dispute correctly flagged by contract. |
| **Demo C** | `bf29f5d7c7fd` | Infrastructure SLA | `DECIDED\|SPLIT\|STABLE` | Balanced SLA performance with mirrored consensus resulting in equal split. |

---

## How to Try It (Step-by-Step)

### Option 1: Web App Preview
1. Open the deployed application URL.
2. Review the marketing explainer on the landing page, then click **"Launch Dispute Workbench"**.
3. On `/app`, explore **Demo A**, **Demo B**, and **Demo C** without connecting a wallet. Inspect criteria, evidence logs, and stability certificates.
4. Click **"Connect Wallet"** to connect via MetaMask or Rabby (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`).
5. Open a new dispute with 2-4 criteria summing to 10,000 basis points.
6. Switch extensions using the explicit **"Switch Wallet"** button to choose the wallet for Party 2.
7. Submit evidence from both parties ($\le 1200$ characters each).
8. Click **"Execute judge()"** and observe the consensus progress modal (takes ~19s to 55s).
9. Read back the resulting Stability Certificate and trigger downstream consumer settlement.

### Option 2: Local Development
```bash
git clone https://github.com/huzyow155/second-opinion-desk-genlayer.git
cd second-opinion-desk-genlayer
npm install
npm run dev
```

Run test suite and on-chain verification:
```bash
node scripts/test_live_reads.mjs
npm run build
```

---

## 5-Gate Verification Matrix

| Gate | Description | Status | Verification Detail |
| :---: | :--- | :---: | :--- |
| **1** | Real UI Caller Verification | **PASSED** | On-chain contract calls verified against Studionet via `genlayer-js`. |
| **2** | Positive + Negative No-Wallet Check | **PASSED** | Positive: Demos A, B, and C return real data. Negative: `nonexistent99` safely returns `{}`. |
| **3** | 0-GEN Funding Guidance | **PASSED** | Persistent notice informs users: MirrorJudge does not require a payment value for case creation, evidence, or adjudication. |
| **4** | Full Flow Latency Documented | **PASSED** | Dual-pass consensus takes 19s-55s (tracked with real-time UI timer). |
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

MIT License. Developed for the GenLayer Studionet Preview developer ecosystem.
