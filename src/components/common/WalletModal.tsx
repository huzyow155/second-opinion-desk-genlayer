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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-stone-200/80 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Connect Browser Wallet</h3>
            <p className="text-xs text-stone-700 mt-0.5">
              Supports EIP-6963 multi-wallet & standard injected providers
            </p>
          </div>
          <button
            onClick={closeChooser}
            className="p-1.5 rounded-full text-stone-600 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Wallet list */}
        <div className="mt-4 space-y-2">
          {discoveredWallets.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-2xl bg-stone-50 border border-dashed border-stone-200">
              <ShieldCheck className="w-8 h-8 text-stone-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-stone-700">No browser wallet detected</p>
              <p className="text-xs text-stone-600 mt-1 max-w-xs mx-auto">
                Please install MetaMask, Rabby, or any standard Web3 wallet extension to submit disputes.
              </p>
            </div>
          ) : (
            discoveredWallets.map((wallet) => (
              <button
                key={wallet.info.uuid || wallet.info.rdns}
                onClick={() => handleSelect(wallet)}
                disabled={status === 'CONNECTING'}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-stone-200/80 bg-stone-50/50 hover:bg-emerald-50/40 hover:border-emerald-300 transition group text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center p-1.5 shadow-sm">
                    {wallet.info.icon ? (
                      <img
                        src={wallet.info.icon}
                        alt={wallet.info.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-emerald-600/10 text-emerald-600 flex items-center justify-center text-xs font-bold">
                        {wallet.info.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900 group-hover:text-emerald-900">
                      {wallet.info.name}
                    </div>
                    <div className="text-xs text-stone-600 font-mono">
                      {wallet.info.rdns || 'injected.provider'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-medium text-stone-600 group-hover:text-emerald-700">
                  {status === 'CONNECTING' ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : (
                    <>
                      <span>Connect</span>
                      <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Wallet switching / EIP-6963 note */}
        <div className="mt-5 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/50 text-[11px] text-emerald-800 leading-relaxed">
          <p className="font-semibold text-emerald-900 mb-0.5">Cross-Extension Testing Note</p>
          To test two opposing parties (Party A and Party B), you can open two different browser wallet extensions (e.g. MetaMask and Rabby) or use multiple accounts in one wallet.
        </div>
      </div>
    </div>
  );
};
