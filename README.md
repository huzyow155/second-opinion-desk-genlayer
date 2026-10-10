# Second-Opinion Desk

> **Bias-Cancelled Dispute Adjudication Workbench on GenLayer Studionet (Preview)**

Second-Opinion Desk is the official dApp interface for **MirrorJudge**, an Intelligent Contract deployed on GenLayer Studionet (Preview). It solves the critical vulnerability of LLM position bias by evaluating dispute evidence twice: canonically and then mirrored (parties swapped, criteria inverted, evidence re-ordered). Verdicts that withstand their own mirror image receive a stability certificate.

---

## Current Deployed Addresses (GenLayer Studionet (Preview))

| Role | Contract Address | Deploy Transaction Hash | Explorer Link |
| :--- | :--- | :--- | :--- |
| **MirrorJudge (Intelligent Contract)** | `0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D` | `0xf32d2573b81b086b226658434d04e2eca4103e9610ea98f4a38f54fd769edbc3` | [Explorer](https://explorer-studio.genlayer.com/address/0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D) |
| **MirrorJudgeConsumer (Escrow / Downstream)** | `0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837` | `0xd74c65db6cc9256cc6f1221e5003c979c7e11e19dc4a919cc80498f454d302f1` | [Explorer](https://explorer-studio.genlayer.com/address/0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837) |

- **Production Preview URL**: [https://second-opinion-desk-genlayer.vercel.app](https://second-opinion-desk-genlayer.vercel.app)
- **Canonical Contract Repository**: [huzyow155/mirrorjudge-genlayer](https://github.com/huzyow155/mirrorjudge-genlayer)
- **Local Contract Reference**: [`contracts-reference/MirrorJudge.py`](./contracts-reference/MirrorJudge.py) (unmodified byte-for-byte copy)
- **Network Coordinates**: GenLayer Studionet (Preview), Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`

### Superseded Historical Deployments

| Address | Role | Superseded Reason |
| :--- | :--- | :--- |
| `0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17` | MirrorJudge | Pre-hardening deployment lacking strict criterion weight bounds |
| `0x294FFDec366826F8682CFAAEbaf25DcAeBda9317` | Consumer | Pointed to superseded MirrorJudge address |
| `0x30552D40A956d2D753AbAD429c90cB07f65Dabd0` | MirrorJudge | Early prototype (unhardened LLM prompt) |
| `0xd146F4102dCca75dF2977091A3aFd3307D236f78` | MirrorJudgeCore | Milestone 1 core prototype |
| `0x2106760ca2BD2a55be57A8B68373F65afCdc2Fe2` | Probe | Milestone 0 runtime diagnostic |

---

## Deployed Source Code Integrity

The intelligent contract code deployed on GenLayer Studionet (Preview) matches the local reference file byte-for-byte:

- **Deploy Transaction Hash**: `0xf32d2573b81b086b226658434d04e2eca4103e9610ea98f4a38f54fd769edbc3`
- **Local Source Hash (SHA256)**: `123c0dbe36a376213d20c2e42bda22f82f51be184a42295d98fe36e882ae0594`
- **Deployed Source Hash (SHA256)**: `123c0dbe36a376213d20c2e42bda22f82f51be184a42295d98fe36e882ae0594`
- **Verification Method**: `eth_getTransactionByHash` on deploy tx -> base64-decode `data.contract_code` -> sha256 -> compare to local file hash.
- **Match Result**: `true` (strictly verified via `scripts/test_live_reads.mjs`)

---

## Persistent On-Chain Demos (No Wallet Needed)

Reviewers can inspect these verified, immutable cases on GenLayer Studionet (Preview) immediately without a wallet:

| Demo | Case ID | Category | Verdict | Key Characteristic |
| :--- | :--- | :--- | :--- | :--- |
| **Demo A** | `0551168cd4f5` | Software Milestone | `DECIDED\|PARTY_1\|STABLE` | Clear-cut deliverable with git commit history and counterparty admission. |
| **Demo B** | `4e4a3aa372e6` | Commercial Lease | `INSUFFICIENT\|NONE\|NA` | Missing required evidence dispute resolved deterministically without LLM bias. |
| **Demo C** | `8f128188b6c6` | Infrastructure SLA | `DECIDED\|SPLIT\|STABLE` | Balanced SLA performance with mirrored consensus resulting in equal split. |
| **Demo D** | `cbbed41fefc3` | Escrow Addendum | `UNSTABLE\|NONE\|UNSTABLE` | Ambiguous addendum attribution where canonical and mirrored passes diverge. UNSTABLE means the canonical and mirrored passes disagreed, so no verdict is issued: the case stays OPEN (is_decided=false) and can be re-run or given more evidence. |

### On-Chain Verification of `UNSTABLE` Case (`cbbed41fefc3`)

UNSTABLE means the canonical and mirrored passes disagreed, so no verdict is issued: the case stays OPEN (is_decided=false) and can be re-run or given more evidence.

- **`open_case` Tx**: `0xa3e30f86e5677c7b069b3c42bd2769a6f90e27570cca39c24a2017151e4ff2aa`
- **Party 1 `add_evidence` Tx**: `0x1edb1ec2e78ab87cb4396d5548df6426ea47615f36ac4249f73455c9355b3bae`
- **Party 2 `add_evidence` Tx**: `0xa4605d01bf0f17c5ca6264f75f355d9f4a351343058e69021a28eb94c774f8bd`
- **`judge` Tx**: `0x8472dbad8e0bdc0f3049db16ca509e3b539a5d938b2bff5a389aff2d16e2c3a2` (Accepted by validators, `MAJORITY_AGREE`, `leaderResult: SUCCESS`, `31.89s`)
- **RPC View Call**: `readContract({ address: "0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D", functionName: "get_certificate", args: ["cbbed41fefc3"] })`
- **Field Read**: `JSON.parse(certificate).current_decision === "UNSTABLE|NONE|UNSTABLE"` and `rounds[0].decision === "UNSTABLE|NONE|UNSTABLE"`
- **UI Verification Proof**: [`docs/UNSTABLE_CASE_UI_PROOF.md`](./docs/UNSTABLE_CASE_UI_PROOF.md) and [`docs/unstable_case_cbbed41fefc3.png`](./docs/unstable_case_cbbed41fefc3.png)

---

## Two-Page Architecture (Zero Content Overlap)

1. **Landing Page (`/`)**:
   - Marketing and technical explainer.
   - Explains the position-bias flaw in commercial LLMs and how dual-pass mirroring cancels it deterministically.
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
   - **Evidence Submission**: Party 1 and Party 2 submissions (up to 3 items per party, $\le 1200$ chars with real-time counter).
   - **Consensus Adjudication (`judge()`)**: Multi-step waiting modal with real-time elapsed timer tracking the validator consensus process.
   - **Stability Certificate Viewer**: On-chain breakdown of stability status with exact token decision parsing (`parseDecision()`), criteria weights, evidence entries, and round history.
   - **Downstream Consumer Integration**: Inspects `outcome_for_consumer` and triggers `settle_dispute` on the consumer contract.

---

## How to Try It (Step-by-Step)

### Option 1: Web App Preview
1. Open the deployed application URL: [https://second-opinion-desk-genlayer.vercel.app](https://second-opinion-desk-genlayer.vercel.app)
2. Review the explainer on the landing page, then click **"Launch Dispute Workbench"**.
3. On `/app`, explore **Demo A**, **Demo B**, **Demo C**, and **Demo D** without connecting a wallet. Inspect criteria, evidence logs, and stability certificates.
4. Click **"Connect Wallet"** to connect via MetaMask or Rabby (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`).
5. Open a new dispute with 1-6 criteria summing to 10,000 basis points.
6. Switch extensions using the explicit **"Switch Wallet"** button to choose the wallet for Party 2.
7. Submit evidence from both parties ($\le 1200$ characters each).
8. Click **"Execute judge()"** and observe the consensus progress modal.
9. Read back the resulting Stability Certificate and trigger downstream consumer settlement.

### Option 2: Local Development
```bash
git clone https://github.com/huzyow155/second-opinion-desk-genlayer.git
cd second-opinion-desk-genlayer
npm install
npm run dev
```

Run parser unit/regression tests, live on-chain verification, and production build:
```bash
npm run test:parser
node scripts/test_live_reads.mjs
npm run build
```

---

## 5-Gate Verification Matrix

| Gate | Description | Status | Verification Detail |
| :---: | :--- | :---: | :--- |
| **1** | Real UI Caller Verification | **PASSED** | On-chain contract calls verified against Studionet via `genlayer-js`. |
| **2** | Positive + Negative No-Wallet Check | **PASSED** | Positive: Demos A, B, C, and D return real data. Negative: `nonexistent99` safely returns `{}`. |
| **3** | 0-GEN Funding Guidance | **PASSED** | Persistent notice informs users: MirrorJudge does not require a payment value for case creation, evidence, or adjudication. |
| **4** | Full Flow Latency Documented | **PASSED** | Dual-pass consensus verified on-chain (tracked with real-time UI timer). |
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
