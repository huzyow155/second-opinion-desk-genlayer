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
    selectedWalletInfo,
    openChooser,
    switchToStudionet,
    requestAccountSwitch,
    disconnectWallet,
  } = useWallet();

  const isConnected = status === 'CONNECTED';
  const isWrongChain = status === 'WRONG_CHAIN';

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className="sticky top-0 z-30 bg-[#f8faf9]/90 backdrop-blur-md border-b border-emerald-900/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentTab('landing')}
              className="flex items-center gap-3 group text-left transition"
            >
              <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-700 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Scale className="w-5 h-5 transition-transform group-hover:scale-105" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-stone-900 block leading-tight">
                  Second-Opinion Desk
                </span>
                <span className="text-xs text-stone-700 font-medium tracking-wide">
                  Bias-Cancelled On-Chain Adjudication
                </span>
              </div>
            </button>
          </div>

          {/* Navigation items */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-200/50 p-1 rounded-2xl border border-stone-300/40">
            <button
              onClick={() => setCurrentTab('landing')}
              className={`px-4 py-1.5 text-sm font-medium rounded-xl transition ${
                currentTab === 'landing'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setCurrentTab('app')}
              className={`px-4 py-1.5 text-sm font-medium rounded-xl transition ${
                currentTab === 'app'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              Workbench
            </button>
          </nav>

          {/* Network & Wallet Controls */}
          <div className="flex items-center gap-3">
            {/* Studionet Network Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-800 border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{STUDIONET_NAME}</span>
            </div>

            {/* Contract Link */}
            <a
              href={`${STUDIONET_EXPLORER_URL}/address/${MIRROR_JUDGE_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center gap-1 text-xs text-stone-700 hover:text-emerald-700 transition px-2 py-1"
              title="View MirrorJudge Contract on Explorer"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Contract</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            {/* Wrong Chain Prompt */}
            {isWrongChain && (
              <button
                onClick={switchToStudionet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Switch to 61999</span>
              </button>
            )}

            {/* Wallet Button */}
            {!isConnected ? (
              <button
                onClick={openChooser}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold btn-primary-green transition cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-2xl p-1 shadow-sm">
                <button
                  onClick={requestAccountSwitch}
                  title="Switch wallet account"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-medium text-stone-800 hover:bg-stone-100 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{formatAddress(account || '')}</span>
                  <ArrowRightLeft className="w-3 h-3 text-stone-600 ml-1" />
                </button>
                <button
                  onClick={disconnectWallet}
                  title="Disconnect"
                  className="px-2 py-1 text-xs text-stone-600 hover:text-red-600 transition font-medium"
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
