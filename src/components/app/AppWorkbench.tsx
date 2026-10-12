import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../context/WalletContext';
import {
  fetchCase,
  fetchCertificate,
  fetchLifecycle,
  fetchOutcomeForConsumer,
  fetchCasesByParty,
  fetchLatestCaseForPair,
  fetchGlobalCases,
  fetchConsumerSettlement,
  executeOpenCase,
  executeAddEvidence,
  executeMarkReady,
  executeCloseEvidence,
  executeJudge,
  executeFinalize,
  executeConsumerSettle,
  waitForReceiptWithProgress,
  verifyPostWriteState,
  getWriteClient,
} from '../../services/contractService';
import {
  VERIFIED_DEMO_CASES,
  STUDIONET_NAME,
  EVIDENCE_WINDOW_SECONDS,
  FINALIZE_WINDOW_SECONDS,
} from '../../config/chain';
import type {
  CaseRecord,
  StabilityCertificate,
  LifecycleState,
  Criterion,
  CaseStatus,
} from '../../types/dispute';
import { parseDecision } from '../../utils/decisionParser';
import { WaitingStateModal } from '../common/WaitingStateModal';
import {
  Scale,
  Clock,
  Sparkles,
  PlusCircle,
  Gavel,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Building,
  ArrowRightLeft,
  Info,
  ChevronDown,
  ChevronUp,
  User,
  Lock,
} from 'lucide-react';

