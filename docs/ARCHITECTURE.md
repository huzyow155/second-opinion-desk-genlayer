# Second-Opinion Desk - System Architecture

Second-Opinion Desk is a decentralized, dual-pass dispute adjudication workbench built on top of the **MirrorJudge** intelligent contract (`SCHEMA_VERSION = "2.0.0"`) on **GenLayer Studionet (Preview)** (Chain ID `61999`).

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
|  | - 4-Phase Readiness Lifecycle     |  | - Evidence + Mark Ready    |  |
|  | - Single "Launch Workbench" CTA   |  | - Close Evidence + Judge   |  |
|  | (No wallet / no contract reads)   |  | - Dual-Ack Finalization    |  |
|  +-----------------------------------+  +----------------------------+  |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
          v                                                   v
+-------------------------------+           +-------------------------------+
|  Wallet Context (EIP-6963)    |           | Public Client (genlayer-js)   |
|  - MetaMask / Rabby / Detected|           | - Zero-Wallet View Reads      |
|  - Explicit Switch Wallet     |           | - list_cases / get_case       |
|  - Chain Switcher (61999)     |           | - get_lifecycle               |
|                               |           | - get_certificate             |
+-------------------------------+           +-------------------------------+
          |                                                   |
          +-------------------------+-------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                    GenLayer Studionet RPC (Chain ID 61999)              |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | MirrorJudge Intelligent Contract (0x2cb49A03f...808d8FE)          |  |
|  | - 4-Phase Readiness Lifecycle (OPEN -> CLOSED -> JUDGED -> FINAL) |  |
|  | - Dual-Pass Evaluation (Canonical + Mirrored)                     |  |
|  | - Verbatim Quote Grounding                                        |  |
|  | - String-Only Canonical JSON Storage (TreeMap[str, str])          |  |
|  +-------------------------------------------------------------------+  |
|                                    | (outcome_for_consumer)             |
|                                    v                                    |
|  +-------------------------------------------------------------------+  |
|  | MirrorJudgeConsumer Contract (0xEC8B7B09A...09251)                |  |
|  | - Single-settlement & FINAL-gated downstream settlement execution |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Core Architectural Guarantees

### A. 4-Phase Readiness & Finalization Lifecycle (`OPEN -> CLOSED -> JUDGED -> FINAL`)
- **Phase 1: `OPEN` (Evidence & Readiness)**:
  - Parties submit up to 3 evidence items ($\le 1200$ characters each) within the 600-second (`EVIDENCE_WINDOW_SECONDS`) window and call `mark_ready(case_id)` after submitting at least 1 item.
  - Once both parties mark ready, the case automatically transitions to `CLOSED`.
  - If the 600-second window expires (`now >= evidence_deadline_ts`), either party may call `close_evidence(case_id)` to transition `OPEN -> CLOSED`.
- **Phase 2: `CLOSED` (Party-Restricted `judge()`)**:
  - Only `party_1` or `party_2` may trigger `judge(case_id)`, and only while `status == "CLOSED"`.
  - `DECIDED|*|STABLE` transitions to `JUDGED` and starts the 300-second (`FINALIZE_WINDOW_SECONDS`) review window.
  - `INSUFFICIENT|NONE|NA` transitions directly to terminal `FINAL`.
  - `UNSTABLE|NONE|UNSTABLE` reopens `status = "OPEN"` with a fresh 600-second evidence window and resets both readiness flags (`ready = {"PARTY_1": false, "PARTY_2": false}`) so parties can submit additional evidence.
- **Phase 3: `JUDGED` (Dual-Ack or Post-Window `finalize()`)**:
  - Only `party_1` or `party_2` may call `finalize(case_id)`.
  - If only one party acknowledges before `judged_at_ts + 300`, the acknowledgment is recorded and the case stays `JUDGED` (`outcome_for_consumer` remains `"PENDING"`).
  - The case transitions to `FINAL` only when both parties acknowledge (`final_acks == {"PARTY_1": true, "PARTY_2": true}`) or when a party calls `finalize` after the 300-second review window (`now >= judged_at_ts + 300`).
- **Phase 4: `FINAL` (Downstream Consumer Settlement)**:
  - `FINAL` is terminal (`"case is closed"`).
  - `outcome_for_consumer(case_id)` returns `"PENDING"` for every non-`FINAL` state and only emits `"PARTY_1"`, `"PARTY_2"`, `"SPLIT"`, or `"NO_DECISION"` once `status == "FINAL"`.
  - `MirrorJudgeConsumer.settle_dispute(case_id)` reverts if the dispute is still `"PENDING"` or if the case was `"already settled"`.

### B. Strict Page Separation (Zero Content Overlap)
- **Landing Page (`/`)**: Dedicated marketing and explainer page. Focuses on the LLM position-bias vulnerability, the dual-pass solution, the 4-phase readiness protocol, and why GenLayer is uniquely required for AI smart contracts. Holds zero wallet connections, zero contract reads, and zero case data.
- **Workbench (`/app`)**: Dedicated functional application. Hosts the no-wallet on-chain demo browser, case creation form, evidence submission and readiness panel, consensus judging trigger with multi-step waiting modal, stability certificate viewer, and downstream consumer settlement panel.

### C. Ground Rule Compliance: No Client-Side ID Hashing
- Per project rules, the frontend **never re-implements `case_id` SHA256 hashing**.
- Newly created cases are discovered using the intelligent contract's dedicated view method `get_latest_case_for_pair(opener, opposing)`.
- Global cases and user cases are discovered using `list_cases(offset, limit)` and `get_cases_by_party(party, limit)`.

### D. Multi-Wallet & Cross-Extension Support (EIP-6963)
- Listens for `eip6963:announceProvider` events to detect all browser-injected wallet extensions (e.g. MetaMask, Rabby, OKX) simultaneously.
- Provides an explicit "Switch Wallet" interface that always opens the provider chooser directly, allowing a single tester to easily switch between Party 1 and Party 2 extensions without assuming `accountsChanged` fires across extensions.
- Zero private keys or mnemonics are ever stored or handled.

---

## 3. Intelligent Adjudication Pipeline & Latency

When `judge(case_id)` is invoked by a party in `CLOSED` state, GenLayer validators execute two non-deterministic LLM passes inside GenVM:

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
   - If $\Delta > \text{margin\_bp}$ or flips exceed tolerance, the verdict is `UNSTABLE` and the case reopens to `OPEN` for Round 2 evidence.
4. **Validator Consensus**
   - Validators run this pipeline and achieve majority agreement on the resulting stability certificate.
   - Total latency typically ranges between **19 seconds and 55 seconds** (up to ~138 seconds during high network load).
   - The UI displays an active multi-step waiting state modal with a real-time elapsed timer during this interval.
