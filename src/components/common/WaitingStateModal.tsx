import React from 'react';
import { Loader2, CheckCircle2, Clock, ShieldCheck, Sparkles, Scale } from 'lucide-react';

interface WaitingStateModalProps {
  isOpen: boolean;
  title: string;
  txHash?: string;
  elapsedSeconds: number;
  stageName: string;
  onClose?: () => void;
}

export const WaitingStateModal: React.FC<WaitingStateModalProps> = ({
  isOpen,
  title,
  txHash,
  elapsedSeconds,
  stageName,
}) => {
  if (!isOpen) return null;

  // Compute dynamic stage based on elapsed time if not explicitly overridden
  let activeStageIndex = 0;
  if (elapsedSeconds > 10) activeStageIndex = 1;
  if (elapsedSeconds > 22) activeStageIndex = 2;
  if (elapsedSeconds > 35) activeStageIndex = 3;

  const stages = [
    {
      label: 'Pass 1: Canonical Evaluation',
      desc: 'LLM extracts evidence citations & scores Party 1 vs Party 2 across weighted criteria.',
      icon: Scale,
    },
    {
      label: 'Pass 2: Mirrored Counter-Pass',
      desc: 'Party labels swapped, criteria reversed, evidence re-ordered to test position invariance.',
      icon: Sparkles,
    },
    {
      label: 'Quote Grounding & Stability Test',
      desc: 'Grounds citations to verbatim evidence text & verifies score delta <= margin threshold.',
      icon: ShieldCheck,
    },
    {
      label: 'Studionet Validator Consensus',
      desc: 'Committee of validators executes majority agreement on certificate output.',
      icon: Clock,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg silver-frame-raised p-6 sm:p-8 overflow-hidden">
        {/* Top Header */}
        <div className="text-center pb-5 border-b border-white/[0.08]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white mb-3 shadow-inner">
            <Loader2 className="w-6 h-6 animate-spin text-stone-200" />
          </div>
          <h3 className="text-lg font-bold text-[#eef0f2]">{title}</h3>
          <p className="text-xs text-[#9fa5b0] mt-1 max-w-sm mx-auto">
            Dual-pass intelligent execution on GenLayer Studionet Preview
          </p>
        </div>

        {/* Elapsed Timer Counter */}
        <div className="mt-4 p-3 rounded-xl silver-frame-inset flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-stone-300" />
            <span className="text-xs font-medium text-[#eef0f2]">Consensus In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9fa5b0]">Elapsed:</span>
            <span className="font-mono text-xs font-bold text-white bg-white/[0.10] px-2 py-0.5 rounded-md border border-white/[0.16] shadow-xs">
              {elapsedSeconds}s
            </span>
            <span className="text-[11px] text-[#6c727d]">(typical: 19s - 55s)</span>
          </div>
        </div>

        {/* 4-Stage Visual Timeline */}
        <div className="mt-4 space-y-2.5">
          {stages.map((stg, idx) => {
            const isDone = idx < activeStageIndex;
            const isCurrent = idx === activeStageIndex;

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                  isCurrent
                    ? 'bg-white/[0.08] border-white/[0.22] shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                    : isDone
                    ? 'bg-white/[0.03] border-white/[0.08] opacity-80'
                    : 'bg-black/20 border-white/[0.04] opacity-40'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/[0.20] flex items-center justify-center text-[10px] text-[#9fa5b0]">
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div>
                  <div
                    className={`text-xs font-semibold ${
                      isCurrent ? 'text-white' : isDone ? 'text-[#eef0f2]' : 'text-[#6c727d]'
                    }`}
                  >
                    {stg.label}
                  </div>
                  <div className="text-[11px] text-[#9fa5b0] mt-0.5 leading-snug">
                    {stg.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current activity note */}
        <div className="mt-4 text-center text-xs text-[#9fa5b0] silver-frame-inset p-2.5">
          <span className="font-semibold text-[#eef0f2]">Status: </span>
          <span>{stageName || 'Awaiting validator majority agreement...'}</span>
        </div>

        {txHash && (
          <div className="mt-3 text-center">
            <span className="text-[11px] font-mono text-[#6c727d]">
              Tx: {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
