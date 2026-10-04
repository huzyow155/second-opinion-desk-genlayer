import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../context/WalletContext';
import {
  fetchCase,
  fetchCertificate,
  fetchOutcomeForConsumer,
  fetchCasesByParty,
  fetchLatestCaseForPair,
  fetchGlobalCases,
  fetchConsumerSettlement,
  executeOpenCase,
  executeAddEvidence,
  executeJudge,
  executeFinalize,
  executeConsumerSettle,
  waitForReceiptWithProgress,
  getWriteClient,
} from '../../services/contractService';
import {
  MIRROR_JUDGE_ADDRESS,
  CONSUMER_CONTRACT_ADDRESS,
  STUDIONET_EXPLORER_URL,
  VERIFIED_DEMO_CASES,
} from '../../config/chain';
import type { CaseRecord, StabilityCertificate, Criterion } from '../../types/dispute';
import { WaitingStateModal } from '../common/WaitingStateModal';
import {
  Scale,
  Shield,
  Clock,
  Sparkles,
  Search,
  PlusCircle,
  FileText,
  Gavel,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Layers,
  Send,
  Building,
  ArrowRightLeft,
  ChevronRight,
  Info,
  Check,
} from 'lucide-react';

export const AppWorkbench: React.FC = () => {
  const {
    account,
    status: walletStatus,
    selectedProvider,
    openChooser,
    requestAccountSwitch,
  } = useWallet();

  const isConnected = walletStatus === 'CONNECTED';

  // Active view tab inside Workbench
  const [activeTab, setActiveTab] = useState<'demo' | 'open' | 'evidence' | 'judge' | 'inspect'>('demo');

  // Currently inspected case data
  const [inspectedCaseId, setInspectedCaseId] = useState<string>(VERIFIED_DEMO_CASES.DEMO_A.id);
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [certificate, setCertificate] = useState<StabilityCertificate | null>(null);
  const [consumerOutcome, setConsumerOutcome] = useState<string>('');
  const [consumerSettlement, setConsumerSettlement] = useState<string>('');
  const [loadingCase, setLoadingCase] = useState<boolean>(false);
  const [caseLoadError, setCaseLoadError] = useState<string | null>(null);

  // Discovery lists
  const [recentGlobalCases, setRecentGlobalCases] = useState<string[]>([]);
  const [userCases, setUserCases] = useState<string[]>([]);
  const [refreshingList, setRefreshingList] = useState<boolean>(false);

  // Waiting modal state
  const [waitingModalOpen, setWaitingModalOpen] = useState<boolean>(false);
  const [waitingModalTitle, setWaitingModalTitle] = useState<string>('');
  const [waitingModalStage, setWaitingModalStage] = useState<string>('');
  const [waitingElapsedSeconds, setWaitingElapsedSeconds] = useState<number>(0);
  const [currentTxHash, setCurrentTxHash] = useState<string>('');

  // Form states: Open Case
  const [openTitle, setOpenTitle] = useState<string>('');
  const [opposingAddress, setOpposingAddress] = useState<string>('');
  const [aliases1, setAliases1] = useState<string>('Contractor, Developer, Party 1');
  const [aliases2, setAliases2] = useState<string>('Client, Buyer, Party 2');
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: 'crit_1', text: 'Timely milestone delivery per specification', weight_bp: 5000 },
    { id: 'crit_2', text: 'Code quality and test coverage standards', weight_bp: 5000 },
  ]);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openSuccessMsg, setOpenSuccessMsg] = useState<string | null>(null);

  // Form states: Add Evidence
  const [evidenceCaseId, setEvidenceCaseId] = useState<string>('');
  const [evidenceText, setEvidenceText] = useState<string>('');
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceSuccessMsg, setEvidenceSuccessMsg] = useState<string | null>(null);

  // Form states: Manual lookup
  const [lookupInput, setLookupInput] = useState<string>('');

  // Settle & Finalize status
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load a case by ID
  const loadCaseData = useCallback(async (caseId: string) => {
    if (!caseId) return;
    const cleanId = caseId.trim().toLowerCase();
    setLoadingCase(true);
    setCaseLoadError(null);

    try {
      const [cRecord, cert, cOutcome, cSettle] = await Promise.all([
        fetchCase(cleanId),
        fetchCertificate(cleanId),
        fetchOutcomeForConsumer(cleanId),
        fetchConsumerSettlement(cleanId),
      ]);

      if (!cRecord && !cert) {
        setCaseLoadError(`Case "${cleanId}" not found on Studionet.`);
        setCaseRecord(null);
        setCertificate(null);
      } else {
        setInspectedCaseId(cleanId);
        setCaseRecord(cRecord);
        setCertificate(cert);
        setConsumerOutcome(cOutcome);
        setConsumerSettlement(cSettle);
        setEvidenceCaseId(cleanId);
      }
    } catch (err: any) {
      setCaseLoadError(err.message || 'Failed to fetch case data');
    } finally {
      setLoadingCase(false);
    }
  }, []);

  // Initial load: Fetch Demo A and global discovery lists
  useEffect(() => {
    loadCaseData(VERIFIED_DEMO_CASES.DEMO_A.id);
    refreshDiscoveryLists();
  }, [loadCaseData]);

  // When account changes, refresh user's cases
  useEffect(() => {
    if (account) {
      fetchCasesByParty(account, 10).then(setUserCases);
    } else {
      setUserCases([]);
    }
  }, [account]);

  const refreshDiscoveryLists = async () => {
    setRefreshingList(true);
    try {
      const globalIds = await fetchGlobalCases(0, 10);
      setRecentGlobalCases(globalIds);
      if (account) {
        const partyIds = await fetchCasesByParty(account, 10);
        setUserCases(partyIds);
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

    if (totalCriteriaWeight !== 10000) {
      setOpenError(`Criteria weights must sum to 10,000 basis points (currently ${totalCriteriaWeight}).`);
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

      const { receipt, success, durationSec } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(
          `Transaction completed with status ${receipt?.status_name || 'UNKNOWN'}. Execution failed.`
        );
      }

      // DISCOVERY VIEW LOOKUP (Ground Rule #4: Never calculate hash locally)
      const discoveredCaseId = await fetchLatestCaseForPair(account, opposingAddress.trim());

      setOpenSuccessMsg(
        `Case opened successfully in ${durationSec}s! Discovered on-chain Case ID: ${discoveredCaseId}`
      );

      if (discoveredCaseId) {
        setInspectedCaseId(discoveredCaseId);
        setEvidenceCaseId(discoveredCaseId);
        await loadCaseData(discoveredCaseId);
        refreshDiscoveryLists();
        setActiveTab('evidence');
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
      setEvidenceError(`Evidence text exceeds contract maximum of 1200 characters (${evidenceText.length} chars).`);
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

      const { receipt, success, durationSec } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(`Evidence submission failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      setEvidenceSuccessMsg(`Evidence successfully recorded in ${durationSec}s.`);
      setEvidenceText('');
      await loadCaseData(evidenceCaseId.trim());
    } catch (err: any) {
      setWaitingModalOpen(false);
      setEvidenceError(err.message || 'Failed to submit evidence');
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
      setWaitingModalStage('Invoking Canonical & Mirrored LLM validator consensus...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeJudge(writeClient, caseId);
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(`Judge execution failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      setActionSuccessMsg(
        `Dual-pass adjudication accepted by validators in ${durationSec}s! Reading stability certificate...`
      );
      await loadCaseData(caseId);
    } catch (err: any) {
      setWaitingModalOpen(false);
      setActionError(err.message || 'Adjudication failed');
    }
  };

  // -------------------------------------------------------------------------
  // WRITE ACTION: Finalize Case
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

      setWaitingModalTitle('Finalizing Dispute');
      setWaitingModalStage('Writing final status to Studionet...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeFinalize(writeClient, caseId);
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(`Finalize failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      setActionSuccessMsg(`Case finalized successfully in ${durationSec}s.`);
      await loadCaseData(caseId);
    } catch (err: any) {
      setWaitingModalOpen(false);
      setActionError(err.message || 'Finalize failed');
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
      setWaitingModalStage('Reading MirrorJudge certificate into consumer...');
      setWaitingElapsedSeconds(0);
      setWaitingModalOpen(true);

      const txHash = await executeConsumerSettle(writeClient, caseId);
      setCurrentTxHash(txHash);

      const { receipt, success, durationSec } = await waitForReceiptWithProgress(
        writeClient,
        txHash,
        (s) => setWaitingElapsedSeconds(s)
      );

      setWaitingModalOpen(false);

      if (!success) {
        throw new Error(`Consumer settlement failed with status ${receipt?.status_name || 'UNKNOWN'}`);
      }

      setActionSuccessMsg(`Consumer settlement completed in ${durationSec}s!`);
      await loadCaseData(caseId);
    } catch (err: any) {
      setWaitingModalOpen(false);
      setActionError(err.message || 'Consumer settlement failed');
    }
  };

  // Helper formatting for stability badges
  const renderStabilityBadge = (decision: string) => {
    if (!decision) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
          <Clock className="w-3 h-3 text-stone-500" />
          <span>Awaiting Adjudication</span>
        </span>
      );
    }

    if (decision.includes('STABLE')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>STABLE</span>
        </span>
      );
    }
    if (decision.includes('UNSTABLE')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
          <span>UNSTABLE (Position Bias Detected)</span>
        </span>
      );
    }
    if (decision.includes('INSUFFICIENT')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
          <Info className="w-3.5 h-3.5 text-blue-700" />
          <span>INSUFFICIENT EVIDENCE</span>
        </span>
      );
    }
    if (decision.includes('SPLIT')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <Scale className="w-3.5 h-3.5 text-amber-700" />
          <span>SPLIT (Equally Balanced)</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-800">
        {decision}
      </span>
    );
  };

  return (
    <div className="min-h-screen py-8 sm:py-12">
      {/* Waiting State Modal */}
      <WaitingStateModal
        isOpen={waitingModalOpen}
        title={waitingModalTitle}
        stageName={waitingModalStage}
        elapsedSeconds={waitingElapsedSeconds}
        txHash={currentTxHash}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Zero-Gas Notice & Wallet Info Banner */}
        <section className="soft-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-emerald-200/60 bg-gradient-to-r from-emerald-50/40 via-white to-stone-50">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-700 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900 flex items-center gap-2">
                <span>Studionet Zero Gas Price Network</span>
                <span className="px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-mono">
                  Chain ID 61999
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                Studionet transactions use zero gas price. A 0-GEN wallet can open cases, submit evidence, and trigger judging without funding.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-600 font-mono bg-stone-100 px-2.5 py-1 rounded-xl">
                  {account?.substring(0, 6)}...{account?.substring(account.length - 4)}
                </span>
                <button
                  onClick={requestAccountSwitch}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl btn-secondary-soft cursor-pointer"
                  title="Switch wallet account"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Switch Wallet</span>
                </button>
              </div>
            ) : (
              <button
                onClick={openChooser}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl btn-primary-green cursor-pointer shadow-xs"
              >
                <span>Connect Wallet to Write</span>
              </button>
            )}
          </div>
        </section>

        {/* Action feedback banners */}
        {actionSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-red-700 hover:text-red-900 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Workbench Grid: Left Control Panel & Right Certificate Viewer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Navigation Tabs & Operation Forms (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Workbench Navigation Tab Bar */}
            <div className="p-1.5 bg-stone-200/60 rounded-2xl flex flex-wrap gap-1 border border-stone-300/50">
              <button
                onClick={() => setActiveTab('demo')}
                className={`flex-1 min-w-[70px] py-2 px-3 text-xs font-semibold rounded-xl transition cursor-pointer text-center ${
                  activeTab === 'demo'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Demo Cases
              </button>
              <button
                onClick={() => setActiveTab('open')}
                className={`flex-1 min-w-[70px] py-2 px-3 text-xs font-semibold rounded-xl transition cursor-pointer text-center ${
                  activeTab === 'open'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Open Case
              </button>
              <button
                onClick={() => setActiveTab('evidence')}
                className={`flex-1 min-w-[70px] py-2 px-3 text-xs font-semibold rounded-xl transition cursor-pointer text-center ${
                  activeTab === 'evidence'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Add Evidence
              </button>
              <button
                onClick={() => setActiveTab('judge')}
                className={`flex-1 min-w-[70px] py-2 px-3 text-xs font-semibold rounded-xl transition cursor-pointer text-center ${
                  activeTab === 'judge'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Judge
              </button>
              <button
                onClick={() => setActiveTab('inspect')}
                className={`flex-1 min-w-[70px] py-2 px-3 text-xs font-semibold rounded-xl transition cursor-pointer text-center ${
                  activeTab === 'inspect'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Lookup
              </button>
            </div>

            {/* TAB 1: DEMO CASES (No-Wallet View) */}
            {activeTab === 'demo' && (
              <div className="soft-surface p-6 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-stone-900 text-base">Persistent On-Chain Demos</h3>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-lg">
                      No Wallet Needed
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">
                    Real, immutable cases already adjudicated by MirrorJudge validators on Studionet.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Demo A */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_A.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_A.id
                        ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-300'
                        : 'bg-white border-stone-200/80 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                        Demo A • {VERIFIED_DEMO_CASES.DEMO_A.category}
                      </span>
                      <span className="text-[11px] font-mono text-stone-500">
                        ID: {VERIFIED_DEMO_CASES.DEMO_A.id}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-stone-900">
                      {VERIFIED_DEMO_CASES.DEMO_A.title}
                    </div>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {VERIFIED_DEMO_CASES.DEMO_A.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-700 font-semibold">
                        Verdict: {VERIFIED_DEMO_CASES.DEMO_A.expectedDecision}
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </button>

                  {/* Demo B */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_B.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_B.id
                        ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-300'
                        : 'bg-white border-stone-200/80 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                        Demo B • {VERIFIED_DEMO_CASES.DEMO_B.category}
                      </span>
                      <span className="text-[11px] font-mono text-stone-500">
                        ID: {VERIFIED_DEMO_CASES.DEMO_B.id}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-stone-900">
                      {VERIFIED_DEMO_CASES.DEMO_B.title}
                    </div>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {VERIFIED_DEMO_CASES.DEMO_B.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-mono text-amber-700 font-semibold">
                        Verdict: {VERIFIED_DEMO_CASES.DEMO_B.expectedDecision}
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </button>

                  {/* Demo Escalated */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_ESCALATED.id)}
                    className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_ESCALATED.id
                        ? 'bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-300'
                        : 'bg-white border-stone-200/80 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                        Demo C • Multi-Round Escalation
                      </span>
                      <span className="text-[11px] font-mono text-stone-500">
                        ID: {VERIFIED_DEMO_CASES.DEMO_ESCALATED.id}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-stone-900">
                      {VERIFIED_DEMO_CASES.DEMO_ESCALATED.title}
                    </div>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {VERIFIED_DEMO_CASES.DEMO_ESCALATED.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-mono text-blue-700 font-semibold">
                        R1: INSUFFICIENT &rarr; R2: STABLE
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: OPEN CASE FORM */}
            {activeTab === 'open' && (
              <form onSubmit={handleOpenCase} className="soft-surface p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-stone-900 text-base">Open Mirrored Dispute</h3>
                  <p className="text-xs text-stone-600">
                    Creates an immutable case specification with weighted criteria and anonymized aliases.
                  </p>
                </div>

                {openError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <span>{openError}</span>
                  </div>
                )}

                {openSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{openSuccessMsg}</span>
                  </div>
                )}

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Dispute Title
                    </label>
                    <input
                      type="text"
                      value={openTitle}
                      onChange={(e) => setOpenTitle(e.target.value)}
                      placeholder="e.g. Frontend Redesign Milestone 2 Deliverable"
                      className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Opposing Party Address (Party 2)
                    </label>
                    <input
                      type="text"
                      value={opposingAddress}
                      onChange={(e) => setOpposingAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full text-xs font-mono p-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Party 1 Aliases
                      </label>
                      <input
                        type="text"
                        value={aliases1}
                        onChange={(e) => setAliases1(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-stone-200 bg-stone-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Party 2 Aliases
                      </label>
                      <input
                        type="text"
                        value={aliases2}
                        onChange={(e) => setAliases2(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-stone-200 bg-stone-50/50"
                      />
                    </div>
                  </div>

                  {/* Criteria Builder */}
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-800">
                        Weighted Criteria ({criteria.length}/4)
                      </span>
                      <button
                        type="button"
                        onClick={handleEqualizeWeights}
                        className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer underline"
                      >
                        Equalize Weights
                      </button>
                    </div>

                    {criteria.map((c, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-stone-600">
                          <span>Criterion #{idx + 1}</span>
                          <div className="flex items-center gap-1.5">
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
                              className="w-20 text-xs font-mono p-1 rounded-lg border border-stone-200 text-right bg-white"
                            />
                            <span className="text-[11px] text-stone-500">bp ({(c.weight_bp / 100).toFixed(1)}%)</span>
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
                          placeholder="Criterion description"
                          className="w-full text-xs p-1.5 rounded-lg border border-stone-200 bg-white"
                        />
                      </div>
                    ))}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        disabled={criteria.length >= 4}
                        onClick={() =>
                          setCriteria([
                            ...criteria,
                            { id: `crit_${criteria.length + 1}`, text: '', weight_bp: 0 },
                          ])
                        }
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-40 flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Add Criterion</span>
                      </button>

                      <div
                        className={`font-mono font-bold ${
                          totalCriteriaWeight === 10000 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        Total: {totalCriteriaWeight}/10,000 bp
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isConnected || totalCriteriaWeight !== 10000}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold btn-primary-green cursor-pointer disabled:opacity-50 shadow-xs mt-2"
                >
                  {!isConnected ? 'Connect Wallet to Open Case' : 'Open Dispute on Studionet'}
                </button>
              </form>
            )}

            {/* TAB 3: ADD EVIDENCE FORM */}
            {activeTab === 'evidence' && (
              <form onSubmit={handleAddEvidence} className="soft-surface p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-stone-900 text-base">Submit Case Evidence</h3>
                  <p className="text-xs text-stone-600">
                    Each party may submit up to 3 evidence items (&le; 1200 chars each) to the record.
                  </p>
                </div>

                {evidenceError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <span>{evidenceError}</span>
                  </div>
                )}

                {evidenceSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{evidenceSuccessMsg}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Target Case ID
                    </label>
                    <input
                      type="text"
                      value={evidenceCaseId}
                      onChange={(e) => setEvidenceCaseId(e.target.value)}
                      placeholder="12-character Case ID (e.g. ebe94dc89329)"
                      className="w-full text-xs font-mono p-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-stone-700">
                        Evidence Text & Verifiable Facts
                      </label>
                      <span
                        className={`text-[11px] font-mono ${
                          evidenceText.length > 1200 ? 'text-red-600 font-bold' : 'text-stone-500'
                        }`}
                      >
                        {evidenceText.length}/1200 chars
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={evidenceText}
                      onChange={(e) => setEvidenceText(e.target.value)}
                      placeholder="Provide factual statements, commit references, deployment logs, or communication excerpts..."
                      className="w-full text-xs p-3 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:border-emerald-500 focus:outline-none transition leading-relaxed"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isConnected || evidenceText.length === 0 || evidenceText.length > 1200}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold btn-primary-green cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {!isConnected ? 'Connect Wallet to Submit' : 'Submit Evidence Entry'}
                </button>
              </form>
            )}

            {/* TAB 4: JUDGE ACTION */}
            {activeTab === 'judge' && (
              <div className="soft-surface p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-stone-900 text-base">Consensus Adjudication</h3>
                  <p className="text-xs text-stone-600">
                    Triggers the dual-pass validation routine across GenLayer validator committee.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Selected Case:</span>
                    <span className="font-mono font-bold text-stone-900">{inspectedCaseId || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Total Evidence Entries:</span>
                    <span className="font-mono text-stone-800">{caseRecord?.evidence?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Completed Rounds:</span>
                    <span className="font-mono text-stone-800">{caseRecord?.rounds?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Current Status:</span>
                    <span className="font-bold text-stone-900">{caseRecord?.status || 'UNKNOWN'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                  <span className="font-bold">Latency Expectation: </span>
                  Consensus adjudication runs two full LLM passes across GenLayer validators. Expect ~19s to 55s of validator consensus processing time.
                </div>

                <button
                  onClick={() => handleTriggerJudge(inspectedCaseId)}
                  disabled={!isConnected || !inspectedCaseId}
                  className="w-full py-3.5 px-4 rounded-xl text-xs font-bold btn-primary-green cursor-pointer disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                >
                  <Gavel className="w-4 h-4" />
                  <span>Execute judge({inspectedCaseId.substring(0, 6)}...)</span>
                </button>
              </div>
            )}

            {/* TAB 5: MANUAL LOOKUP & DISCOVERY LISTS */}
            {activeTab === 'inspect' && (
              <div className="soft-surface p-6 space-y-5">
                <div className="space-y-1">
                  <h3 className="font-bold text-stone-900 text-base">Look Up Case by ID</h3>
                  <p className="text-xs text-stone-600">
                    Query any dispute record and stability certificate directly from Studionet storage.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value)}
                    placeholder="Enter 12-char Case ID"
                    className="flex-1 text-xs font-mono p-2.5 rounded-xl border border-stone-200 bg-stone-50/50"
                  />
                  <button
                    onClick={() => {
                      if (lookupInput.trim()) loadCaseData(lookupInput.trim());
                    }}
                    className="px-4 py-2 text-xs font-bold btn-primary-green rounded-xl cursor-pointer"
                  >
                    Query
                  </button>
                </div>

                {/* Discovery lists: Global & User */}
                <div className="space-y-4 pt-3 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      Recent Global Cases (list_cases)
                    </span>
                    <button
                      onClick={refreshDiscoveryLists}
                      className="text-stone-500 hover:text-stone-800 text-xs flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshingList ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {recentGlobalCases.length === 0 ? (
                      <span className="text-xs text-stone-500 italic">No global cases fetched</span>
                    ) : (
                      recentGlobalCases.map((id) => (
                        <button
                          key={id}
                          onClick={() => loadCaseData(id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                            inspectedCaseId === id
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          {id}
                        </button>
                      ))
                    )}
                  </div>

                  {isConnected && (
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                        My Cases (get_cases_by_party)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {userCases.length === 0 ? (
                          <span className="text-xs text-stone-500 italic">No cases opened by this address</span>
                        ) : (
                          userCases.map((id) => (
                            <button
                              key={id}
                              onClick={() => loadCaseData(id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                                inspectedCaseId === id
                                  ? 'bg-emerald-600 text-white font-bold'
                                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                              }`}
                            >
                              {id}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Active Stability Certificate & Case Viewer (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="soft-surface-raised p-6 sm:p-8 space-y-6">
              {/* Header with Case ID and Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-lg border border-stone-200 font-semibold">
                      ID: {inspectedCaseId || 'None'}
                    </span>
                    {caseRecord && (
                      <span className="text-xs px-2.5 py-0.5 rounded-lg font-bold bg-stone-100 text-stone-800">
                        Status: {caseRecord.status}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 leading-tight">
                    {caseRecord?.title || 'Stability Certificate'}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadCaseData(inspectedCaseId)}
                    disabled={loadingCase}
                    className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition cursor-pointer"
                    title="Refresh case state"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCase ? 'animate-spin text-emerald-600' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Case Load Error Alert */}
              {caseLoadError && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>{caseLoadError}</span>
                </div>
              )}

              {/* Stability Verdict Banner */}
              <div className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                    Position-Invariance Stability Verdict
                  </span>
                  {renderStabilityBadge(certificate?.current_decision || caseRecord?.rounds?.slice(-1)[0]?.decision || '')}
                </div>
                <div className="text-xs text-stone-600">
                  {certificate?.current_decision ? (
                    <span>
                      Raw on-chain verdict:{' '}
                      <code className="font-mono font-bold text-stone-900 bg-stone-200/60 px-1.5 py-0.5 rounded">
                        {certificate.current_decision}
                      </code>
                    </span>
                  ) : (
                    <span>Case is awaiting initial dual-pass adjudication.</span>
                  )}
                </div>
              </div>

              {/* Parties & Spec Breakdown */}
              {caseRecord && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block">
                      Party 1 (Opener)
                    </span>
                    <span className="text-xs font-mono text-stone-800 block truncate" title={caseRecord.opener}>
                      {caseRecord.opener}
                    </span>
                    <div className="text-[11px] text-stone-500 truncate">
                      Aliases: {caseRecord.aliases1?.join(', ') || 'None'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 space-y-1">
                    <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wide block">
                      Party 2 (Opposing)
                    </span>
                    <span className="text-xs font-mono text-stone-800 block truncate" title={caseRecord.opposing}>
                      {caseRecord.opposing}
                    </span>
                    <div className="text-[11px] text-stone-500 truncate">
                      Aliases: {caseRecord.aliases2?.join(', ') || 'None'}
                    </div>
                  </div>
                </div>
              )}

              {/* Criteria List */}
              {caseRecord?.criteria && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                    Adjudication Criteria & Weights
                  </span>
                  <div className="space-y-2">
                    {caseRecord.criteria.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-stone-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 pr-4">
                          <span className="font-semibold text-stone-900 block">{c.text}</span>
                          <span className="text-[10px] text-stone-500 font-mono">ID: {c.id}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {(c.weight_bp / 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submitted Evidence Log */}
              {caseRecord?.evidence && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                      Submitted Evidence Log ({caseRecord.evidence.length})
                    </span>
                    <span className="text-[11px] text-stone-500">Max 3 entries per party</span>
                  </div>

                  {caseRecord.evidence.length === 0 ? (
                    <div className="p-4 rounded-xl bg-stone-50 border border-dashed border-stone-200 text-xs text-stone-500 text-center">
                      No evidence has been entered for this dispute yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {caseRecord.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-white border border-stone-200/80 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-md ${
                                ev.by === 'PARTY_1'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-200 text-stone-800'
                              }`}
                            >
                              Submitted by {ev.by}
                            </span>
                            <span className="text-stone-400 font-mono">Entry #{idx + 1}</span>
                          </div>
                          <p className="text-stone-700 leading-relaxed font-sans">{ev.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Adjudication Rounds History */}
              {caseRecord?.rounds && caseRecord.rounds.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                    Consensus Round History
                  </span>
                  <div className="space-y-2">
                    {caseRecord.rounds.map((rnd, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-stone-200/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-[10px]">
                            {rnd.n}
                          </span>
                          <span className="font-semibold text-stone-900">Round {rnd.n}</span>
                        </div>
                        <div className="font-mono text-xs font-semibold text-emerald-800">
                          {rnd.decision}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Downstream Consumer & Finalization Section */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-stone-900">
                      Downstream Consumer Settlement
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-stone-500">
                    Consumer: {CONSUMER_CONTRACT_ADDRESS.substring(0, 8)}...
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-stone-200">
                    <span className="text-[10px] text-stone-500 block uppercase font-bold">
                      outcome_for_consumer
                    </span>
                    <span className="font-mono font-bold text-stone-900">
                      {consumerOutcome || 'NO_DECISION'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-stone-200">
                    <span className="text-[10px] text-stone-500 block uppercase font-bold">
                      Settlement State
                    </span>
                    <span className="font-mono font-bold text-stone-900">
                      {consumerSettlement || 'Unsettled'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {caseRecord?.status === 'JUDGED' && (
                    <button
                      onClick={() => handleFinalizeCase(inspectedCaseId)}
                      disabled={!isConnected}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold btn-secondary-soft cursor-pointer"
                    >
                      Finalize Case
                    </button>
                  )}

                  {certificate?.is_decided && !consumerSettlement && (
                    <button
                      onClick={() => handleConsumerSettle(inspectedCaseId)}
                      disabled={!isConnected}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold btn-primary-green cursor-pointer"
                    >
                      Trigger Consumer Settle
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
