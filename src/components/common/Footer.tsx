import React from 'react';
import {
  MIRROR_JUDGE_ADDRESS,
  CONSUMER_CONTRACT_ADDRESS,
  STUDIONET_EXPLORER_URL,
  CONTRACT_REPO_URL,
  DAPP_REPO_URL,
  STUDIONET_NAME,
} from '../../config/chain';
import { ExternalLink, GitBranch, Shield, Scale, Code } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-stone-200/80 bg-white/70 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-700">
                <Scale className="w-4 h-4" />
              </div>
              <span className="font-bold text-stone-900 tracking-tight">Second-Opinion Desk</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed max-w-md">
              A decentralized dispute adjudication workbench powered by MirrorJudge on GenLayer Studionet Preview.
              Validates LLM position invariance via dual-pass canonical and mirrored evaluation under validator consensus.
            </p>
            <div className="text-[11px] text-stone-600">
              Zero gas price network • Pure Python Intelligent Contracts on GenVM
            </div>
          </div>

          {/* Smart Contracts Col */}
          <div>
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">
              Contracts (Studionet)
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href={`${STUDIONET_EXPLORER_URL}/address/${MIRROR_JUDGE_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-stone-600 hover:text-emerald-700 transition"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>MirrorJudge Core</span>
                  <ExternalLink className="w-3 h-3 text-stone-600" />
                </a>
              </li>
              <li>
                <a
                  href={`${STUDIONET_EXPLORER_URL}/address/${CONSUMER_CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-stone-600 hover:text-emerald-700 transition"
                >
                  <Code className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Consumer Settlement</span>
                  <ExternalLink className="w-3 h-3 text-stone-600" />
                </a>
              </li>
            </ul>
          </div>

          {/* Open Source Col */}
          <div>
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">
              Source Repositories
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href={CONTRACT_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-stone-600 hover:text-emerald-700 transition"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>Contract Repo (MirrorJudge)</span>
                  <ExternalLink className="w-3 h-3 text-stone-600" />
                </a>
              </li>
              <li>
                <a
                  href={DAPP_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-stone-600 hover:text-emerald-700 transition"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>dApp Repo (Second-Opinion Desk)</span>
                  <ExternalLink className="w-3 h-3 text-stone-600" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-600 gap-2">
          <span>Released under MIT License. GenLayer Studionet Preview (Chain ID 61999).</span>
          <div className="flex items-center gap-4">
            <span>Deterministic Dual-Pass Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