function formatCountdown(remainingSec: number): string {
  if (remainingSec <= 0) return '00:00';
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatUtcTimestamp(ts: number): string {
  if (!ts || ts <= 0) return 'N/A';
  try {
    return new Date(ts * 1000).toISOString().replace('.000Z', ' UTC');
  } catch {
    return `${ts}`;
  }
}

export const AppWorkbench: React.FC = () => {
  const {
    account,
    status: walletStatus,
    selectedProvider,
    openChooser,
  } = useWallet();

  const isConnected = walletStatus === 'CONNECTED';

  // Simplified navigation tabs: Cases | Open | Evidence | Judge
  const [activeTab, setActiveTab] = useState<'cases' | 'open' | 'evidence' | 'judge'>('cases');

  const getInitialCaseId = (): string => {
    const hashQuery = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(hashQuery || window.location.search);
    return params.get('case')?.trim().toLowerCase() || VERIFIED_DEMO_CASES.DEMO_A.id;
  };

  // Authoritative case state
  const [inspectedCaseId, setInspectedCaseId] = useState<string>(getInitialCaseId);
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [certificate, setCertificate] = useState<StabilityCertificate | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleState | null>(null);
  const [consumerOutcome, setConsumerOutcome] = useState<string>('');
  const [consumerSettlement, setConsumerSettlement] = useState<string>('');
  const [loadingCase, setLoadingCase] = useState<boolean>(false);
  const [caseLoadError, setCaseLoadError] = useState<string | null>(null);
  const [caseErrorType, setCaseErrorType] = useState<'not_found' | 'network' | null>(null);

  // Real-time clock for countdown display
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Discovery lists
  const [recentGlobalCases, setRecentGlobalCases] = useState<string[]>([]);
  const [, setUserCases] = useState<string[]>([]);
  const [, setRefreshingList] = useState<boolean>(false);

  // Waiting modal state
  const [waitingModalOpen, setWaitingModalOpen] = useState<boolean>(false);
  const [waitingModalTitle, setWaitingModalTitle] = useState<string>('');
  const [waitingModalStage, setWaitingModalStage] = useState<string>('');
  const [waitingElapsedSeconds, setWaitingElapsedSeconds] = useState<number>(0);
  const [currentTxHash, setCurrentTxHash] = useState<string>('');

  // Expandable evidence state
  const [expandedEvidence, setExpandedEvidence] = useState<{ [key: number]: boolean }>({});

  // Form states: Open Case
  const [openTitle, setOpenTitle] = useState<string>('');
  const [opposingAddress, setOpposingAddress] = useState<string>('');
  const [aliases1, setAliases1] = useState<string>('Contractor, Party 1');
  const [aliases2, setAliases2] = useState<string>('Client, Party 2');
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: 'crit_1', text: 'Timely milestone deliverable completion', weight_bp: 5000 },
    { id: 'crit_2', text: 'Code specifications and test coverage', weight_bp: 5000 },
  ]);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openSuccessMsg, setOpenSuccessMsg] = useState<string | null>(null);

  // Form states: Add Evidence
  const [evidenceCaseId, setEvidenceCaseId] = useState<string>('');
  const [evidenceText, setEvidenceText] = useState<string>('');
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceSuccessMsg, setEvidenceSuccessMsg] = useState<string | null>(null);

  // Form states: Lookup
  const [lookupInput, setLookupInput] = useState<string>('');

  // Action status
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load a case by ID from Studionet
  const loadCaseData = useCallback(async (caseId: string) => {
    if (!caseId) return;
    const cleanId = caseId.trim().toLowerCase();
    setLoadingCase(true);
    setCaseLoadError(null);
    setCaseErrorType(null);

    try {
      const [cRecordRes, certRes, lcRes, cOutcomeRes, cSettleRes] = await Promise.all([
        fetchCase(cleanId),
        fetchCertificate(cleanId),
        fetchLifecycle(cleanId),
        fetchOutcomeForConsumer(cleanId),
        fetchConsumerSettlement(cleanId),
      ]);

      // 1. Check for network / RPC transport failure
      if (!cRecordRes.ok || !certRes.ok) {
        const detail =
          (!cRecordRes.ok ? cRecordRes.error : '') ||
          (!certRes.ok ? certRes.error : '') ||
          'RPC communication error';
        setCaseLoadError(`Couldn't reach Studionet, try again (${detail})`);
        setCaseErrorType('network');
        setCaseRecord(null);
        setCertificate(null);
        setLifecycle(null);
        return;
      }

      // 2. Check for confirmed nonexistent case on-chain
      if (cRecordRes.data === null && certRes.data === null) {
        setCaseLoadError(`Case "${cleanId}" not found on Studionet.`);
        setCaseErrorType('not_found');
        setCaseRecord(null);
        setCertificate(null);
        setLifecycle(null);
        return;
      }

      // 3. Successful read with on-chain data
      setCaseLoadError(null);
      setCaseErrorType(null);
      setInspectedCaseId(cleanId);
      setCaseRecord(cRecordRes.data);
      setCertificate(certRes.data);
      setLifecycle(lcRes.ok ? lcRes.data : null);
      setConsumerOutcome(cOutcomeRes.ok && cOutcomeRes.data ? cOutcomeRes.data : 'PENDING');
      setConsumerSettlement(cSettleRes.ok && cSettleRes.data ? cSettleRes.data : '');
      setEvidenceCaseId(cleanId);
    } catch (err: any) {
      setCaseLoadError(`Couldn't reach Studionet, try again (${err.message || 'Network error'})`);
      setCaseErrorType('network');
    } finally {
      setLoadingCase(false);
    }
  }, []);

  // Initial load: Fetch initial case and global discovery lists
  useEffect(() => {
    loadCaseData(getInitialCaseId());
    refreshDiscoveryLists();
  }, [loadCaseData]);

  // Listen to URL hash query changes (e.g. /#/app?case=...)
  useEffect(() => {
    const onHashChange = () => {
      const nextId = getInitialCaseId();
      if (nextId) loadCaseData(nextId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [loadCaseData]);

  // When account changes, refresh user's cases
  useEffect(() => {
    if (account) {
      fetchCasesByParty(account, 10).then((res) => {
        if (res.ok && res.data) setUserCases(res.data);
      });
    } else {
      setUserCases([]);
    }
  }, [account]);

  const refreshDiscoveryLists = async () => {
    setRefreshingList(true);
    try {
      const globalRes = await fetchGlobalCases(0, 10);
      if (globalRes.ok && globalRes.data) {
        setRecentGlobalCases(globalRes.data);
      }
      if (account) {
        const partyRes = await fetchCasesByParty(account, 10);
        if (partyRes.ok && partyRes.data) {
          setUserCases(partyRes.data);
        }
      }
    } catch {
      // Ignored
    } finally {
      setRefreshingList(false);
    }
  };

  // Helper: Equalize weights
  const handleEqualizeWeights = () => {
    const count = criteria.length;
    if (count === 0) return;
    const baseWeight = Math.floor(10000 / count);
    const remainder = 10000 - baseWeight * count;

    setCriteria(
      criteria.map((c, idx) => ({
        ...c,
        weight_bp: idx === 0 ? baseWeight + remainder : baseWeight,
      }))
    );
  };

  const totalCriteriaWeight = criteria.reduce((sum, c) => sum + (Number(c.weight_bp) || 0), 0);

  // Compute connected wallet role in the currently inspected case
  const currentRole: 'PARTY_1' | 'PARTY_2' | 'OBSERVER' = (() => {
    if (!account || !caseRecord) return 'OBSERVER';
    const normAcc = account.toLowerCase();
    if (caseRecord.opener?.toLowerCase() === normAcc) return 'PARTY_1';
    if (caseRecord.opposing?.toLowerCase() === normAcc) return 'PARTY_2';
    return 'OBSERVER';
  })();

  const isParty = currentRole === 'PARTY_1' || currentRole === 'PARTY_2';
  const activeStatus: CaseStatus = (certificate?.status || caseRecord?.status || lifecycle?.status || 'OPEN') as CaseStatus;

  const readyFlags = certificate?.ready || caseRecord?.ready || lifecycle?.ready || { PARTY_1: false, PARTY_2: false };
  const finalAcks = certificate?.final_acks || caseRecord?.final_acks || lifecycle?.final_acks || { PARTY_1: false, PARTY_2: false };
  const evidenceDeadlineTs = certificate?.evidence_deadline_ts || caseRecord?.evidence_deadline_ts || lifecycle?.evidence_deadline_ts || 0;
  const judgedAtTs = certificate?.judged_at_ts || caseRecord?.judged_at_ts || lifecycle?.judged_at_ts || 0;
  const finalizeDeadlineTs = judgedAtTs > 0 ? judgedAtTs + FINALIZE_WINDOW_SECONDS : 0;

  const p1EvidenceCount = (caseRecord?.evidence || []).filter((e) => e.by === 'PARTY_1').length;
  const p2EvidenceCount = (caseRecord?.evidence || []).filter((e) => e.by === 'PARTY_2').length;
  const totalEvidenceCount = (caseRecord?.evidence || []).length;
  const myEvidenceCount = currentRole === 'PARTY_1' ? p1EvidenceCount : currentRole === 'PARTY_2' ? p2EvidenceCount : 0;
  const myReady = currentRole === 'PARTY_1' ? readyFlags.PARTY_1 : currentRole === 'PARTY_2' ? readyFlags.PARTY_2 : false;
  const myFinalAck = currentRole === 'PARTY_1' ? finalAcks.PARTY_1 : currentRole === 'PARTY_2' ? finalAcks.PARTY_2 : false;
  const otherFinalAck = currentRole === 'PARTY_1' ? finalAcks.PARTY_2 : currentRole === 'PARTY_2' ? finalAcks.PARTY_1 : false;

  const evidenceRemainingSec = evidenceDeadlineTs > 0 ? evidenceDeadlineTs - nowSec : 0;
  const evidenceWindowExpired = evidenceDeadlineTs > 0 && nowSec >= evidenceDeadlineTs;
  const finalizeRemainingSec = finalizeDeadlineTs > 0 ? finalizeDeadlineTs - nowSec : 0;
  const finalizeWindowExpired = finalizeDeadlineTs > 0 && nowSec >= finalizeDeadlineTs;

  const roundsCount = certificate?.rounds?.length || caseRecord?.rounds?.length || 0;
  const isReopenedRound = activeStatus === 'OPEN' && roundsCount > 0;

  // -------------------------------------------------------------------------
  // WRITE ACTION: Open Case
  // -------------------------------------------------------------------------
  const handleOpenCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenError(null);
    setOpenSuccessMsg(null);

    if (!isConnected || !account || !selectedProvider) {
      setOpenError('Please connect your browser wallet first.');
      return;
    }

    if (!openTitle.trim()) {
      setOpenError('Case title is required.');
      return;
    }

    if (!opposingAddress.trim() || !opposingAddress.startsWith('0x') || opposingAddress.length !== 42) {
      setOpenError('Valid 42-character opposing address (0x...) is required.');
      return;
    }

    if (criteria.length < 1 || criteria.length > 6) {
      setOpenError('Number of criteria must be between 1 and 6.');
      return;
    }

    for (let i = 0; i < criteria.length; i++) {
      const c = criteria[i];
      if (!c.text || !c.text.trim()) {
        setOpenError(`Criterion #${i + 1} description cannot be empty.`);
        return;
      }
      const w = Number(c.weight_bp);
      if (!Number.isInteger(w) || typeof c.weight_bp === 'boolean' || w < 1 || w > 10000) {
        setOpenError(`Criterion #${i + 1} weight must be an integer between 1 and 10,000 basis points.`);
        return;
      }
    }

    if (totalCriteriaWeight !== 10000) {
      setOpenError(`Criteria weights must sum to 10,000 bp (currently ${totalCriteriaWeight}).`);
      return;
    }

    try {
      const writeClient = getWriteClient(account, selectedProvider);
      const criteriaJson = JSON.stringify(criteria);

      setWaitingModalTitle('Opening Dispute Case');
      setWaitingModalStage('Submitting open_case transaction...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeOpenCase(
        writeClient,
        openTitle.trim(),
        criteriaJson,
        aliases1.trim(),
        aliases2.trim(),
        opposingAddress.trim()
      );
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec, errorReason } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(
          errorReason || `Transaction completed with status ${receipt?.status_name || 'UNKNOWN'}. Execution failed.`
        );
      }

      const pairRes = await fetchLatestCaseForPair(account, opposingAddress.trim());
      const discoveredCaseId = pairRes.ok && pairRes.data ? pairRes.data : null;

      if (discoveredCaseId) {
        const verifyRes = await verifyPostWriteState('open', discoveredCaseId, { title: openTitle.trim() });
        if (!verifyRes.verified) {
          throw new Error(`Write transaction succeeded, but post-write state verification failed: ${verifyRes.message}`);
        }

        setOpenSuccessMsg(
          `Case opened in ${durationSec}s (10-minute evidence window started). Case ID: ${discoveredCaseId}`
        );

        setInspectedCaseId(discoveredCaseId);
        setEvidenceCaseId(discoveredCaseId);
        await loadCaseData(discoveredCaseId);
        refreshDiscoveryLists();
        setActiveTab('evidence');
      } else {
        setOpenSuccessMsg(`Case opened in ${durationSec}s! Refreshing list...`);
        refreshDiscoveryLists();
      }
    } catch (err: any) {
      setWaitingModalOpen(false);
      setOpenError(err.message || 'Failed to open case');
    }
  };

  // -------------------------------------------------------------------------
  // WRITE ACTION: Add Evidence
  // -------------------------------------------------------------------------
  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setEvidenceError(null);
    setEvidenceSuccessMsg(null);

    if (!isConnected || !account || !selectedProvider) {
      setEvidenceError('Please connect your browser wallet first.');
      return;
    }

    if (!evidenceCaseId.trim()) {
      setEvidenceError('Please select or specify a Case ID.');
      return;
    }

    if (!evidenceText.trim()) {
      setEvidenceError('Evidence text cannot be empty.');
      return;
    }

    if (evidenceText.length > 1200) {
      setEvidenceError(`Evidence exceeds contract maximum of 1200 characters (${evidenceText.length} chars).`);
      return;
    }

    try {
      const writeClient = getWriteClient(account, selectedProvider);

      setWaitingModalTitle('Submitting On-Chain Evidence');
      setWaitingModalStage('Writing evidence entry to Studionet storage...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeAddEvidence(writeClient, evidenceCaseId.trim(), evidenceText.trim());
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec, errorReason } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(errorReason || `Evidence submission failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      const verifyRes = await verifyPostWriteState('evidence', evidenceCaseId.trim());
      if (!verifyRes.verified) {
        throw new Error(`Evidence transaction succeeded, but post-write state verification failed: ${verifyRes.message}`);
      }

      setEvidenceSuccessMsg(`Evidence accepted by validators in ${durationSec}s. Mark ready when finished.`);
      setEvidenceText('');
      await loadCaseData(evidenceCaseId.trim());
    } catch (err: any) {
      setWaitingModalOpen(false);
      setEvidenceError(err.message || 'Failed to submit evidence');
    }
  };

  // -------------------------------------------------------------------------
  // WRITE ACTION: Mark Ready
  // -------------------------------------------------------------------------
  const handleMarkReady = async (caseId: string) => {
    setActionError(null);
    setActionSuccessMsg(null);

    if (!isConnected || !account || !selectedProvider) {
      setActionError('Please connect your browser wallet first.');
      return;
    }

    try {
      const writeClient = getWriteClient(account, selectedProvider);

      setWaitingModalTitle('Declaring Evidence Readiness');
      setWaitingModalStage('Submitting mark_ready transaction to Studionet...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeMarkReady(writeClient, caseId);
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec, errorReason } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(errorReason || `mark_ready failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      const verifyRes = await verifyPostWriteState('ready', caseId, {
        partyKey: currentRole === 'PARTY_1' || currentRole === 'PARTY_2' ? currentRole : undefined,
      });
      if (!verifyRes.verified) {
        throw new Error(`mark_ready succeeded, but post-write state verification failed: ${verifyRes.message}`);
      }

      setActionSuccessMsg(`${verifyRes.message} (${durationSec}s)`);
      await loadCaseData(caseId);
    } catch (err: any) {
      setWaitingModalOpen(false);
      setActionError(err.message || 'Failed to mark ready');
    }
  };

  // -------------------------------------------------------------------------
  // WRITE ACTION: Close Evidence (After Deadline)
  // -------------------------------------------------------------------------
  const handleCloseEvidence = async (caseId: string) => {
    setActionError(null);
    setActionSuccessMsg(null);

    if (!isConnected || !account || !selectedProvider) {
      setActionError('Please connect your browser wallet first.');
      return;
    }

    try {
      const writeClient = getWriteClient(account, selectedProvider);

      setWaitingModalTitle('Closing Evidence Window');
      setWaitingModalStage('Submitting close_evidence transaction after window deadline...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeCloseEvidence(writeClient, caseId);
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec, errorReason } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(errorReason || `close_evidence failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      const verifyRes = await verifyPostWriteState('close', caseId);
      if (!verifyRes.verified) {
        throw new Error(`close_evidence succeeded, but post-write state verification failed: ${verifyRes.message}`);
      }

      setActionSuccessMsg(`Evidence window closed in ${durationSec}s (status: CLOSED). Ready for judging.`);
      await loadCaseData(caseId);
    } catch (err: any) {
      setWaitingModalOpen(false);
      setActionError(err.message || 'Failed to close evidence');
    }
  };

  // -------------------------------------------------------------------------
  // WRITE ACTION: Trigger Judge
  // -------------------------------------------------------------------------
  const handleTriggerJudge = async (caseId: string) => {
    setActionError(null);
    setActionSuccessMsg(null);

    if (!isConnected || !account || !selectedProvider) {
      setActionError('Please connect your browser wallet first.');
      return;
    }

    try {
      const writeClient = getWriteClient(account, selectedProvider);

      setWaitingModalTitle('Dual-Pass Adjudication in Progress');
      setWaitingModalStage('Invoking Canonical & Mirrored passes on GenVM validators...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeJudge(writeClient, caseId);
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec, errorReason } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(errorReason || `Judge execution failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      const verifyRes = await verifyPostWriteState('judge', caseId);
      if (!verifyRes.verified) {
        throw new Error(`Judge transaction succeeded, but post-write state verification failed: ${verifyRes.message}`);
      }

      setActionSuccessMsg(
        `Dual-pass adjudication accepted by validators in ${durationSec}s! ${verifyRes.message}`
      );
      await loadCaseData(caseId);
    } catch (err: any) {
      setWaitingModalOpen(false);
      setActionError(err.message || 'Adjudication failed');
    }
  };

  // -------------------------------------------------------------------------
  // WRITE ACTION: Finalize (Acknowledge & Close) Case
  // -------------------------------------------------------------------------
  const handleFinalizeCase = async (caseId: string) => {
    setActionError(null);
    setActionSuccessMsg(null);

    if (!isConnected || !account || !selectedProvider) {
      setActionError('Please connect your browser wallet first.');
      return;
    }

    try {
      const writeClient = getWriteClient(account, selectedProvider);

      setWaitingModalTitle('Acknowledging Verdict & Closing Case');
      setWaitingModalStage('Submitting finalize transaction to Studionet...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeFinalize(writeClient, caseId);
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec, errorReason } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(errorReason || `Finalize failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      const verifyRes = await verifyPostWriteState('finalize', caseId, {
        partyKey: currentRole === 'PARTY_1' || currentRole === 'PARTY_2' ? currentRole : undefined,
      });
      if (!verifyRes.verified) {
        throw new Error(`Finalize transaction succeeded, but post-write state verification failed: ${verifyRes.message}`);
      }

      setActionSuccessMsg(`${verifyRes.message} (${durationSec}s)`);
      await loadCaseData(caseId);
    } catch (err: any) {
      setWaitingModalOpen(false);
      setActionError(err.message || 'Acknowledge & close failed');
    }
  };

  // -------------------------------------------------------------------------
  // WRITE ACTION: Downstream Consumer Settlement
  // -------------------------------------------------------------------------
  const handleConsumerSettle = async (caseId: string) => {
    setActionError(null);
    setActionSuccessMsg(null);

    if (!isConnected || !account || !selectedProvider) {
      setActionError('Please connect your browser wallet first.');
      return;
    }

    try {
      const writeClient = getWriteClient(account, selectedProvider);

      setWaitingModalTitle('Settling Consumer Contract');
      setWaitingModalStage('Executing settlement policy on consumer contract...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeConsumerSettle(writeClient, caseId);
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec, errorReason } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(errorReason || `Consumer settlement failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      const verifyRes = await verifyPostWriteState('settle', caseId);
      if (!verifyRes.verified) {
        throw new Error(`Consumer settlement transaction succeeded, but post-write state verification failed: ${verifyRes.message}`);
      }

      setActionSuccessMsg(`Consumer settlement completed in ${durationSec}s!`);
      await loadCaseData(caseId);
    } catch (err: any) {
      setWaitingModalOpen(false);
      setActionError(err.message || 'Consumer settlement failed');
    }
  };

  // Plain language stability explanation
  const getStabilityExplanation = (decision: string) => {
    return parseDecision(decision).explanation;
  };

  const renderStabilityBadge = (decision: string) => {
    const parsed = parseDecision(decision);
    if (parsed.badgeType === 'pending') {
      return (
        <span className="silver-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium">
          <Clock className="w-3.5 h-3.5 text-[#6c727d]" />
          <span>{parsed.label}</span>
        </span>
      );
    }
    if (parsed.badgeType === 'stable') {
      return (
        <span className="status-badge-stable inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold motion-badge">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>STABLE</span>
        </span>
      );
    }
    if (parsed.badgeType === 'unstable') {
      return (
        <span className="status-badge-unstable inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold motion-badge">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>UNSTABLE</span>
        </span>
      );
    }
    if (parsed.badgeType === 'insufficient') {
      return (
        <span className="status-badge-insufficient inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold motion-badge">
          <Info className="w-4 h-4 text-blue-400" />
          <span>INSUFFICIENT EVIDENCE</span>
        </span>
      );
    }
    if (parsed.badgeType === 'split') {
      return (
        <span className="status-badge-split inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold motion-badge">
          <Scale className="w-4 h-4 text-amber-400" />
          <span>SPLIT VERDICT</span>
        </span>
      );
    }
    return (
      <span className="silver-pill inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium motion-badge">
        {parsed.label}
      </span>
    );
  };

  const activeDecision = certificate?.current_decision || caseRecord?.rounds?.slice(-1)[0]?.decision || '';

  // Compute why Add Evidence might be disabled
  const addEvidenceDisabledReason = (() => {
    if (!isConnected) return 'Connect your browser wallet to submit evidence.';
    if (!isParty) return 'Read-only observer view: only Party 1 (Opener) or Party 2 (Opposing) may submit evidence.';
    if (activeStatus !== 'OPEN') return `Evidence submission is closed because the case is in ${activeStatus} status.`;
    if (myReady) return 'You have already marked ready for this round; evidence is locked unless an UNSTABLE round reopens the case.';
    if (evidenceWindowExpired) return 'The 10-minute evidence window has expired; either party may now click Close evidence.';
    if (myEvidenceCount >= 3) return 'Maximum of 3 evidence entries reached for your party.';
    return null;
  })();

  const canMarkReady =
    isConnected &&
    isParty &&
    activeStatus === 'OPEN' &&
    !myReady &&
    myEvidenceCount >= 1 &&
    !evidenceWindowExpired;

  const canCloseEvidence =
    isConnected &&
    isParty &&
    activeStatus === 'OPEN' &&
    evidenceWindowExpired &&
    totalEvidenceCount >= 1;

  const canJudge = isConnected && isParty && activeStatus === 'CLOSED';

  const canFinalize =
    isConnected &&
    isParty &&
    activeStatus === 'JUDGED' &&
    (!myFinalAck || finalizeWindowExpired);

  const canSettleConsumer = isConnected && activeStatus === 'FINAL' && !consumerSettlement;

  const lifecycleSteps: Array<{ key: CaseStatus; title: string; subtitle: string }> = [
    { key: 'OPEN', title: 'OPEN', subtitle: 'Evidence & Readiness' },
    { key: 'CLOSED', title: 'CLOSED', subtitle: 'Ready for Judging' },
    { key: 'JUDGED', title: 'JUDGED', subtitle: 'Review & Acknowledge' },
    { key: 'FINAL', title: 'FINAL', subtitle: 'Closed & Settleable' },
  ];

  return (
    <div className="min-h-screen py-6 sm:py-10">
      {/* Waiting State Modal */}
      <WaitingStateModal
        isOpen={waitingModalOpen}
        title={waitingModalTitle}
        stageName={waitingModalStage}
        elapsedSeconds={waitingElapsedSeconds}
        txHash={currentTxHash}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Compact Header Section */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#eef0f2] tracking-tight reveal-up" style={{ '--reveal-delay': '50ms' } as React.CSSProperties}>
                Dispute Workbench
              </h1>
              <span className="silver-pill text-xs px-2.5 py-0.5 rounded-full font-mono text-stone-300 flex items-center gap-1.5 motion-badge" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                <span>{STUDIONET_NAME}</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#9fa5b0] reveal-fade" style={{ '--reveal-delay': '160ms' } as React.CSSProperties}>
              How to try it: Open -&gt; Add evidence &amp; Mark ready -&gt; Judge -&gt; Acknowledge -&gt; Settle on Consumer.
            </p>
          </div>

          <div className="flex items-center gap-2.5 reveal-up" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono text-[#9fa5b0] bg-[#121417] border border-white/[0.08] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-400" />
                  <span>{account?.substring(0, 6)}...{account?.substring(account.length - 4)}</span>
                </div>
                <button
                  onClick={openChooser}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl btn-silver-glass cursor-pointer"
                  title="Choose wallet extension for Party 2"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-stone-300" />
                  <span>Switch Wallet</span>
                </button>
              </div>
            ) : (
              <button
                onClick={openChooser}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl btn-silver-primary cursor-pointer shadow-xs"
              >
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </section>

        {/* Action feedback banners */}
        {actionSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-300 reveal-up">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-400 hover:text-white font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between gap-3 text-xs sm:text-sm text-rose-300 reveal-up">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-400 hover:text-white font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Two-Column Desktop Composition: LEFT Actions | RIGHT Authoritative Certificate */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* LEFT: Actions and Workflow (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* 4 Clean Tabs: Cases | Open | Evidence | Judge */}
            <div className="p-1 bg-[#121417]/90 rounded-xl flex gap-1 border border-white/[0.08] reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
              {(['cases', 'open', 'evidence', 'judge'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 capitalize cursor-pointer text-center ${
                    activeTab === tab
                      ? 'bg-white/[0.12] text-white border border-white/[0.18] shadow-xs'
                      : 'text-[#9fa5b0] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* TAB 1: CASES (Compact Demos + Lookup) */}
            {activeTab === 'cases' && (
              <div className="silver-frame p-5 space-y-4 motion-panel">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#eef0f2] text-sm sm:text-base">On-Chain Demos (Schema 2.0.0)</h3>
                  <span className="silver-pill text-[11px] font-semibold px-2 py-0.5 rounded-md text-stone-300 motion-badge">
                    No Wallet Required
                  </span>
                </div>

                {/* Compact Demo Cards */}
                <div className="space-y-2.5">
                  {/* Demo A */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_A.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition cursor-pointer stagger-item ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_A.id
                        ? 'bg-white/[0.08] border-white/[0.25] shadow-[0_0_12px_rgba(255,255,255,0.04)]'
                        : 'bg-[#121417]/70 border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.03]'
                    }`}
                    style={{ '--reveal-delay': '60ms' } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-stone-300">Demo A (Both Ready + Dual Ack)</span>
                      <span className="text-[10px] font-mono text-[#6c727d]">
                        {VERIFIED_DEMO_CASES.DEMO_A.id}
                      </span>
                    </div>
                    <div className="text-xs sm:text-[13px] text-[#9fa5b0] mb-2">
                      Both parties mark ready -&gt; CLOSED -&gt; judge -&gt; both acknowledge -&gt; FINAL (SETTLED_PARTY_1).
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-emerald-400 motion-badge">
                        FINAL | DECIDED | PARTY 1
                      </span>
                      <span className="text-[11px] text-stone-300 underline font-medium">Inspect</span>
                    </div>
                  </button>

                  {/* Demo B */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_B.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition cursor-pointer stagger-item ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_B.id
                        ? 'bg-white/[0.08] border-white/[0.25] shadow-[0_0_12px_rgba(255,255,255,0.04)]'
                        : 'bg-[#121417]/70 border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.03]'
                    }`}
                    style={{ '--reveal-delay': '140ms' } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-stone-300">Demo B (10m Timeout Close)</span>
                      <span className="text-[10px] font-mono text-[#6c727d]">
                        {VERIFIED_DEMO_CASES.DEMO_B.id}
                      </span>
                    </div>
                    <div className="text-xs sm:text-[13px] text-[#9fa5b0] mb-2">
                      Party 2 silent across 600s window -&gt; close_evidence -&gt; INSUFFICIENT -&gt; FINAL (ESCALATED).
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-blue-400 motion-badge">
                        FINAL | INSUFFICIENT | NONE
                      </span>
                      <span className="text-[11px] text-stone-300 underline font-medium">Inspect</span>
                    </div>
                  </button>

                  {/* Demo C */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_C.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition cursor-pointer stagger-item ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_C.id
                        ? 'bg-white/[0.08] border-white/[0.25] shadow-[0_0_12px_rgba(255,255,255,0.04)]'
                        : 'bg-[#121417]/70 border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.03]'
                    }`}
                    style={{ '--reveal-delay': '220ms' } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-stone-300">Demo C (5m Review Window Close)</span>
                      <span className="text-[10px] font-mono text-[#6c727d]">
                        {VERIFIED_DEMO_CASES.DEMO_C.id}
                      </span>
                    </div>
                    <div className="text-xs sm:text-[13px] text-[#9fa5b0] mb-2">
                      Balanced SLA claims -&gt; SPLIT verdict -&gt; 1 party ack + 300s review window -&gt; FINAL (SETTLED_SPLIT).
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-amber-400 motion-badge">
                        FINAL | DECIDED | SPLIT
                      </span>
                      <span className="text-[11px] text-stone-300 underline font-medium">Inspect</span>
                    </div>
                  </button>

                  {/* Demo D */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_D.id)}
                    className={`w-full p-3.5 rounded-xl border text-left transition cursor-pointer stagger-item ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_D.id
                        ? 'bg-white/[0.08] border-white/[0.25] shadow-[0_0_12px_rgba(255,255,255,0.04)]'
                        : 'bg-[#121417]/70 border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.03]'
                    }`}
                    style={{ '--reveal-delay': '260ms' } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-stone-300">Demo D (Unstable -&gt; Reopened)</span>
                      <span className="text-[10px] font-mono text-[#6c727d]">
                        {VERIFIED_DEMO_CASES.DEMO_D.id}
                      </span>
                    </div>
                    <div className="text-xs sm:text-[13px] text-[#9fa5b0] mb-2">
                      Canonical and mirrored passes diverge -&gt; UNSTABLE -&gt; auto-reopened to OPEN for Round 2.
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-rose-400 motion-badge">
                        OPEN (Round 2) | UNSTABLE
                      </span>
                      <span className="text-[11px] text-stone-300 underline font-medium">Inspect</span>
                    </div>
                  </button>
                </div>

                {/* Custom ID Lookup & Recent Cases (Integrated inside Cases tab) */}
                <div className="pt-3 border-t border-white/[0.08] space-y-3 stagger-item" style={{ '--reveal-delay': '280ms' } as React.CSSProperties}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={lookupInput}
                      onChange={(e) => setLookupInput(e.target.value)}
                      placeholder="Enter 12-char Case ID"
                      className="silver-input flex-1 text-xs font-mono p-2 rounded-lg"
                    />
                    <button
                      onClick={() => {
                        if (lookupInput.trim()) loadCaseData(lookupInput.trim());
                      }}
                      className="px-3 py-2 text-xs font-semibold btn-silver-primary rounded-lg cursor-pointer"
                    >
                      Query
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#6c727d] uppercase tracking-wider block">
                      Recent Cases on Studionet:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {recentGlobalCases.slice(0, 5).map((id) => (
                        <button
                          key={id}
                          onClick={() => loadCaseData(id)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                            inspectedCaseId === id
                              ? 'bg-white/[0.18] text-white font-bold'
                              : 'silver-pill hover:text-white'
                          }`}
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: OPEN CASE */}
            {activeTab === 'open' && (
              <form onSubmit={handleOpenCase} className="silver-frame p-5 space-y-4 motion-panel">
                <div className="space-y-1 stagger-item" style={{ '--reveal-delay': '40ms' } as React.CSSProperties}>
                  <h3 className="font-bold text-[#eef0f2] text-sm sm:text-base">Open Dispute Case</h3>
                  <p className="text-xs text-[#9fa5b0]">
                    Configures weighted criteria, party aliases, and starts a {EVIDENCE_WINDOW_SECONDS / 60}-minute evidence window.
                  </p>
                </div>

                {openError && (
                  <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2 reveal-up">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{openError}</span>
                  </div>
                )}

                {openSuccessMsg && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2 reveal-up">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{openSuccessMsg}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="stagger-item" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
                    <label className="block text-xs font-medium text-[#9fa5b0] mb-1">
                      Dispute Title
                    </label>
                    <input
                      type="text"
                      value={openTitle}
                      onChange={(e) => setOpenTitle(e.target.value)}
                      placeholder="e.g. Milestone 2 Deliverable Verification"
                      className="silver-input w-full text-xs p-2.5 rounded-lg"
                      required
                    />
                  </div>

                  <div className="stagger-item" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
                    <label className="block text-xs font-medium text-[#9fa5b0] mb-1">
                      Opposing Address (Party 2)
                    </label>
                    <input
                      type="text"
                      value={opposingAddress}
                      onChange={(e) => setOpposingAddress(e.target.value)}
                      placeholder="0x..."
                      className="silver-input w-full text-xs font-mono p-2.5 rounded-lg"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 stagger-item" style={{ '--reveal-delay': '160ms' } as React.CSSProperties}>
                    <div>
                      <label className="block text-[11px] font-medium text-[#9fa5b0] mb-1">
                        Party 1 Aliases
                      </label>
                      <input
                        type="text"
                        value={aliases1}
                        onChange={(e) => setAliases1(e.target.value)}
                        className="silver-input w-full text-xs p-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#9fa5b0] mb-1">
                        Party 2 Aliases
                      </label>
                      <input
                        type="text"
                        value={aliases2}
                        onChange={(e) => setAliases2(e.target.value)}
                        className="silver-input w-full text-xs p-2 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Criteria Builder */}
                  <div className="space-y-2 pt-2 border-t border-white/[0.08] stagger-item" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#eef0f2]">
                        Criteria ({criteria.length}/4) |{' '}
                        <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs criteria-total-badge ${
                          totalCriteriaWeight === 10000
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {(totalCriteriaWeight / 100).toFixed(0)}% allocated
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={handleEqualizeWeights}
                        className="text-[11px] text-stone-300 hover:text-white underline cursor-pointer"
                      >
                        Equalize
                      </button>
                    </div>

                    {criteria.map((c, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg silver-frame-inset space-y-1.5 transition-all duration-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#9fa5b0]">Criterion #{idx + 1}</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={c.weight_bp}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setCriteria(
                                  criteria.map((item, i) =>
                                    i === idx ? { ...item, weight_bp: val } : item
                                  )
                                );
                              }}
                              className="w-16 text-xs font-mono p-1 rounded border border-white/[0.10] text-right bg-[#0c0d0f] text-[#eef0f2]"
                            />
                            <span className="text-[11px] text-[#6c727d]">bp</span>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={c.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCriteria(
                              criteria.map((item, i) =>
                                i === idx ? { ...item, text: val } : item
                              )
                            );
                          }}
                          placeholder="Specification statement"
                          className="w-full text-xs p-1.5 rounded border border-white/[0.08] bg-[#0c0d0f] text-[#eef0f2]"
                        />
                      </div>
                    ))}

                    <button
                      type="button"
                      disabled={criteria.length >= 4}
                      onClick={() =>
                        setCriteria([
                          ...criteria,
                          { id: `crit_${criteria.length + 1}`, text: '', weight_bp: 0 },
                        ])
                      }
                      className="text-xs font-medium text-stone-300 hover:text-white disabled:opacity-40 flex items-center gap-1 cursor-pointer pt-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add Criterion</span>
                    </button>
                  </div>
                </div>

                <div className="stagger-item pt-1" style={{ '--reveal-delay': '250ms' } as React.CSSProperties}>
                  <button
                    type="submit"
                    disabled={!isConnected || totalCriteriaWeight !== 10000}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold btn-silver-primary cursor-pointer disabled:opacity-40 shadow-xs"
                  >
                    {!isConnected ? 'Connect Wallet to Open Case' : 'Open Dispute on Studionet'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: ADD EVIDENCE & READINESS */}
            {activeTab === 'evidence' && (
              <div className="silver-frame p-5 space-y-4 motion-panel">
                <form onSubmit={handleAddEvidence} className="space-y-4">
                  <div className="flex items-center justify-between stagger-item" style={{ '--reveal-delay': '40ms' } as React.CSSProperties}>
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-[#eef0f2] text-sm sm:text-base">Evidence &amp; Readiness</h3>
                      <p className="text-xs text-[#9fa5b0]">Up to 3 entries/party (&le;1200 chars), then Mark ready</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#6c727d] uppercase tracking-wider block">Your Role</span>
                      <span className="font-mono text-xs font-bold text-stone-200">
                        {currentRole === 'PARTY_1'
                          ? 'Party 1 (Opener)'
                          : currentRole === 'PARTY_2'
                            ? 'Party 2 (Opposing)'
                            : 'Observer (Read-Only)'}
                      </span>
                    </div>
                  </div>

                  {evidenceError && (
                    <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2 reveal-up">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                      <span>{evidenceError}</span>
                    </div>
                  )}

                  {evidenceSuccessMsg && (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2 reveal-up">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                      <span>{evidenceSuccessMsg}</span>
                    </div>
                  )}

                  {addEvidenceDisabledReason && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed flex items-start gap-2">
                      <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>{addEvidenceDisabledReason}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="stagger-item" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
                      <label className="block text-xs font-medium text-[#9fa5b0] mb-1">Target Case ID</label>
                      <input
                        type="text"
                        value={evidenceCaseId}
                        onChange={(e) => setEvidenceCaseId(e.target.value)}
                        placeholder="12-char Case ID"
                        className="silver-input w-full text-xs font-mono p-2 rounded-lg"
                        required
                      />
                    </div>

                    <div className="stagger-item" style={{ '--reveal-delay': '140ms' } as React.CSSProperties}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-medium text-[#9fa5b0]">Verifiable Facts &amp; Quotes</label>
                        <span className={`text-[11px] font-mono transition-colors ${evidenceText.length > 1200 ? 'text-rose-400 font-bold' : 'text-[#6c727d]'}`}>
                          {evidenceText.length} / 1200
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={evidenceText}
                        onChange={(e) => setEvidenceText(e.target.value)}
                        placeholder="Enter factual statements, git commit citations, or deployment records..."
                        className="silver-input w-full text-xs p-2.5 rounded-lg leading-relaxed"
                        disabled={Boolean(addEvidenceDisabledReason)}
                        required
                      />
                    </div>
                  </div>

                  <div className="stagger-item pt-1" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
                    <button
                      type="submit"
                      disabled={Boolean(addEvidenceDisabledReason) || evidenceText.trim().length === 0 || evidenceText.length > 1200}
                      title={addEvidenceDisabledReason || 'Submit evidence entry to on-chain storage'}
                      className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold btn-silver-primary cursor-pointer disabled:opacity-40 shadow-xs"
                    >
                      {!isConnected ? 'Connect Wallet' : 'Add evidence'}
                    </button>
                  </div>
                </form>

                {/* Readiness & Evidence Closing Controls inside Evidence Tab */}
                <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
                  <div className="text-[11px] font-bold text-stone-300 uppercase tracking-wider">
                    Readiness &amp; Closing Protocol
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleMarkReady(inspectedCaseId)}
                      disabled={!canMarkReady}
                      title={
                        !isParty
                          ? 'Only Party 1 or Party 2 may mark ready'
                          : myReady
                            ? 'You already marked ready for this round'
                            : myEvidenceCount < 1
                              ? 'Submit at least 1 evidence entry before marking ready'
                              : evidenceWindowExpired
                                ? 'Evidence window has expired; use Close evidence instead'
                                : 'Declare your evidence complete for this round'
                      }
                      className="py-2 px-3 rounded-xl text-xs font-bold btn-silver-glass cursor-pointer disabled:opacity-40"
                    >
                      {myReady ? 'Marked Ready' : 'Mark ready'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCloseEvidence(inspectedCaseId)}
                      disabled={!canCloseEvidence}
                      title={
                        !isParty
                          ? 'Only Party 1 or Party 2 may close evidence'
                          : !evidenceWindowExpired
                            ? 'Available only after the 10-minute evidence deadline expires'
                            : totalEvidenceCount < 1
                              ? 'At least 1 evidence entry on record is required to close'
                              : 'Close evidence window after deadline so judging can proceed'
                      }
                      className="py-2 px-3 rounded-xl text-xs font-bold btn-silver-glass cursor-pointer disabled:opacity-40"
                    >
                      Close evidence
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: JUDGE ACTION */}
            {activeTab === 'judge' && (
              <div className="silver-frame p-5 space-y-4 motion-panel">
                <div className="space-y-1 stagger-item" style={{ '--reveal-delay': '40ms' } as React.CSSProperties}>
                  <h3 className="font-bold text-[#eef0f2] text-sm sm:text-base">Execute Judge Consensus</h3>
                  <p className="text-xs text-[#9fa5b0]">
                    Restricted to Party 1 or Party 2 when case status is CLOSED.
                  </p>
                </div>

                {activeStatus === 'CLOSED' ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2 reveal-up">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold">Evidence is CLOSED -- ready for party-triggered judging</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2 reveal-up">
                    <Info className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Current status is <strong>{activeStatus}</strong>. Judging requires status <strong>CLOSED</strong> (both parties mark ready, or close_evidence after the 10m window).
                    </span>
                  </div>
                )}

                {!isParty && (
                  <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300">
                    Only Party 1 or Party 2 may trigger judging.
                  </div>
                )}

                <div className="p-3.5 rounded-xl silver-frame-inset space-y-2 text-xs stagger-item" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9fa5b0]">Target Case ID:</span>
                    <span className="font-mono font-bold text-[#eef0f2]">{inspectedCaseId || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9fa5b0]">Lifecycle Status:</span>
                    <span className="font-mono font-bold text-[#eef0f2]">{activeStatus}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9fa5b0]">Submitted Evidence:</span>
                    <span className="font-mono text-[#eef0f2]">
                      {totalEvidenceCount} entries (P1: {p1EvidenceCount}, P2: {p2EvidenceCount})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9fa5b0]">Adjudication Rounds:</span>
                    <span className="font-mono text-[#eef0f2]">{roundsCount} / {caseRecord?.max_rounds || 3}</span>
                  </div>
                </div>

                <div className="stagger-item pt-1" style={{ '--reveal-delay': '220ms' } as React.CSSProperties}>
                  <button
                    onClick={() => handleTriggerJudge(inspectedCaseId)}
                    disabled={!canJudge || !inspectedCaseId}
                    title={!isParty ? 'Only Party 1 or Party 2 may trigger judging.' : activeStatus !== 'CLOSED' ? 'Case must be in CLOSED status before judging.' : 'Trigger dual-pass mirrored judging'}
                    className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold btn-silver-primary cursor-pointer disabled:opacity-40 shadow-md flex items-center justify-center gap-2"
                  >
                    <Gavel className="w-4 h-4" />
                    <span>Judge ({inspectedCaseId.substring(0, 6)}...)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Authoritative Case Inspection & Stability Certificate (7 cols) */}
          <div className="lg:col-span-7">
            <div key={inspectedCaseId} className="silver-frame-raised p-6 sm:p-7 space-y-6 certificate-reveal">
              {/* Header: Title and refresh */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="silver-pill text-xs font-mono px-2 py-0.5 rounded font-semibold text-stone-300 motion-badge">
                      ID: {inspectedCaseId}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold bg-white/[0.06] border border-white/[0.10] text-[#eef0f2] motion-badge">
                      Status: {isReopenedRound ? `OPEN (Evidence reopened for Round ${roundsCount + 1})` : activeStatus}
                    </span>
                    <span className="text-[11px] font-mono text-[#6c727d]">
                      Schema {certificate?.schema_version || caseRecord?.schema_version || '2.0.0'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#eef0f2] leading-tight">
                    {caseRecord?.title || certificate?.title || 'Stability Certificate'}
                  </h2>
                </div>

                <button
                  onClick={() => loadCaseData(inspectedCaseId)}
                  disabled={loadingCase}
                  className="p-2 rounded-lg silver-frame-inset hover:border-white/[0.20] text-[#9fa5b0] hover:text-white transition cursor-pointer shrink-0"
                  title="Refresh on-chain state"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingCase ? 'animate-spin text-white' : ''}`} />
                </button>
              </div>

              {/* 4-Phase Lifecycle Bar / Stepper */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#9fa5b0]">
                  <span className="font-bold uppercase tracking-wider text-stone-300">4-Phase Dispute Lifecycle</span>
                  <span className="font-mono">
                    Role: {currentRole === 'PARTY_1' ? 'Party 1' : currentRole === 'PARTY_2' ? 'Party 2' : 'Observer (Read-Only)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="lifecycle-stepper">
                  {lifecycleSteps.map((step, idx) => {
                    const isCurrent = activeStatus === step.key;
                    const stepIndex = lifecycleSteps.findIndex((s) => s.key === activeStatus);
                    const isPassed = idx < stepIndex;
                    return (
                      <div
                        key={step.key}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          isCurrent
                            ? 'bg-white/[0.12] border-white/[0.30] text-white shadow-xs'
                            : isPassed
                              ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-300'
                              : 'bg-[#121417]/60 border-white/[0.07] text-[#6c727d]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono font-bold">
                          <span>0{idx + 1} / {step.title}</span>
                          {isCurrent && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                        </div>
                        <div className="text-[11px] mt-0.5 leading-snug opacity-90">{step.subtitle}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reopened Round Notice (when status === 'OPEN' and rounds.length > 0) */}
              {isReopenedRound && (
                <div className="p-4 rounded-xl bg-amber-950/35 border border-amber-500/40 text-xs sm:text-sm text-amber-200 space-y-1 reveal-up" data-testid="reopened-round-banner">
                  <div className="font-bold text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>OPEN (Evidence reopened for Round {roundsCount + 1})</span>
                  </div>
                  <p className="leading-relaxed">
                    Round {roundsCount} was UNSTABLE -- evidence reopened for Round {roundsCount + 1} with a fresh 10-minute window. Both parties must mark ready again (or wait for the deadline) before re-judging.
                  </p>
                </div>
              )}

              {/* Phase-Specific Protocol Panel */}
              {activeStatus === 'OPEN' && caseRecord && (
                <div className="p-4 rounded-xl silver-frame-inset space-y-3 border border-white/[0.10]" data-testid="evidence-window-panel">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="font-bold text-stone-200 uppercase tracking-wider">
                      Phase 1: Evidence &amp; Readiness Window ({EVIDENCE_WINDOW_SECONDS / 60}m)
                    </span>
                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.10] text-stone-200">
                      {evidenceWindowExpired
                        ? 'Window expired -- either party may close evidence'
                        : `${formatCountdown(evidenceRemainingSec)} remaining`}
                    </span>
                  </div>

                  <div className="text-xs text-[#9fa5b0] font-mono">
                    Evidence Deadline: {formatUtcTimestamp(evidenceDeadlineTs)} (unix: {evidenceDeadlineTs})
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className={`p-2.5 rounded-lg border ${readyFlags.PARTY_1 ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300' : 'bg-[#121417]/80 border-white/[0.08] text-stone-300'}`}>
                      <span className="font-semibold">
                        Party 1: {readyFlags.PARTY_1 ? `Ready (${p1EvidenceCount} items)` : `Submitting (${p1EvidenceCount}/3 items)`}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${readyFlags.PARTY_2 ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300' : 'bg-[#121417]/80 border-white/[0.08] text-stone-300'}`}>
                      <span className="font-semibold">
                        Party 2: {readyFlags.PARTY_2 ? `Ready (${p2EvidenceCount} items)` : `Submitting (${p2EvidenceCount}/3 items)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleMarkReady(inspectedCaseId)}
                      disabled={!canMarkReady}
                      className="py-1.5 px-3.5 rounded-lg text-xs font-bold btn-silver-primary cursor-pointer disabled:opacity-40"
                    >
                      Mark ready
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCloseEvidence(inspectedCaseId)}
                      disabled={!canCloseEvidence}
                      className="py-1.5 px-3.5 rounded-lg text-xs font-semibold btn-silver-glass cursor-pointer disabled:opacity-40"
                    >
                      Close evidence
                    </button>
                    {!isParty && (
                      <span className="text-[11px] text-[#6c727d] self-center">
                        Connect as Party 1 or Party 2 to submit evidence, mark ready, or close the window.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {activeStatus === 'CLOSED' && caseRecord && (
                <div className="p-4 rounded-xl silver-frame-inset space-y-3 border border-white/[0.10]" data-testid="judging-panel">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="font-bold text-stone-200 uppercase tracking-wider">
                      Phase 2: Evidence Closed -- Ready for Judging
                    </span>
                    <span className="font-mono text-[11px] text-[#9fa5b0]">
                      Closed at: {formatUtcTimestamp(caseRecord.closed_at_ts)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-[#9fa5b0]">
                      {isParty
                        ? 'You are a party to this dispute and may now trigger dual-pass mirrored judging.'
                        : 'Only Party 1 or Party 2 may trigger judging.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTriggerJudge(inspectedCaseId)}
                      disabled={!canJudge}
                      className="py-1.5 px-4 rounded-lg text-xs font-bold btn-silver-primary cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      <span>Judge</span>
                    </button>
                  </div>
                </div>
              )}

              {activeStatus === 'JUDGED' && caseRecord && (
                <div className="p-4 rounded-xl silver-frame-inset space-y-3 border border-white/[0.10]" data-testid="finalization-panel">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="font-bold text-stone-200 uppercase tracking-wider">
                      Phase 3: Certificate Review &amp; Acknowledgment ({FINALIZE_WINDOW_SECONDS / 60}m Window)
                    </span>
                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.10] text-stone-200">
                      {finalizeWindowExpired
                        ? 'Review window elapsed -- acknowledging party may close to FINAL'
                        : `Review window: ${formatCountdown(finalizeRemainingSec)} remaining`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className={`p-2.5 rounded-lg border ${finalAcks.PARTY_1 ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300' : 'bg-[#121417]/80 border-white/[0.08] text-stone-300'}`}>
                      <span className="font-semibold">
                        Party 1: {finalAcks.PARTY_1 ? 'Acknowledged' : 'Awaiting ack'}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-lg border ${finalAcks.PARTY_2 ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300' : 'bg-[#121417]/80 border-white/[0.08] text-stone-300'}`}>
                      <span className="font-semibold">
                        Party 2: {finalAcks.PARTY_2 ? 'Acknowledged' : 'Awaiting ack'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleFinalizeCase(inspectedCaseId)}
                      disabled={!canFinalize}
                      className="py-1.5 px-4 rounded-lg text-xs font-bold btn-silver-primary cursor-pointer disabled:opacity-40"
                    >
                      {!isParty
                        ? 'Acknowledge and close (Party only)'
                        : myFinalAck && !finalizeWindowExpired
                          ? `Acknowledged -- waiting for counterparty or review window (${formatCountdown(finalizeRemainingSec)})`
                          : otherFinalAck || finalizeWindowExpired
                            ? 'Acknowledge and close'
                            : 'Acknowledge verdict'}
                    </button>
                    <span className="text-[11px] text-[#6c727d]">
                      Reaches FINAL when both parties acknowledge or 5m after 1st acknowledgment.
                    </span>
                  </div>
                </div>
              )}

              {/* Error indicator */}
              {caseLoadError && (
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 flex items-start justify-between gap-3 reveal-up">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <span>{caseLoadError}</span>
                  </div>
                  {caseErrorType === 'network' && (
                    <button
                      onClick={() => loadCaseData(inspectedCaseId)}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-amber-200 font-semibold cursor-pointer shrink-0 text-xs"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {/* Dominant Verdict & Stability Banner with Sequential Reveal */}
              <div className="p-4 sm:p-5 rounded-xl silver-frame-inset space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                    Authoritative Verdict
                  </span>
                  {renderStabilityBadge(activeDecision)}
                </div>

                <div className="space-y-1">
                  <div className="text-xl sm:text-2xl font-extrabold text-[#eef0f2] tracking-tight verdict-stage-1">
                    {parseDecision(activeDecision).certificateTitle}
                  </div>
                  <div className="text-sm sm:text-base font-medium text-stone-300 verdict-stage-2">
                    {getStabilityExplanation(activeDecision)}
                  </div>
                </div>

                {activeDecision && (
                  <div className="text-xs text-[#9fa5b0] pt-1.5 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
                    <span>On-chain Decision String:</span>
                    <code className="font-mono font-bold text-white bg-white/[0.08] px-2 py-0.5 rounded border border-white/[0.12]">
                      {activeDecision}
                    </code>
                  </div>
                )}
              </div>

              {/* Compact Timeline Round History */}
              {caseRecord?.rounds && caseRecord.rounds.length > 0 && (
                <div className="space-y-2 stagger-item" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                    Consensus Round History
                  </span>
                  <div className="space-y-1.5">
                    {caseRecord.rounds.map((rnd, rIdx) => (
                      <div
                        key={rnd.n}
                        className="p-2.5 rounded-lg silver-frame-inset flex items-center justify-between text-xs sm:text-sm stagger-item"
                        style={{ '--reveal-delay': `${rIdx * 70 + 100}ms` } as React.CSSProperties}
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <span className="w-5 h-5 rounded bg-white/[0.08] border border-white/[0.12] text-white flex items-center justify-center font-bold text-[10px] motion-badge">
                            {rnd.n < 10 ? `0${rnd.n}` : rnd.n}
                          </span>
                          <span className="text-[#9fa5b0]">Round {rnd.n}</span>
                        </div>
                        <div
                          className={`font-mono font-semibold text-xs sm:text-[13px] motion-badge ${
                            parseDecision(rnd.decision).badgeType === 'unstable'
                              ? 'text-rose-400'
                              : parseDecision(rnd.decision).badgeType === 'split'
                                ? 'text-amber-400'
                                : parseDecision(rnd.decision).badgeType === 'insufficient'
                                  ? 'text-blue-400'
                                  : 'text-emerald-400'
                          }`}
                        >
                          {rnd.decision}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Criteria Breakdown */}
              {caseRecord?.criteria && (
                <div className="space-y-2 stagger-item" style={{ '--reveal-delay': '150ms' } as React.CSSProperties}>
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                    Adjudication Criteria &amp; Weights
                  </span>
                  <div className="space-y-1.5">
                    {caseRecord.criteria.map((c, cIdx) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-lg silver-frame-inset flex items-center justify-between text-xs sm:text-sm stagger-item"
                        style={{ '--reveal-delay': `${cIdx * 50 + 150}ms` } as React.CSSProperties}
                      >
                        <div className="pr-3">
                          <span className="text-[#eef0f2]">{c.text}</span>
                        </div>
                        <div className="shrink-0 font-mono font-semibold text-stone-300 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08] text-xs">
                          {(c.weight_bp / 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence Log with Expand/Collapse */}
              {caseRecord?.evidence && (
                <div className="space-y-2 stagger-item" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                      Submitted Evidence ({caseRecord.evidence.length})
                    </span>
                    <span className="text-[11px] text-[#6c727d]">Max 3 entries/party</span>
                  </div>

                  {caseRecord.evidence.length === 0 ? (
                    <div className="p-3.5 rounded-lg silver-frame-inset text-xs text-[#6c727d] text-center italic">
                      No evidence has been entered for this dispute yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {caseRecord.evidence.map((ev, idx) => {
                        const isExpanded = !!expandedEvidence[idx];
                        const isLong = ev.text.length > 220;
                        const displayText = !isLong || isExpanded ? ev.text : `${ev.text.slice(0, 220)}...`;

                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-lg silver-frame-inset text-xs sm:text-sm space-y-1.5 stagger-item expand-content"
                            style={{ '--reveal-delay': `${idx * 60 + 200}ms` } as React.CSSProperties}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={`font-semibold px-2 py-0.5 rounded border ${
                                  ev.by === 'PARTY_1'
                                    ? 'bg-white/[0.08] border-white/[0.14] text-white'
                                    : 'bg-stone-900 border-white/[0.08] text-stone-300'
                                }`}
                              >
                                {ev.by === 'PARTY_1' ? 'Party 1 (Opener)' : 'Party 2 (Opposing)'}
                              </span>
                              <span className="text-[#6c727d] font-mono text-[11px]">Entry #{idx + 1}</span>
                            </div>
                            <p className="text-[#9fa5b0] leading-relaxed font-sans">{displayText}</p>
                            {isLong && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedEvidence((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }))
                                }
                                className="text-[11px] text-stone-300 hover:text-white underline cursor-pointer flex items-center gap-1"
                              >
                                <span>{isExpanded ? 'Show less' : 'Read full entry'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Actor Addresses & Aliases */}
              {caseRecord && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs stagger-item" style={{ '--reveal-delay': '250ms' } as React.CSSProperties}>
                  <div className="p-3 rounded-lg silver-frame-inset space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Party 1 (Opener)</span>
                      <span className="text-[10px] font-mono text-[#9fa5b0]">
                        Ready: {readyFlags.PARTY_1 ? 'Yes' : 'No'} | Ack: {finalAcks.PARTY_1 ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <span className="font-mono text-[#eef0f2] block truncate" title={caseRecord.opener}>
                      {caseRecord.opener}
                    </span>
                    <div className="text-[11px] text-[#6c727d] truncate">
                      Aliases: {caseRecord.aliases1?.join(', ') || 'None'}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg silver-frame-inset space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Party 2 (Opposing)</span>
                      <span className="text-[10px] font-mono text-[#9fa5b0]">
                        Ready: {readyFlags.PARTY_2 ? 'Yes' : 'No'} | Ack: {finalAcks.PARTY_2 ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <span className="font-mono text-[#eef0f2] block truncate" title={caseRecord.opposing}>
                      {caseRecord.opposing}
                    </span>
                    <div className="text-[11px] text-[#6c727d] truncate">
                      Aliases: {caseRecord.aliases2?.join(', ') || 'None'}
                    </div>
                  </div>
                </div>
              )}

              {/* Downstream Consumer Settlement Panel */}
              <div className="pt-3 border-t border-white/[0.08] space-y-3 reveal-fade" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-stone-300 font-semibold">
                    <Building className="w-3.5 h-3.5" />
                    <span>Downstream Consumer Settlement</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-[#9fa5b0]">
                      outcome_for_consumer: <strong className="text-white">{certificate?.outcome || consumerOutcome || 'PENDING'}</strong>
                    </span>
                    {consumerSettlement && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold">
                        {consumerSettlement}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleConsumerSettle(inspectedCaseId)}
                    disabled={!canSettleConsumer}
                    className="py-1.5 px-3.5 rounded-lg text-xs font-semibold btn-silver-glass cursor-pointer disabled:opacity-40"
                  >
                    {consumerSettlement ? `Settled: ${consumerSettlement}` : 'Settle on Consumer'}
                  </button>

                  <span className="text-[11px] text-[#6c727d]">
                    {consumerSettlement
                      ? 'Single-settlement consumer record locked on-chain.'
                      : activeStatus === 'JUDGED'
                        ? 'Available once the case reaches FINAL'
                        : activeStatus !== 'FINAL'
                          ? 'Requires case status FINAL before settlement'
                          : 'Case is FINAL and ready for consumer settlement'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
