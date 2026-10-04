export interface Criterion {
  id: string;
  text: string;
  weight_bp: number;
}

export interface EvidenceItem {
  by: 'PARTY_1' | 'PARTY_2';
  text: string;
}

export interface RoundRecord {
  n: number;
  decision: string;
}

export interface CaseRecord {
  schema_version: string;
  case_id: string;
  title: string;
  opener: string;
  opposing: string;
  criteria: Criterion[];
  aliases1: string[];
  aliases2: string[];
  margin_bp: number;
  max_flips: number;
  max_rounds: number;
  evidence: EvidenceItem[];
  rounds: RoundRecord[];
  status: 'OPEN' | 'JUDGED' | 'FINAL';
}

export interface StabilityCertificate {
  schema_version: string;
  case_id: string;
  title: string;
  opener: string;
  opposing: string;
  status: 'OPEN' | 'JUDGED' | 'FINAL';
  config: {
    margin_bp: number;
    max_flips: number;
    max_rounds: number;
    criteria: Criterion[];
  };
  rounds: RoundRecord[];
  current_decision: string;
  is_decided: boolean;
  outcome: 'PARTY_1' | 'PARTY_2' | 'SPLIT' | 'NO_DECISION' | 'PENDING';
}

export type ConsumerOutcome = 'PARTY_1' | 'PARTY_2' | 'SPLIT' | 'NO_DECISION' | 'PENDING';

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any;
}
