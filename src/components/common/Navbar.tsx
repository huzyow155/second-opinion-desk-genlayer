import React from 'react';
import { useWallet } from '../../context/WalletContext';
import { STUDIONET_NAME, STUDIONET_EXPLORER_URL, MIRROR_JUDGE_ADDRESS } from '../../config/chain';
import { Scale, ExternalLink, Wallet, CheckCircle2, AlertTriangle, ArrowRightLeft, Shield } from 'lucide-react';

interface NavbarProps {
  currentTab: 'landing' | 'app';
  setCurrentTab: (tab: 'landing' | 'app') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const {
    status,
    account,
    openChooser,
    switchToStudionet,
    disconnectWallet,
  } = useWallet();

  const isConnected = status === 'CONNECTED';
  const isWrongChain = status === 'WRONG_CHAIN';

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0c0d0f]/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('landing')}
              className="flex items-center gap-3 group text-left transition cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.12] flex items-center justify-center text-[#eef0f2] shadow-inner group-hover:bg-white/[0.10] group-hover:border-white/[0.22] transition-all">
                <Scale className="w-4 h-4 transition-transform group-hover:scale-105" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-[#eef0f2] block leading-tight">
                  Second-Opinion Desk
                </span>
                <span className="text-[11px] text-[#9fa5b0] font-medium tracking-wide">
                  Bias-Cancelled On-Chain Adjudication
                </span>
              </div>
            </button>
          </div>

          {/* Navigation items */}
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.07]">
            <button
              onClick={() => setCurrentTab('landing')}
              className={`px-3.5 py-1.2 rounded-lg text-xs font-medium transition cursor-pointer ${
                currentTab === 'landing'
                  ? 'bg-white/[0.10] text-[#ffffff] border border-white/[0.15] shadow-xs'
                  : 'text-[#9fa5b0] hover:text-[#eef0f2] hover:bg-white/[0.04]'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setCurrentTab('app')}
              className={`px-3.5 py-1.2 rounded-lg text-xs font-medium transition cursor-pointer ${
                currentTab === 'app'
                  ? 'bg-white/[0.10] text-[#ffffff] border border-white/[0.15] shadow-xs'
                  : 'text-[#9fa5b0] hover:text-[#eef0f2] hover:bg-white/[0.04]'
              }`}
            >
              Workbench
            </button>
          </nav>

          {/* Network & Wallet Controls */}
          <div className="flex items-center gap-2.5">
            {/* Studionet Network Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium silver-pill">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
              <span>{STUDIONET_NAME}</span>
            </div>

            {/* Contract Link */}
            <a
              href={`${STUDIONET_EXPLORER_URL}/address/${MIRROR_JUDGE_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center gap-1 text-[11px] text-[#9fa5b0] hover:text-white transition px-2.5 py-1 rounded-lg hover:bg-white/[0.05]"
              title="View MirrorJudge Contract on Explorer"
            >
              <Shield className="w-3.5 h-3.5 text-stone-400" />
              <span>Contract</span>
              <ExternalLink className="w-3 h-3 text-[#6c727d]" />
            </a>

            {/* Wrong Chain Prompt */}
            {isWrongChain && (
              <button
                onClick={switchToStudionet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Switch to 61999</span>
              </button>
            )}

            {/* Wallet Button */}
            {!isConnected ? (
              <button
                onClick={openChooser}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold btn-silver-primary cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-[#131518]/90 border border-white/[0.12] rounded-xl p-1 shadow-sm">
                <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium text-[#eef0f2]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{formatAddress(account || '')}</span>
                </div>
                <button
                  onClick={openChooser}
                  title="Choose wallet extension for Party 2"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-200 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] transition cursor-pointer"
                >
                  <ArrowRightLeft className="w-3 h-3 text-stone-300" />
                  <span>Switch Wallet</span>
                </button>
                <button
                  onClick={disconnectWallet}
                  title="Disconnect"
                  className="px-2 py-1 text-xs text-[#9fa5b0] hover:text-rose-400 transition font-medium cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
