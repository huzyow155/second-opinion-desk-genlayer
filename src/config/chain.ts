export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_ID_HEX = '0xf22f';
export const STUDIONET_NAME = 'GenLayer Studionet';
export const STUDIONET_RPC_URL = 'https://studio.genlayer.com/api';
export const STUDIONET_EXPLORER_URL = 'https://explorer-studio.genlayer.com';

export const MIRROR_JUDGE_ADDRESS = '0x3991d0817f8FD6B6632b1C2c21d234598CbF4e17';
export const CONSUMER_CONTRACT_ADDRESS = '0x294FFDec366826F8682CFAAEbaf25DcAeBda9317';
export const CONTRACT_REPO_URL = 'https://github.com/huzyow155/mirrorjudge-genlayer';
export const DAPP_REPO_URL = 'https://github.com/huzyow155/second-opinion-desk-genlayer';

export const VERIFIED_DEMO_CASES = {
  DEMO_A: {
    id: '99f9b7444e2a',
    title: 'Freelance Milestone 1 Delivery Verification',
    description: 'Clear-cut dispute where audited git commit logs and explicit counterparty admission produce a stable single-round victory for Party 1.',
    expectedDecision: 'DECIDED|PARTY_1|STABLE',
    expectedOutcome: 'PARTY_1',
    category: 'Software Milestone',
  },
  DEMO_B: {
    id: 'bf29f5d7c7fd',
    title: 'API Gateway Infrastructure SLA Milestone Dispute',
    description: 'Balanced dispute with contradictory assertions where prompt normalization produces a stable SPLIT verdict across validators.',
    expectedDecision: 'DECIDED|SPLIT|STABLE',
    expectedOutcome: 'SPLIT',
    category: 'Infrastructure SLA',
  },
  DEMO_ESCALATED: {
    id: '74320c3924e2',
    title: 'Contradictory Milestone Delivery Review',
    description: 'Contradictory claims identical to production edge cases cleanly adjudicated to DECIDED|SPLIT|STABLE under validator consensus in 15s.',
    expectedDecision: 'DECIDED|SPLIT|STABLE',
    expectedOutcome: 'SPLIT',
    category: 'Delivery Verification',
  },
};
