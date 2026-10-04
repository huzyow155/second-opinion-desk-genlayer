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
  CONSUMER_CONTRACT_ADDRESS,
  VERIFIED_DEMO_CASES,
} from '../../config/chain';
import type { CaseRecord, StabilityCertificate, Criterion } from '../../types/dispute';
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
  ChevronRight,
  Info,
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
        <span className="silver-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium">
          <Clock className="w-3 h-3 text-[#6c727d]" />
          <span>Awaiting Adjudication</span>
        </span>
      );
    }

    if (decision.includes('STABLE')) {
      return (
        <span className="status-badge-stable inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>STABLE</span>
        </span>
      );
    }
    if (decision.includes('UNSTABLE')) {
      return (
        <span className="status-badge-unstable inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>UNSTABLE (Position Bias Detected)</span>
        </span>
      );
    }
    if (decision.includes('INSUFFICIENT')) {
      return (
        <span className="status-badge-insufficient inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span>INSUFFICIENT EVIDENCE</span>
        </span>
      );
    }
    if (decision.includes('SPLIT')) {
      return (
        <span className="status-badge-split inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
          <Scale className="w-3.5 h-3.5 text-amber-400" />
          <span>SPLIT (Equally Balanced)</span>
        </span>
      );
    }

    return (
      <span className="silver-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium">
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
        <section className="silver-frame p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.12] flex items-center justify-center text-[#eef0f2] shrink-0">
              <Sparkles className="w-4 h-4 text-stone-300" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#eef0f2] flex items-center gap-2">
                <span>Studionet Zero Gas Price Network</span>
                <span className="silver-pill text-[10px] px-2 py-0.2 rounded font-mono text-stone-300">
                  Chain ID 61999
                </span>
              </div>
              <p className="text-xs text-[#9fa5b0] mt-0.5">
                Studionet transactions use zero gas price. A 0-GEN wallet can open cases, submit evidence, and trigger judging without funding.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9fa5b0] font-mono bg-[#121417] border border-white/[0.08] px-2.5 py-1 rounded-lg">
                  {account?.substring(0, 6)}...{account?.substring(account.length - 4)}
                </span>
                <button
                  onClick={requestAccountSwitch}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg btn-silver-glass cursor-pointer"
                  title="Switch wallet account"
                >
                  <ArrowRightLeft className="w-3 h-3 text-[#9fa5b0]" />
                  <span>Switch Wallet</span>
                </button>
              </div>
            ) : (
              <button
                onClick={openChooser}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl btn-silver-primary cursor-pointer shadow-xs"
              >
                <span>Connect Wallet to Write</span>
              </button>
            )}
          </div>
        </section>

        {/* Action feedback banners */}
        {actionSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-400 hover:text-white text-xs font-bold cursor-pointer"
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
            <div className="p-1 bg-[#121417]/90 rounded-xl flex flex-wrap gap-1 border border-white/[0.08]">
              <button
                onClick={() => setActiveTab('demo')}
                className={`flex-1 min-w-[70px] py-1.5 px-3 text-xs font-medium rounded-lg transition cursor-pointer text-center ${
                  activeTab === 'demo'
                    ? 'bg-white/[0.12] text-white border border-white/[0.16] shadow-xs'
                    : 'text-[#9fa5b0] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Demo Cases
              </button>
              <button
                onClick={() => setActiveTab('open')}
                className={`flex-1 min-w-[70px] py-1.5 px-3 text-xs font-medium rounded-lg transition cursor-pointer text-center ${
                  activeTab === 'open'
                    ? 'bg-white/[0.12] text-white border border-white/[0.16] shadow-xs'
                    : 'text-[#9fa5b0] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Open Case
              </button>
              <button
                onClick={() => setActiveTab('evidence')}
                className={`flex-1 min-w-[70px] py-1.5 px-3 text-xs font-medium rounded-lg transition cursor-pointer text-center ${
                  activeTab === 'evidence'
                    ? 'bg-white/[0.12] text-white border border-white/[0.16] shadow-xs'
                    : 'text-[#9fa5b0] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Add Evidence
              </button>
              <button
                onClick={() => setActiveTab('judge')}
                className={`flex-1 min-w-[70px] py-1.5 px-3 text-xs font-medium rounded-lg transition cursor-pointer text-center ${
                  activeTab === 'judge'
                    ? 'bg-white/[0.12] text-white border border-white/[0.16] shadow-xs'
                    : 'text-[#9fa5b0] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Judge
              </button>
              <button
                onClick={() => setActiveTab('inspect')}
                className={`flex-1 min-w-[70px] py-1.5 px-3 text-xs font-medium rounded-lg transition cursor-pointer text-center ${
                  activeTab === 'inspect'
                    ? 'bg-white/[0.12] text-white border border-white/[0.16] shadow-xs'
                    : 'text-[#9fa5b0] hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                Lookup
              </button>
            </div>

            {/* TAB 1: DEMO CASES (No-Wallet View) */}
            {activeTab === 'demo' && (
              <div className="silver-frame p-6 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-[#eef0f2] text-base">Persistent On-Chain Demos</h3>
                    <span className="silver-pill text-[11px] font-semibold px-2 py-0.5 rounded-lg text-stone-300">
                      No Wallet Needed
                    </span>
                  </div>
                  <p className="text-xs text-[#9fa5b0]">
                    Real, immutable cases already adjudicated by MirrorJudge validators on Studionet.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Demo A */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_A.id)}
                    className={`w-full p-4 rounded-xl border text-left transition cursor-pointer ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_A.id
                        ? 'bg-white/[0.08] border-white/[0.25] shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                        : 'bg-[#121417]/80 border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wide">
                        Demo A • {VERIFIED_DEMO_CASES.DEMO_A.category}
                      </span>
                      <span className="text-[11px] font-mono text-[#6c727d]">
                        ID: {VERIFIED_DEMO_CASES.DEMO_A.id}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-[#eef0f2]">
                      {VERIFIED_DEMO_CASES.DEMO_A.title}
                    </div>
                    <p className="text-xs text-[#9fa5b0] mt-1 leading-relaxed">
                      {VERIFIED_DEMO_CASES.DEMO_A.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-mono text-emerald-400 font-medium">
                        Verdict: {VERIFIED_DEMO_CASES.DEMO_A.expectedDecision}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#6c727d]" />
                    </div>
                  </button>

                  {/* Demo B */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_B.id)}
                    className={`w-full p-4 rounded-xl border text-left transition cursor-pointer ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_B.id
                        ? 'bg-white/[0.08] border-white/[0.25] shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                        : 'bg-[#121417]/80 border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wide">
                        Demo B • {VERIFIED_DEMO_CASES.DEMO_B.category}
                      </span>
                      <span className="text-[11px] font-mono text-[#6c727d]">
                        ID: {VERIFIED_DEMO_CASES.DEMO_B.id}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-[#eef0f2]">
                      {VERIFIED_DEMO_CASES.DEMO_B.title}
                    </div>
                    <p className="text-xs text-[#9fa5b0] mt-1 leading-relaxed">
                      {VERIFIED_DEMO_CASES.DEMO_B.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-mono text-amber-400 font-medium">
                        Verdict: {VERIFIED_DEMO_CASES.DEMO_B.expectedDecision}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#6c727d]" />
                    </div>
                  </button>

                  {/* Demo Escalated */}
                  <button
                    onClick={() => loadCaseData(VERIFIED_DEMO_CASES.DEMO_ESCALATED.id)}
                    className={`w-full p-4 rounded-xl border text-left transition cursor-pointer ${
                      inspectedCaseId === VERIFIED_DEMO_CASES.DEMO_ESCALATED.id
                        ? 'bg-white/[0.08] border-white/[0.25] shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                        : 'bg-[#121417]/80 border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wide">
                        Demo C • Multi-Round Escalation
                      </span>
                      <span className="text-[11px] font-mono text-[#6c727d]">
                        ID: {VERIFIED_DEMO_CASES.DEMO_ESCALATED.id}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-[#eef0f2]">
                      {VERIFIED_DEMO_CASES.DEMO_ESCALATED.title}
                    </div>
                    <p className="text-xs text-[#9fa5b0] mt-1 leading-relaxed">
                      {VERIFIED_DEMO_CASES.DEMO_ESCALATED.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-mono text-blue-400 font-medium">
                        R1: INSUFFICIENT &rarr; R2: STABLE
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#6c727d]" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: OPEN CASE FORM */}
            {activeTab === 'open' && (
              <form onSubmit={handleOpenCase} className="silver-frame p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-[#eef0f2] text-base">Open Mirrored Dispute</h3>
                  <p className="text-xs text-[#9fa5b0]">
                    Creates an immutable case specification with weighted criteria and anonymized aliases.
                  </p>
                </div>

                {openError && (
                  <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{openError}</span>
                  </div>
                )}

                {openSuccessMsg && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{openSuccessMsg}</span>
                  </div>
                )}

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-[#9fa5b0] mb-1">
                      Dispute Title
                    </label>
                    <input
                      type="text"
                      value={openTitle}
                      onChange={(e) => setOpenTitle(e.target.value)}
                      placeholder="e.g. Frontend Redesign Milestone 2 Deliverable"
                      className="silver-input w-full text-xs p-2.5 rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#9fa5b0] mb-1">
                      Opposing Party Address (Party 2)
                    </label>
                    <input
                      type="text"
                      value={opposingAddress}
                      onChange={(e) => setOpposingAddress(e.target.value)}
                      placeholder="0x..."
                      className="silver-input w-full text-xs font-mono p-2.5 rounded-xl"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#9fa5b0] mb-1">
                        Party 1 Aliases
                      </label>
                      <input
                        type="text"
                        value={aliases1}
                        onChange={(e) => setAliases1(e.target.value)}
                        className="silver-input w-full text-xs p-2 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#9fa5b0] mb-1">
                        Party 2 Aliases
                      </label>
                      <input
                        type="text"
                        value={aliases2}
                        onChange={(e) => setAliases2(e.target.value)}
                        className="silver-input w-full text-xs p-2 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Criteria Builder */}
                  <div className="space-y-2 pt-2 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#eef0f2]">
                        Weighted Criteria ({criteria.length}/4)
                      </span>
                      <button
                        type="button"
                        onClick={handleEqualizeWeights}
                        className="text-[11px] text-stone-300 hover:text-white font-medium cursor-pointer underline"
                      >
                        Equalize Weights
                      </button>
                    </div>

                    {criteria.map((c, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl silver-frame-inset space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-[#9fa5b0]">
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
                              className="w-20 text-xs font-mono p-1 rounded-lg border border-white/[0.10] text-right bg-[#0c0d0f] text-[#eef0f2]"
                            />
                            <span className="text-[11px] text-[#6c727d]">bp ({(c.weight_bp / 100).toFixed(1)}%)</span>
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
                          className="w-full text-xs p-1.5 rounded-lg border border-white/[0.08] bg-[#0c0d0f] text-[#eef0f2]"
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
                        className="text-xs font-medium text-stone-300 hover:text-white disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Add Criterion</span>
                      </button>

                      <div
                        className={`font-mono font-bold ${
                          totalCriteriaWeight === 10000 ? 'text-emerald-400' : 'text-rose-400'
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
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold btn-silver-primary cursor-pointer disabled:opacity-40 shadow-xs mt-2"
                >
                  {!isConnected ? 'Connect Wallet to Open Case' : 'Open Dispute on Studionet'}
                </button>
              </form>
            )}

            {/* TAB 3: ADD EVIDENCE FORM */}
            {activeTab === 'evidence' && (
              <form onSubmit={handleAddEvidence} className="silver-frame p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-[#eef0f2] text-base">Submit Case Evidence</h3>
                  <p className="text-xs text-[#9fa5b0]">
                    Each party may submit up to 3 evidence items (&le; 1200 chars each) to the record.
                  </p>
                </div>

                {evidenceError && (
                  <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <span>{evidenceError}</span>
                  </div>
                )}

                {evidenceSuccessMsg && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{evidenceSuccessMsg}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#9fa5b0] mb-1">
                      Target Case ID
                    </label>
                    <input
                      type="text"
                      value={evidenceCaseId}
                      onChange={(e) => setEvidenceCaseId(e.target.value)}
                      placeholder="12-character Case ID (e.g. ebe94dc89329)"
                      className="silver-input w-full text-xs font-mono p-2.5 rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#9fa5b0]">
                        Evidence Text & Verifiable Facts
                      </label>
                      <span
                        className={`text-[11px] font-mono ${
                          evidenceText.length > 1200 ? 'text-rose-400 font-bold' : 'text-[#6c727d]'
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
                      className="silver-input w-full text-xs p-3 rounded-xl leading-relaxed"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isConnected || evidenceText.length === 0 || evidenceText.length > 1200}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold btn-silver-primary cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  {!isConnected ? 'Connect Wallet to Submit' : 'Submit Evidence Entry'}
                </button>
              </form>
            )}

            {/* TAB 4: JUDGE ACTION */}
            {activeTab === 'judge' && (
              <div className="silver-frame p-6 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-[#eef0f2] text-base">Consensus Adjudication</h3>
                  <p className="text-xs text-[#9fa5b0]">
                    Triggers the dual-pass validation routine across GenLayer validator committee.
                  </p>
                </div>

                <div className="p-4 rounded-xl silver-frame-inset space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9fa5b0]">Selected Case:</span>
                    <span className="font-mono font-bold text-[#eef0f2]">{inspectedCaseId || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9fa5b0]">Total Evidence Entries:</span>
                    <span className="font-mono text-[#eef0f2]">{caseRecord?.evidence?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9fa5b0]">Completed Rounds:</span>
                    <span className="font-mono text-[#eef0f2]">{caseRecord?.rounds?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#9fa5b0]">Current Status:</span>
                    <span className="font-bold text-[#eef0f2]">{caseRecord?.status || 'UNKNOWN'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl silver-frame-inset text-[11px] text-[#9fa5b0] leading-relaxed">
                  <span className="font-bold text-[#eef0f2]">Latency Expectation: </span>
                  Consensus adjudication runs two full LLM passes across GenLayer validators. Expect ~19s to 55s of validator consensus processing time.
                </div>

                <button
                  onClick={() => handleTriggerJudge(inspectedCaseId)}
                  disabled={!isConnected || !inspectedCaseId}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold btn-silver-primary cursor-pointer disabled:opacity-40 shadow-md flex items-center justify-center gap-2"
                >
                  <Gavel className="w-4 h-4" />
                  <span>Execute judge({inspectedCaseId.substring(0, 6)}...)</span>
                </button>
              </div>
            )}

            {/* TAB 5: MANUAL LOOKUP & DISCOVERY LISTS */}
            {activeTab === 'inspect' && (
              <div className="silver-frame p-6 space-y-5">
                <div className="space-y-1">
                  <h3 className="font-bold text-[#eef0f2] text-base">Look Up Case by ID</h3>
                  <p className="text-xs text-[#9fa5b0]">
                    Query any dispute record and stability certificate directly from Studionet storage.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupInput}
                    onChange={(e) => setLookupInput(e.target.value)}
                    placeholder="Enter 12-char Case ID"
                    className="silver-input flex-1 text-xs font-mono p-2.5 rounded-xl"
                  />
                  <button
                    onClick={() => {
                      if (lookupInput.trim()) loadCaseData(lookupInput.trim());
                    }}
                    className="px-4 py-2 text-xs font-bold btn-silver-primary rounded-xl cursor-pointer"
                  >
                    Query
                  </button>
                </div>

                {/* Discovery lists: Global & User */}
                <div className="space-y-4 pt-3 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                      Recent Global Cases (list_cases)
                    </span>
                    <button
                      onClick={refreshDiscoveryLists}
                      className="text-[#9fa5b0] hover:text-white text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshingList ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {recentGlobalCases.length === 0 ? (
                      <span className="text-xs text-[#6c727d] italic">No global cases fetched</span>
                    ) : (
                      recentGlobalCases.map((id) => (
                        <button
                          key={id}
                          onClick={() => loadCaseData(id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                            inspectedCaseId === id
                              ? 'bg-white/[0.15] text-white border border-white/[0.22] font-bold'
                              : 'silver-pill hover:text-white hover:bg-white/[0.08]'
                          }`}
                        >
                          {id}
                        </button>
                      ))
                    )}
                  </div>

                  {isConnected && (
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                        My Cases (get_cases_by_party)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {userCases.length === 0 ? (
                          <span className="text-xs text-[#6c727d] italic">No cases opened by this address</span>
                        ) : (
                          userCases.map((id) => (
                            <button
                              key={id}
                              onClick={() => loadCaseData(id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                                inspectedCaseId === id
                                  ? 'bg-white/[0.15] text-white border border-white/[0.22] font-bold'
                                  : 'silver-pill hover:text-white hover:bg-white/[0.08]'
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
            <div className="silver-frame-raised p-6 sm:p-8 space-y-6">
              {/* Header with Case ID and Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="silver-pill text-xs font-mono px-2.5 py-0.5 rounded-lg font-semibold text-stone-300">
                      ID: {inspectedCaseId || 'None'}
                    </span>
                    {caseRecord && (
                      <span className="text-xs px-2.5 py-0.5 rounded-lg font-bold bg-white/[0.06] border border-white/[0.10] text-[#eef0f2]">
                        Status: {caseRecord.status}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#eef0f2] leading-tight">
                    {caseRecord?.title || 'Stability Certificate'}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadCaseData(inspectedCaseId)}
                    disabled={loadingCase}
                    className="p-2 rounded-xl silver-frame-inset hover:border-white/[0.20] text-[#9fa5b0] hover:text-white transition cursor-pointer"
                    title="Refresh case state"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCase ? 'animate-spin text-white' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Case Load Error Alert */}
              {caseLoadError && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>{caseLoadError}</span>
                </div>
              )}

              {/* Stability Verdict Banner */}
              <div className="p-4 rounded-xl silver-frame-inset space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Position-Invariance Stability Verdict
                  </span>
                  {renderStabilityBadge(certificate?.current_decision || caseRecord?.rounds?.slice(-1)[0]?.decision || '')}
                </div>
                <div className="text-xs text-[#9fa5b0]">
                  {certificate?.current_decision ? (
                    <span>
                      Raw on-chain verdict:{' '}
                      <code className="font-mono font-bold text-[#eef0f2] bg-white/[0.08] px-1.5 py-0.5 rounded border border-white/[0.10]">
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
                  <div className="p-3.5 rounded-xl silver-frame-inset space-y-1">
                    <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wide block">
                      Party 1 (Opener)
                    </span>
                    <span className="text-xs font-mono text-[#eef0f2] block truncate" title={caseRecord.opener}>
                      {caseRecord.opener}
                    </span>
                    <div className="text-[11px] text-[#6c727d] truncate">
                      Aliases: {caseRecord.aliases1?.join(', ') || 'None'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl silver-frame-inset space-y-1">
                    <span className="text-[11px] font-bold text-stone-300 uppercase tracking-wide block">
                      Party 2 (Opposing)
                    </span>
                    <span className="text-xs font-mono text-[#eef0f2] block truncate" title={caseRecord.opposing}>
                      {caseRecord.opposing}
                    </span>
                    <div className="text-[11px] text-[#6c727d] truncate">
                      Aliases: {caseRecord.aliases2?.join(', ') || 'None'}
                    </div>
                  </div>
                </div>
              )}

              {/* Criteria List */}
              {caseRecord?.criteria && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                    Adjudication Criteria & Weights
                  </span>
                  <div className="space-y-2">
                    {caseRecord.criteria.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl silver-frame-inset flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 pr-4">
                          <span className="font-medium text-[#eef0f2] block">{c.text}</span>
                          <span className="text-[10px] text-[#6c727d] font-mono">ID: {c.id}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-mono font-bold text-stone-200 bg-white/[0.08] px-2 py-0.5 rounded border border-white/[0.12]">
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
                    <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                      Submitted Evidence Log ({caseRecord.evidence.length})
                    </span>
                    <span className="text-[11px] text-[#6c727d]">Max 3 entries per party</span>
                  </div>

                  {caseRecord.evidence.length === 0 ? (
                    <div className="p-4 rounded-xl silver-frame-inset border border-dashed border-white/[0.10] text-xs text-[#6c727d] text-center">
                      No evidence has been entered for this dispute yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {caseRecord.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl silver-frame-inset text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={`font-semibold px-2 py-0.5 rounded-md border ${
                                ev.by === 'PARTY_1'
                                  ? 'bg-white/[0.08] border-white/[0.14] text-white'
                                  : 'bg-stone-900 border-white/[0.08] text-stone-300'
                              }`}
                            >
                              Submitted by {ev.by}
                            </span>
                            <span className="text-[#6c727d] font-mono">Entry #{idx + 1}</span>
                          </div>
                          <p className="text-[#9fa5b0] leading-relaxed font-sans">{ev.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Adjudication Rounds History */}
              {caseRecord?.rounds && caseRecord.rounds.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                    Consensus Round History
                  </span>
                  <div className="space-y-2">
                    {caseRecord.rounds.map((rnd, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl silver-frame-inset flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-white/[0.08] border border-white/[0.12] text-white flex items-center justify-center font-bold text-[10px]">
                            {rnd.n}
                          </span>
                          <span className="font-medium text-[#eef0f2]">Round {rnd.n}</span>
                        </div>
                        <div className="font-mono text-xs font-semibold text-emerald-400">
                          {rnd.decision}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Downstream Consumer & Finalization Section */}
              <div className="p-4 rounded-xl silver-frame-inset space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-stone-300" />
                    <span className="text-xs font-bold text-[#eef0f2]">
                      Downstream Consumer Settlement
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#6c727d]">
                    Consumer: {CONSUMER_CONTRACT_ADDRESS.substring(0, 8)}...
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#0c0d0f] border border-white/[0.08]">
                    <span className="text-[10px] text-[#6c727d] block uppercase font-bold">
                      outcome_for_consumer
                    </span>
                    <span className="font-mono font-bold text-[#eef0f2]">
                      {consumerOutcome || 'NO_DECISION'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#0c0d0f] border border-white/[0.08]">
                    <span className="text-[10px] text-[#6c727d] block uppercase font-bold">
                      Settlement State
                    </span>
                    <span className="font-mono font-bold text-[#eef0f2]">
                      {consumerSettlement || 'Unsettled'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {caseRecord?.status === 'JUDGED' && (
                    <button
                      onClick={() => handleFinalizeCase(inspectedCaseId)}
                      disabled={!isConnected}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold btn-silver-glass cursor-pointer"
                    >
                      Finalize Case
                    </button>
                  )}

                  {certificate?.is_decided && !consumerSettlement && (
                    <button
                      onClick={() => handleConsumerSettle(inspectedCaseId)}
                      disabled={!isConnected}
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold btn-silver-primary cursor-pointer"
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
