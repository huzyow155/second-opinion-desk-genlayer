import { createClient, chains } from 'genlayer-js';
import {
  MIRROR_JUDGE_ADDRESS,
  CONSUMER_CONTRACT_ADDRESS,
  STUDIONET_CHAIN_ID,
  STUDIONET_NAME,
  STUDIONET_RPC_URL,
  STUDIONET_EXPLORER_URL,
} from '../config/chain';
import type { CaseRecord, StabilityCertificate, ConsumerOutcome } from '../types/dispute';

export const STUDIONET_CONFIG = chains?.studionet || {
  id: STUDIONET_CHAIN_ID,
  name: STUDIONET_NAME,
  rpcUrls: { default: { http: [STUDIONET_RPC_URL] } },
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  blockExplorers: {
    default: {
      name: 'GenLayer Explorer',
      url: STUDIONET_EXPLORER_URL,
    },
  },
};

// Discriminated union to clearly separate successful reads (including confirmed nonexistent) from network/RPC errors
export type ContractReadResult<T> =
  | { ok: true; data: T }
  | { ok: true; data: null }
  | { ok: false; error: string };

// Public read-only client
export const publicClient = createClient({
  chain: STUDIONET_CONFIG,
});

export function getWriteClient(account: string, provider: any) {
  return createClient({
    chain: STUDIONET_CONFIG,
    account: account as `0x${string}`,
    provider,
  });
}

// ---------------------------------------------------------------------------
// READ METHODS (Distinguishes confirmed nonexistent cases from failed reads)
// ---------------------------------------------------------------------------

export async function fetchCase(caseId: string): Promise<ContractReadResult<CaseRecord>> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_case',
      args: [caseId],
    });
    if (!raw || raw === '{}' || raw === '""' || raw === 'null') {
      return { ok: true, data: null };
    }
    const data = typeof raw === 'string' ? JSON.parse(raw) : (raw as CaseRecord);
    return { ok: true, data };
  } catch (err: any) {
    console.error('fetchCase error:', err);
    return { ok: false, error: err?.message || 'RPC communication error' };
  }
}

export async function fetchCertificate(caseId: string): Promise<ContractReadResult<StabilityCertificate>> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_certificate',
      args: [caseId],
    });
    if (!raw || raw === '{}' || raw === '""' || raw === 'null') {
      return { ok: true, data: null };
    }
    const data = typeof raw === 'string' ? JSON.parse(raw) : (raw as StabilityCertificate);
    return { ok: true, data };
  } catch (err: any) {
    console.error('fetchCertificate error:', err);
    return { ok: false, error: err?.message || 'RPC communication error' };
  }
}

export async function fetchOutcomeForConsumer(caseId: string): Promise<ContractReadResult<ConsumerOutcome>> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'outcome_for_consumer',
      args: [caseId],
    });
    if (!raw || raw === '""') {
      return { ok: true, data: 'NO_DECISION' };
    }
    const cleaned = String(raw).replace(/^"|"$/g, '').trim() as ConsumerOutcome;
    return { ok: true, data: cleaned };
  } catch (err: any) {
    console.error('fetchOutcomeForConsumer error:', err);
    return { ok: false, error: err?.message || 'RPC communication error' };
  }
}

export async function fetchCasesByParty(party: string, limit = 20): Promise<ContractReadResult<string[]>> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_cases_by_party',
      args: [party, limit],
    });
    if (!raw || raw === '[]' || raw === '') {
      return { ok: true, data: [] };
    }
    const data = typeof raw === 'string' ? JSON.parse(raw) : (raw as string[]);
    return { ok: true, data };
  } catch (err: any) {
    console.error('fetchCasesByParty error:', err);
    return { ok: false, error: err?.message || 'RPC communication error' };
  }
}

export async function fetchLatestCaseForPair(partyA: string, partyB: string): Promise<ContractReadResult<string>> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_latest_case_for_pair',
      args: [partyA, partyB],
    });
    if (!raw || raw === '""' || raw === '') {
      return { ok: true, data: null };
    }
    const id = typeof raw === 'string' ? raw.replace(/^"|"$/g, '').trim() : String(raw);
    return { ok: true, data: id || null };
  } catch (err: any) {
    console.error('fetchLatestCaseForPair error:', err);
    return { ok: false, error: err?.message || 'RPC communication error' };
  }
}

