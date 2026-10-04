import React from 'react';
import { useWallet } from '../../context/WalletContext';
import { X, AlertCircle, ArrowUpRight, ShieldCheck, RefreshCw, ArrowRightLeft, UserCheck } from 'lucide-react';
import type { EIP6963ProviderDetail } from '../../types/dispute';

export const WalletModal: React.FC = () => {
  const {
    status,
    account,
    selectedWalletInfo,
    discoveredWallets,
    errorMessage,
    closeChooser,
    connectWallet,
    requestAccountChangeInCurrentWallet,
  } = useWallet();

  if (status !== 'CHOOSER_OPEN' && status !== 'CONNECTING' && status !== 'ERROR') {
    return null;
  }

  const isConnected = !!account;

  const handleSelect = async (wallet: EIP6963ProviderDetail) => {
    await connectWallet(wallet);
  };

  const formatAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md silver-frame-raised p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div>
            <h3 className="text-base font-bold text-[#eef0f2]">
              {isConnected ? 'Switch Wallet' : 'Connect Browser Wallet'}
            </h3>
            <p className="text-xs text-[#9fa5b0] mt-0.5">
              {isConnected
                ? 'Choose the wallet extension for Party 2'
                : 'Select an authorized EIP-6963 wallet extension'}
            </p>
          </div>
          <button
            onClick={closeChooser}
            className="p-1.5 rounded-xl text-[#9fa5b0] hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Account Banner if already connected */}
        {isConnected && selectedWalletInfo && (
          <div className="mt-4 p-3 rounded-xl silver-frame-inset space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9fa5b0] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Currently Active:</span>
              </span>
              <span className="font-mono text-[#eef0f2] font-semibold">{formatAddr(account || '')}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.06]">
              <span className="text-[#6c727d]">Wallet: {selectedWalletInfo.info.name}</span>
              <button
                type="button"
                onClick={requestAccountChangeInCurrentWallet}
                className="text-stone-300 hover:text-white font-medium underline cursor-pointer flex items-center gap-1"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Change account in {selectedWalletInfo.info.name}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Available Wallet Extensions list */}
        <div className="mt-4 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6c727d] px-1">
            {isConnected ? 'Or connect another extension for Party 2:' : 'Detected Wallet Extensions:'}
          </div>

          {discoveredWallets.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl silver-frame-inset border border-dashed border-white/[0.10]">
              <ShieldCheck className="w-8 h-8 text-[#6c727d] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#eef0f2]">No browser wallet detected</p>
              <p className="text-xs text-[#9fa5b0] mt-1 max-w-xs mx-auto">
                Please install MetaMask, Rabby, or any standard Web3 browser wallet extension.
              </p>
            </div>
          ) : (
            discoveredWallets.map((wallet) => {
              const isActive = selectedWalletInfo?.info.uuid === wallet.info.uuid ||
                selectedWalletInfo?.info.rdns === wallet.info.rdns;

              return (
                <button
                  key={wallet.info.uuid || wallet.info.rdns}
                  onClick={() => handleSelect(wallet)}
                  disabled={status === 'CONNECTING'}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition group text-left cursor-pointer ${
                    isActive
                      ? 'border-white/[0.25] bg-white/[0.08]'
                      : 'border-white/[0.08] bg-[#121417]/80 hover:bg-white/[0.04] hover:border-white/[0.20]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.10] flex items-center justify-center p-1.5 shadow-xs">
                      {wallet.info.icon ? (
                        <img
                          src={wallet.info.icon}
                          alt={wallet.info.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/[0.12] text-white flex items-center justify-center text-xs font-bold">
                          {wallet.info.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[#eef0f2] group-hover:text-white flex items-center gap-1.5">
                        <span>{wallet.info.name}</span>
                        {isActive && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#6c727d] font-mono">
                        {wallet.info.rdns || 'injected.provider'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-medium text-[#9fa5b0] group-hover:text-white">
                    {status === 'CONNECTING' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#eef0f2]" />
                    ) : (
                      <>
                        <span>{isActive ? 'Reconnect' : 'Select'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Testing Guidance */}
        <div className="mt-4 p-3 rounded-xl silver-frame-inset text-[11px] text-[#9fa5b0] leading-relaxed">
          <p className="font-semibold text-[#eef0f2] mb-0.5">Two-Party Dispute Workflow</p>
          Party A and Party B must be distinct addresses. Switch between two browser extensions (e.g. MetaMask &amp; Rabby) or switch accounts to submit opposing evidence.
        </div>
      </div>
    </div>
  );
};
