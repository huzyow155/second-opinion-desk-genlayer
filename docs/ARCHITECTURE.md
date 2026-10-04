# Second-Opinion Desk - System Architecture

Second-Opinion Desk is a decentralized, dual-pass dispute adjudication workbench built on top of the **MirrorJudge** intelligent contract on **GenLayer Studionet Preview** (Chain ID `61999`).

---

## 1. High-Level Architecture

The dApp connects users to GenLayer's GenVM execution runtime through browser-injected wallets and the `genlayer-js` SDK.

```
+-------------------------------------------------------------------------+
|                        Browser Client Interface                         |
|  +-----------------------------------+  +----------------------------+  |
|  |       Landing Page ("/")          |  |     Workbench ("/app")     |  |
|  | - Position-Bias Explainer         |  | - No-Wallet Demo Browser   |  |
|  | - Dual-Pass Visual Diagram        |  | - Open Case Specification  |  |
|  | - Why GenLayer is Mandatory       |  | - Evidence Submission      |  |
|  | - Single "Launch Workbench" CTA   |  | - Consensus Judge Trigger  |  |
|  | (No wallet / no contract reads)   |  | - Stability Certificate    |  |
|  +-----------------------------------+  +----------------------------+  |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v                                                   v
+-------------------------------+           +-------------------------------+
|  Wallet Context (EIP-6963)    |           | Public Client (genlayer-js)   |
|  - MetaMask / Rabby / Fallback|           | - Zero-Wallet View Reads      |
|  - Account Switcher (Perms)   |           | - list_cases / get_case       |
|  - Chain Switcher (61999)     |           | - get_certificate             |
+-------------------------------+           +-------------------------------+
          |                                                   |
          +-------------------------+-------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                    GenLayer Studionet RPC (Chain ID 61999)              |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | MirrorJudge Intelligent Contract (0x30552D40A9...65Dabd0)         |  |
|  | - Dual-Pass Evaluation (Canonical + Mirrored)                     |  |
|  | - Verbatim Quote Grounding                                        |  |
|  | - String-Only Canonical JSON Storage (TreeMap[str, str])          |  |
|  +-------------------------------------------------------------------+  |
|                                    | (outcome_for_consumer)             |
|                                    v                                    |
|  +-------------------------------------------------------------------+  |
|  | MirrorJudgeConsumer Contract (0x6E295655a...CC8881)               |  |
|  | - Downstream settlement payout & escrow execution                 |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Core Architectural Guarantees

### A. Strict Page Separation (Zero Content Overlap)
- **Landing Page (`/`)**: Dedicated marketing and explainer page. Focuses on the LLM position-bias vulnerability, the dual-pass solution, and why GenLayer is uniquely required for AI smart contracts. Holds zero wallet connections, zero live contract reads, and zero case data.
- **Workbench (`/app`)**: Dedicated functional application. Hosts the no-wallet on-chain demo browser, case creation form, evidence submission panel, consensus judging trigger with multi-step waiting modal, and stability certificate viewer.

### B. Ground Rule Compliance: No Client-Side ID Hashing
- Per project rules, the frontend **never re-implements `case_id` SHA256 hashing**.
- Newly created cases are discovered using the intelligent contract's dedicated view method `get_latest_case_for_pair(opener, opposing)`.
- Global cases and user cases are discovered using `list_cases(offset, limit)` and `get_cases_by_party(party, limit)`.

### C. Multi-Wallet & Cross-Extension Support (EIP-6963)
- Listens for `eip6963:announceProvider` events to detect all browser-injected wallet extensions (e.g. MetaMask, Rabby, Coinbase Wallet) simultaneously.
- Provides an explicit "Switch Wallet" interface using `wallet_requestPermissions` and provider selection, allowing a single tester to easily switch between Party 1 and Party 2 accounts.
- Zero private keys or mnemonics are ever stored or handled.

### D. Zero-Gas Network Handling
- Studionet transactions use `gasPrice: 0`.
- Contract methods do not require funds; any 0-GEN address can open cases, submit evidence, and trigger adjudication.
- Clear user guidance is surfaced persistently in the top banner.

---

## 3. Intelligent Adjudication Pipeline & Latency

When `judge(case_id)` is invoked, GenLayer validators execute two non-deterministic LLM passes inside GenVM:

1. **Pass 1: Canonical Evaluation**
   - Anonymizes parties into `PARTY_1` and `PARTY_2`.
   - Prompts the LLM with criteria in natural order (`crit_1`, `crit_2`, ...) and evidence in submission order.
   - LLM extracts per-criterion scores and verbatim evidence quotes.
2. **Pass 2: Mirrored Counter-Pass**
   - Systematically flips party labels: `PARTY_1` becomes `PARTY_2` and vice versa.
   - Reverses criterion order and evidence order.
   - LLM re-evaluates the dispute under inverted framing.
3. **Quote Grounding & Stability Normalization**
   - GenVM verifies that extracted quotes exist verbatim in the submitted evidence.
   - Compares Canonical score with Mirrored score:
     $$\Delta = |Score_{canonical} - Score_{mirrored}|$$
   - If $\Delta \le \text{margin\_bp}$ (1500 bp / 15%) and criterion flip count $\le \text{max\_flips}$ (1), the verdict is `STABLE`.
   - If $\Delta > \text{margin\_bp}$ or flips exceed tolerance, the verdict is `UNSTABLE`.
4. **Validator Consensus**
   - Validators run this pipeline and achieve majority agreement on the resulting stability certificate.
   - Total latency typically ranges between **19 seconds and 55 seconds** (up to ~138 seconds during high network load).
   - The UI displays an active multi-step waiting state modal with an elapsed-time ticker during this interval.