export async function fetchGlobalCases(offset = 0, limit = 20): Promise<ContractReadResult<string[]>> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'list_cases',
      args: [offset, limit],
    });
    if (!raw || raw === '[]' || raw === '') {
      return { ok: true, data: [] };
    }
    const data = typeof raw === 'string' ? JSON.parse(raw) : (raw as string[]);
    return { ok: true, data };
  } catch (err: any) {
    console.error('fetchGlobalCases error:', err);
    return { ok: false, error: err?.message || 'RPC communication error' };
  }
}

export async function fetchConsumerSettlement(caseId: string): Promise<ContractReadResult<string>> {
  try {
    const raw: any = await publicClient.readContract({
      address: CONSUMER_CONTRACT_ADDRESS,
      functionName: 'get_settlement',
      args: [caseId],
    });
    if (!raw || raw === '""') {
      return { ok: true, data: null };
    }
    const s = typeof raw === 'string' ? raw.replace(/^"|"$/g, '').trim() : String(raw);
    return { ok: true, data: s || null };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'RPC communication error' };
  }
}

// ---------------------------------------------------------------------------
// WRITE METHODS
// ---------------------------------------------------------------------------

export async function executeOpenCase(
  writeClient: any,
  title: string,
  criteriaJson: string,
  aliases1Csv: string,
  aliases2Csv: string,
  opposing: string
): Promise<string> {
  return await writeClient.writeContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'open_case',
    args: [title, criteriaJson, aliases1Csv, aliases2Csv, opposing],
  });
}

export async function executeAddEvidence(
  writeClient: any,
  caseId: string,
  text: string
): Promise<string> {
  return await writeClient.writeContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'add_evidence',
    args: [caseId, text],
  });
}

export async function executeJudge(writeClient: any, caseId: string): Promise<string> {
  return await writeClient.writeContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'judge',
    args: [caseId],
  });
}

export async function executeFinalize(writeClient: any, caseId: string): Promise<string> {
  return await writeClient.writeContract({
    address: MIRROR_JUDGE_ADDRESS,
    functionName: 'finalize',
    args: [caseId],
  });
}

export async function executeConsumerSettle(writeClient: any, caseId: string): Promise<string> {
  return await writeClient.writeContract({
    address: CONSUMER_CONTRACT_ADDRESS,
    functionName: 'settle_dispute',
    args: [caseId],
  });
}

// ---------------------------------------------------------------------------
// STRENGTHENED RECEIPT VERIFICATION & ERROR EXTRACTION
// ---------------------------------------------------------------------------

export interface ReceiptVerificationResult {
  receipt: any;
  success: boolean;
  durationSec: number;
  errorReason?: string;
  disagreementWarning?: string;
}

export function extractRevertReason(receipt: any): string {
  if (!receipt) return 'No receipt returned';

  const leaderReceipts = receipt?.consensus_data?.leader_receipt || [];
  for (const r of leaderReceipts) {
    if (r?.genvm_result?.stderr) {
      return String(r.genvm_result.stderr).trim();
    }
    if (r?.genvm_result?.raw_error?.causes?.[0]) {
      return String(r.genvm_result.raw_error.causes[0]);
    }
    if (r?.error) {
      return String(r.error);
    }
    if (r?.result) {
      try {
        const decoded = atob(r.result);
        const clean = decoded.replace(/^\x01/, '').trim();
        if (clean) return clean;
      } catch {
        const str = String(r.result);
        if (str && str !== '""') return str;
      }
    }
  }

  if (receipt?.consensus_data?.final_votes_results) {
    const votes = receipt.consensus_data.final_votes_results;
    for (const v of votes) {
      for (const item of v?.votes || []) {
        if (item?.genvm_result?.stderr) return String(item.genvm_result.stderr);
        if (item?.result) {
          try {
            const decoded = atob(item.result);
            const clean = decoded.replace(/^\x01/, '').trim();
            if (clean) return clean;
          } catch {
            // ignore
          }
        }
      }
    }
  }

  if (receipt?.status_name && receipt.status_name !== 'ACCEPTED') {
    return `Transaction status: ${receipt.status_name}`;
  }
  if (receipt?.result_name && receipt.result_name !== 'MAJORITY_AGREE') {
    return `Consensus result: ${receipt.result_name}`;
  }

  return 'Execution failed in GenVM without specific error message';
}

