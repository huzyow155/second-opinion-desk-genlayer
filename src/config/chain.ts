export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_ID_HEX = '0xf22f';
export const STUDIONET_NAME = 'GenLayer Studionet';
export const STUDIONET_RPC_URL = 'https://studio.genlayer.com/api';
export const STUDIONET_EXPLORER_URL = 'https://explorer-studio.genlayer.com';

export const MIRROR_JUDGE_ADDRESS = '0x1343C51732FD1002986Ed3f0Bb9D5C2105A6635D';
export const CONSUMER_CONTRACT_ADDRESS = '0x4FC86C019ec00Aa911A4D34986e33be2Cd94b837';
export const CONTRACT_REPO_URL = 'https://github.com/huzyow155/mirrorjudge-genlayer';
export const DAPP_REPO_URL = 'https://github.com/huzyow155/second-opinion-desk-genlayer';

export const VERIFIED_DEMO_CASES = {
  DEMO_A: {
    id: '0551168cd4f5',
    title: 'Freelance Milestone 1 Delivery Verification',
    description: 'Clear-cut dispute where audited git commit logs and explicit counterparty admission produce a stable single-round victory for Party 1.',
    expectedDecision: 'DECIDED|PARTY_1|STABLE',
    expectedOutcome: 'PARTY_1',
    category: 'Software Milestone',
  },
  DEMO_B: {
    id: '4e4a3aa372e6',
    title: 'Commercial Lease Cleaning Deposit Dispute',
    description: 'Missing counterparty evidence dispute where missing submissions trigger deterministic INSUFFICIENT resolution without LLM bias.',
    expectedDecision: 'INSUFFICIENT|NONE|NA',
    expectedOutcome: 'PENDING',
    category: 'Commercial Lease',
  },
  DEMO_C: {
    id: '8f128188b6c6',
    title: 'API Gateway Infrastructure SLA Milestone Dispute',
    description: 'Balanced dispute with symmetrical assertions where dual-pass mirroring produces a stable SPLIT verdict across validators.',
    expectedDecision: 'DECIDED|SPLIT|STABLE',
    expectedOutcome: 'SPLIT',
    category: 'Infrastructure SLA',
  },
  DEMO_D: {
    id: 'cbbed41fefc3',
    title: 'Cross-Border Escrow & SLA Addendum Attribution Dispute',
    description: 'Ambiguous addendum attribution where canonical and mirrored passes diverge, producing an UNSTABLE certificate.',
    expectedDecision: 'UNSTABLE|NONE|UNSTABLE',
    expectedOutcome: 'PENDING',
    category: 'Escrow Addendum',
  },
};
