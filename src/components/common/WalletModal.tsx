import React from 'react';
import { useWallet } from '../../context/WalletContext';
import { X, AlertCircle, ArrowUpRight, ShieldCheck, RefreshCw } from 'lucide-react';
import type { EIP6963ProviderDetail } from '../../types/dispute';

export const WalletModal: React.FC = () => {
  const {
    status,
    discoveredWallets,
    errorMessage,
    closeChooser,
    connectWallet,
  } = useWallet();

  if (status !== 'CHOOSER_OPEN' && status !== 'CONNECTING' && status !== 'ERROR') {
    return null;
  }

  const handleSelect = async (wallet: EIP6963ProviderDetail) => {
    await connectWallet(wallet);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md silver-frame-raised p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div>
            <h3 className="text-base font-bold text-[#eef0f2]">Connect Browser Wallet</h3>
            <p className="text-xs text-[#9fa5b0] mt-0.5">
              Supports EIP-6963 multi-wallet & standard injected providers
            </p>
          </div>
          <button
            onClick={closeChooser}
            className="p-1.5 rounded-xl text-[#9fa5b0] hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Wallet list */}
        <div className="mt-4 space-y-2">
          {discoveredWallets.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl silver-frame-inset border border-dashed border-white/[0.10]">
              <ShieldCheck className="w-8 h-8 text-[#6c727d] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#eef0f2]">No browser wallet detected</p>
              <p className="text-xs text-[#9fa5b0] mt-1 max-w-xs mx-auto">
                Please install MetaMask, Rabby, or any standard Web3 browser wallet extension.
              </p>
            </div>
          ) : (
            discoveredWallets.map((wallet) => (
              <button
                key={wallet.info.uuid || wallet.info.rdns}
                onClick={() => handleSelect(wallet)}
                disabled={status === 'CONNECTING'}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/[0.08] bg-[#121417]/80 hover:bg-white/[0.04] hover:border-white/[0.20] transition group text-left cursor-pointer"
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
                    <div className="text-sm font-medium text-[#eef0f2] group-hover:text-white">
                      {wallet.info.name}
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
                      <span>Connect</span>
                      <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Wallet switching / EIP-6963 note */}
        <div className="mt-4 p-3 rounded-xl silver-frame-inset text-[11px] text-[#9fa5b0] leading-relaxed">
          <p className="font-semibold text-[#eef0f2] mb-0.5">Cross-Extension Testing Note</p>
          To test two opposing parties (Party A and Party B), you can open two different browser wallet extensions (e.g. MetaMask and Rabby) or use multiple accounts in one wallet.
        </div>
      </div>
    </div>
  );
};