export async function waitForReceiptWithProgress(
  client: any,
  txHash: string,
  onTick?: (seconds: number) => void
): Promise<ReceiptVerificationResult> {
  const startTime = Date.now();
  let timer: any = null;

  if (onTick) {
    timer = setInterval(() => {
      onTick(Math.round((Date.now() - startTime) / 1000));
    }, 1000);
  }

  try {
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      retries: 120,
      interval: 3000,
    });

    if (timer) clearInterval(timer);
    const durationSec = Math.round((Date.now() - startTime) / 1000);

    // Multi-validator verification: check ALL leader_receipt entries
    const leaderReceipts = receipt?.consensus_data?.leader_receipt || [];
    let allSuccess = true;
    let disagreementWarning: string | undefined;

    if (Array.isArray(leaderReceipts) && leaderReceipts.length > 0) {
      const results = leaderReceipts.map((r: any) => r?.execution_result);
      const firstRes = results[0];
      allSuccess = results.every((r: any) => r === 'SUCCESS');

      if (!results.every((r: any) => r === firstRes)) {
        disagreementWarning = `Validator divergence detected across committee: [${results.join(', ')}]`;
        console.warn(disagreementWarning);
      }
    } else {
      // Fallback if leader_receipt array is omitted
      allSuccess = receipt?.result_name === 'MAJORITY_AGREE';
    }

    const isAccepted = receipt?.status_name === 'ACCEPTED';
    const isSuccess = isAccepted && allSuccess;
    let errorReason: string | undefined;

    if (!isSuccess) {
      errorReason = extractRevertReason(receipt);
    }

    return {
      receipt,
      success: isSuccess,
      durationSec,
      errorReason,
      disagreementWarning,
    };
  } catch (error) {
    if (timer) clearInterval(timer);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// POST-WRITE CONTRACT STATE VERIFICATION
// ---------------------------------------------------------------------------

export async function verifyPostWriteState(
  action: 'open' | 'evidence' | 'judge' | 'finalize' | 'settle',
  caseId: string,
  expected?: any
): Promise<{ verified: boolean; message: string; readData?: any }> {
  // Give GenVM node state storage 500ms to settle view state
  await new Promise((r) => setTimeout(r, 600));

  if (action === 'open') {
    const res = await fetchCase(caseId);
    if (res.ok && res.data && (!expected?.title || res.data.title === expected.title)) {
      return { verified: true, message: 'Case verified on-chain in storage.', readData: res.data };
    }
    return { verified: false, message: 'Case record not confirmed after open_case write.' };
  }

  if (action === 'evidence') {
    const res = await fetchCase(caseId);
    if (res.ok && res.data) {
      const count = res.data.evidence?.length || 0;
      if (expected?.minCount === undefined || count >= expected.minCount) {
        return { verified: true, message: `Evidence entry confirmed on-chain (total: ${count}).`, readData: res.data };
      }
    }
    return { verified: false, message: 'Evidence not confirmed in case record after add_evidence write.' };
  }

  if (action === 'judge') {
    const res = await fetchCertificate(caseId);
    if (res.ok && res.data) {
      const roundsCount = res.data.rounds?.length || 0;
      if (expected?.prevRoundsCount === undefined || roundsCount > expected.prevRoundsCount) {
        const lastRound = res.data.rounds ? res.data.rounds[roundsCount - 1] : undefined;
        return {
          verified: true,
          message: `Adjudication round #${roundsCount} confirmed on-chain (${lastRound?.decision || res.data.current_decision}).`,
          readData: res.data,
        };
      }
    }
    return { verified: false, message: 'Adjudication round not confirmed after judge write.' };
  }

  if (action === 'finalize') {
    const res = await fetchCase(caseId);
    if (res.ok && res.data && res.data.status === 'FINAL') {
      return { verified: true, message: 'Dispute status confirmed as FINAL on-chain.', readData: res.data };
    }
    return { verified: false, message: 'Status FINAL not confirmed after finalize write.' };
  }

  if (action === 'settle') {
    const res = await fetchConsumerSettlement(caseId);
    if (res.ok && res.data) {
      return { verified: true, message: `Consumer settlement confirmed on-chain: ${res.data}.`, readData: res.data };
    }
    return { verified: false, message: 'Consumer settlement not confirmed on-chain.' };
  }

  return { verified: true, message: 'State readback verified.' };
}
