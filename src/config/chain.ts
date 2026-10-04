export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_ID_HEX = '0xf22f';
export const STUDIONET_NAME = 'GenLayer Studionet';
export const STUDIONET_RPC_URL = 'https://studio.genlayer.com/api';
export const STUDIONET_EXPLORER_URL = 'https://explorer-studio.genlayer.com';

export const MIRROR_JUDGE_ADDRESS = '0x30552D40A956d2D753AbAD429c90cB07f65Dabd0';
export const CONSUMER_CONTRACT_ADDRESS = '0x6E295655a39A5f9aDFF8B087497737788aCC8881';
export const CONTRACT_REPO_URL = 'https://github.com/huzyow155/mirrorjudge-genlayer';
export const DAPP_REPO_URL = 'https://github.com/huzyow155/second-opinion-desk-genlayer';

export const VERIFIED_DEMO_CASES = {
  DEMO_A: {
    id: 'ebe94dc89329',
    title: 'Freelance Milestone 1 Delivery Verification',
    description: 'Clear-cut dispute where audited git commit logs and explicit counterparty admission produce a stable single-round victory for Party 1.',
    expectedDecision: 'DECIDED|PARTY_1|STABLE',
    expectedOutcome: 'PARTY_1',
    category: 'Software Milestone',
  },
  DEMO_B: {
    id: '8408ccd5e6ef',
    title: 'Balanced Shared Performance Dispute',
    description: 'Equally balanced dispute where both parties delivered their respective components, landing within the margin threshold to produce a stable SPLIT verdict.',
    expectedDecision: 'DECIDED|SPLIT|STABLE',
    expectedOutcome: 'SPLIT',
    category: 'Joint Deliverable',
  },
  DEMO_ESCALATED: {
    id: '36449cc60579',
    title: 'Cloud Server Infrastructure Uptime SLA Dispute',
    description: 'Dispute showing bounded multi-round escalation: Round 1 unsubstantiated claims yielded INSUFFICIENT, followed by Round 2 supplemental Datadog audit proof producing DECIDED|PARTY_1|STABLE.',
    expectedDecision: 'DECIDED|PARTY_1|STABLE',
    expectedOutcome: 'PARTY_1',
    category: 'Infrastructure SLA',
  },
};
