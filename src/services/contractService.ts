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
// READ METHODS (No wallet connection required)
// ---------------------------------------------------------------------------

export async function fetchCase(caseId: string): Promise<CaseRecord | null> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_case',
      args: [caseId],
    });
    if (!raw || raw === '{}' || raw === '""') return null;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as CaseRecord);
  } catch (err) {
    console.error('fetchCase error:', err);
    return null;
  }
}

export async function fetchCertificate(caseId: string): Promise<StabilityCertificate | null> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_certificate',
      args: [caseId],
    });
    if (!raw || raw === '{}' || raw === '""') return null;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as StabilityCertificate);
  } catch (err) {
    console.error('fetchCertificate error:', err);
    return null;
  }
}

export async function fetchOutcomeForConsumer(caseId: string): Promise<ConsumerOutcome> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'outcome_for_consumer',
      args: [caseId],
    });
    if (!raw) return 'NO_DECISION';
    const cleaned = String(raw).replace(/^"|"$/g, '').trim();
    return cleaned as ConsumerOutcome;
  } catch (err) {
    console.error('fetchOutcomeForConsumer error:', err);
    return 'NO_DECISION';
  }
}

export async function fetchCasesByParty(party: string, limit = 20): Promise<string[]> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_cases_by_party',
      args: [party, limit],
    });
    if (!raw || raw === '[]' || raw === '') return [];
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as string[]);
  } catch (err) {
    console.error('fetchCasesByParty error:', err);
    return [];
  }
}

export async function fetchLatestCaseForPair(partyA: string, partyB: string): Promise<string> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'get_latest_case_for_pair',
      args: [partyA, partyB],
    });
    if (!raw || raw === '""' || raw === '') return '';
    return typeof raw === 'string' ? raw.replace(/^"|"$/g, '').trim() : String(raw);
  } catch (err) {
    console.error('fetchLatestCaseForPair error:', err);
    return '';
  }
}

export async function fetchGlobalCases(offset = 0, limit = 20): Promise<string[]> {
  try {
    const raw: any = await publicClient.readContract({
      address: MIRROR_JUDGE_ADDRESS,
      functionName: 'list_cases',
      args: [offset, limit],
    });
    if (!raw || raw === '[]' || raw === '') return [];
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as string[]);
  } catch (err) {
    console.error('fetchGlobalCases error:', err);
    return [];
  }
}

export async function fetchConsumerSettlement(caseId: string): Promise<string> {
  try {
    const raw: any = await publicClient.readContract({
      address: CONSUMER_CONTRACT_ADDRESS,
      functionName: 'get_settlement',
      args: [caseId],
    });
    if (!raw || raw === '""') return '';
    return typeof raw === 'string' ? raw.replace(/^"|"$/g, '').trim() : String(raw);
  } catch {
    return '';
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
// RECEIPT POLLING HELPER
// ---------------------------------------------------------------------------

export async function waitForReceiptWithProgress(
  client: any,
  txHash: string,
  onTick?: (seconds: number) => void
): Promise<{ receipt: any; success: boolean; durationSec: number }> {
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

    const leaderExec =
      receipt?.consensus_data?.leader_receipt?.[0]?.execution_result || receipt?.result_name;
    const isSuccess = receipt?.status_name === 'ACCEPTED' && leaderExec === 'SUCCESS';

    return {
      receipt,
      success: isSuccess,
      durationSec,
    };
  } catch (error) {
    if (timer) clearInterval(timer);
    throw error;
  }
}
