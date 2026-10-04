import React from 'react';
import { Loader2, CheckCircle2, Clock, ShieldCheck, Sparkles, Scale, AlertCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200/90 overflow-hidden">
        {/* Top Header */}
        <div className="text-center pb-5 border-b border-stone-100">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-3 shadow-inner">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-stone-900">{title}</h3>
          <p className="text-xs text-stone-700 mt-1 max-w-sm mx-auto">
            Dual-pass intelligent execution on GenLayer Studionet Preview
          </p>
        </div>

        {/* Elapsed Timer Counter */}
        <div className="mt-5 p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-stone-700">Consensus In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-600">Elapsed:</span>
            <span className="font-mono text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
              {elapsedSeconds}s
            </span>
            <span className="text-[11px] text-stone-600">(typical: 19s - 55s)</span>
          </div>
        </div>

        {/* 4-Stage Visual Timeline */}
        <div className="mt-5 space-y-3">
          {stages.map((stg, idx) => {
            const isDone = idx < activeStageIndex;
            const isCurrent = idx === activeStageIndex;
            const isPending = idx > activeStageIndex;

            return (
              <div
                key={idx}
                className={`p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  isCurrent
                    ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200/80'
                    : isDone
                    ? 'bg-stone-50/70 border-stone-200 opacity-90'
                    : 'bg-white border-stone-100 opacity-50'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-stone-300 flex items-center justify-center text-[10px] text-stone-600">
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div>
                  <div
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? 'text-emerald-950 font-bold'
                        : isDone
                        ? 'text-stone-800'
                        : 'text-stone-600'
                    }`}
                  >
                    {stg.label}
                  </div>
                  <div className="text-[11px] text-stone-600 mt-0.5 leading-snug">
                    {stg.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current activity note */}
        <div className="mt-5 text-center text-xs text-stone-700 bg-stone-50/70 p-2.5 rounded-xl border border-stone-100">
          <span className="font-semibold text-stone-800">Status: </span>
          <span>{stageName || 'Awaiting validator majority agreement...'}</span>
        </div>

        {txHash && (
          <div className="mt-3 text-center">
            <span className="text-[11px] font-mono text-stone-600">
              Tx: {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
