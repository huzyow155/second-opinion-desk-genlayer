import React from 'react';
import {
  MIRROR_JUDGE_ADDRESS,
  CONSUMER_CONTRACT_ADDRESS,
  STUDIONET_EXPLORER_URL,
  CONTRACT_REPO_URL,
  DAPP_REPO_URL,
} from '../../config/chain';
import { ExternalLink, GitBranch, Shield, Scale, Code } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-white/[0.08] bg-[#0c0d0f]/60 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-white/[0.06] border border-white/[0.12] flex items-center justify-center text-[#eef0f2]">
                <Scale className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-[#eef0f2] tracking-tight">Second-Opinion Desk</span>
            </div>
            <p className="text-xs text-[#9fa5b0] leading-relaxed max-w-md">
              A decentralized dispute adjudication workbench powered by MirrorJudge on GenLayer Studionet Preview.
              Validates LLM position invariance via dual-pass canonical and mirrored evaluation under validator consensus.
            </p>
            <div className="text-[11px] text-[#6c727d]">
              Zero gas price network • Pure Python Intelligent Contracts on GenVM
            </div>
          </div>

          {/* Smart Contracts Col */}
          <div>
            <h4 className="text-xs font-bold text-[#eef0f2] uppercase tracking-wider mb-3">
              Contracts (Studionet)
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href={`${STUDIONET_EXPLORER_URL}/address/${MIRROR_JUDGE_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#9fa5b0] hover:text-white transition"
                >
                  <Shield className="w-3.5 h-3.5 text-stone-400" />
                  <span>MirrorJudge Core</span>
                  <ExternalLink className="w-3 h-3 text-[#6c727d]" />
                </a>
              </li>
              <li>
                <a
                  href={`${STUDIONET_EXPLORER_URL}/address/${CONSUMER_CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#9fa5b0] hover:text-white transition"
                >
                  <Code className="w-3.5 h-3.5 text-stone-400" />
                  <span>Consumer Settlement</span>
                  <ExternalLink className="w-3 h-3 text-[#6c727d]" />
                </a>
              </li>
            </ul>
          </div>

          {/* Open Source Col */}
          <div>
            <h4 className="text-xs font-bold text-[#eef0f2] uppercase tracking-wider mb-3">
              Source Repositories
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href={CONTRACT_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#9fa5b0] hover:text-white transition"
                >
                  <GitBranch className="w-3.5 h-3.5 text-stone-400" />
                  <span>Contract Repo (MirrorJudge)</span>
                  <ExternalLink className="w-3 h-3 text-[#6c727d]" />
                </a>
              </li>
              <li>
                <a
                  href={DAPP_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#9fa5b0] hover:text-white transition"
                >
                  <GitBranch className="w-3.5 h-3.5 text-stone-400" />
                  <span>dApp Repo (Second-Opinion Desk)</span>
                  <ExternalLink className="w-3 h-3 text-[#6c727d]" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-[#6c727d] gap-2">
          <span>Released under MIT License. GenLayer Studionet Preview (Chain ID 61999).</span>
          <div className="flex items-center gap-4">
            <span>Deterministic Dual-Pass Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
