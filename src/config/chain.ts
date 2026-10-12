export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_ID_HEX = '0xf22f';
export const STUDIONET_NAME = 'GenLayer Studionet (Preview)';
export const STUDIONET_RPC_URL = 'https://studio.genlayer.com/api';
export const STUDIONET_EXPLORER_URL = 'https://explorer-studio.genlayer.com';

export const MIRROR_JUDGE_ADDRESS = '0x2cb49A03fcc9b8c65E3cd9348826b2d13808d8FE';
export const CONSUMER_CONTRACT_ADDRESS = '0xEC8B7B09AE03cef02ae42bCD8ba28C530D809251';
export const CONTRACT_REPO_URL = 'https://github.com/huzyow155/mirrorjudge-genlayer';
export const DAPP_REPO_URL = 'https://github.com/huzyow155/second-opinion-desk-genlayer';

export const SCHEMA_VERSION = '2.0.0';
export const EVIDENCE_WINDOW_SECONDS = 600;
export const FINALIZE_WINDOW_SECONDS = 300;

export const VERIFIED_DEMO_CASES = {
  DEMO_A: {
    id: '43288877b73b',
    title: 'Freelance Milestone 1 Delivery Verification',
    description:
      'Both parties submit evidence and mark ready -> CLOSED -> judge -> both acknowledge -> FINAL -> consumer settles to PARTY_1.',
    expectedDecision: 'DECIDED|PARTY_1|STABLE',
    expectedOutcome: 'PARTY_1',
    category: 'Software Milestone',
  },
  DEMO_B: {
    id: '6df124828b58',
    title: 'Commercial Lease Cleaning Deposit Dispute',
    description:
      'Party 1 submits evidence and marks ready; Party 2 remains silent across the 600s window -> close_evidence -> deterministic INSUFFICIENT -> FINAL.',
    expectedDecision: 'INSUFFICIENT|NONE|NA',
    expectedOutcome: 'NO_DECISION',
    category: 'Commercial Lease',
  },
  DEMO_C: {
    id: 'f9462ef8b2b5',
    title: 'Cloud Server Infrastructure Uptime SLA Dispute',
    description:
      'Symmetrical SLA claims produce a swap-consistent SPLIT verdict; Party 1 acknowledges and closes to FINAL after the 300s review window.',
    expectedDecision: 'DECIDED|SPLIT|STABLE',
    expectedOutcome: 'SPLIT',
    category: 'Infrastructure SLA',
  },
  DEMO_D: {
    id: '19f9bad34102',
    title: 'Cross-Border Escrow & SLA Addendum Attribution Dispute',
    description:
      'Ambiguous addendum attribution where canonical and mirrored passes diverge -> UNSTABLE -> case automatically reopens to OPEN for Round 2.',
    expectedDecision: 'UNSTABLE|NONE|UNSTABLE',
    expectedOutcome: 'PENDING',
    category: 'Escrow Addendum',
  },
};
