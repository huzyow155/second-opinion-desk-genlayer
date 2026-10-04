import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  STUDIONET_CHAIN_ID,
  STUDIONET_CHAIN_ID_HEX,
  STUDIONET_NAME,
  STUDIONET_RPC_URL,
  STUDIONET_EXPLORER_URL,
} from '../config/chain';
import type { EIP6963ProviderDetail } from '../types/dispute';

export type WalletStatus =
  | 'DISCONNECTED'
  | 'DISCOVERING'
  | 'CHOOSER_OPEN'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'WRONG_CHAIN'
  | 'ERROR';

export interface WalletContextValue {
  status: WalletStatus;
  account: string | null;
  chainId: number | null;
  selectedProvider: any | null;
  selectedWalletInfo: EIP6963ProviderDetail | null;
  discoveredWallets: EIP6963ProviderDetail[];
  errorMessage: string | null;
  openChooser: () => void;
  closeChooser: () => void;
  connectWallet: (wallet: EIP6963ProviderDetail) => Promise<void>;
  disconnectWallet: () => void;
  switchToStudionet: () => Promise<boolean>;
  requestAccountChangeInCurrentWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<WalletStatus>('DISCONNECTED');
  const [discoveredWallets, setDiscoveredWallets] = useState<EIP6963ProviderDetail[]>([]);
  const [selectedWalletInfo, setSelectedWalletInfo] = useState<EIP6963ProviderDetail | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep a ref to previous listener unbinders to prevent stale event cross-talk
  const activeListenersRef = useRef<{ accountsChanged?: any; chainChanged?: any; provider?: any }>({});

  // EIP-6963 announcement listener
  useEffect(() => {
    const handleAnnounce = (event: Event) => {
      const customEvent = event as CustomEvent<EIP6963ProviderDetail>;
      if (!customEvent.detail || !customEvent.detail.info || !customEvent.detail.provider) return;

      const detail = customEvent.detail;
      // Only accept if provider has callable request method
      if (typeof detail.provider.request !== 'function') return;

      setDiscoveredWallets((prev) => {
        const exists = prev.some(
          (w) => w.info.rdns === detail.info.rdns || w.info.uuid === detail.info.uuid
        );
        if (exists) return prev;
        return [...prev, detail];
      });
    };

    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Bounded legacy fallback: only if window.ethereum exists and is callable
    if (typeof window !== 'undefined' && (window as any).ethereum && typeof (window as any).ethereum.request === 'function') {
      const eth = (window as any).ethereum;
      const name = eth.isMetaMask ? 'MetaMask' : (eth.isRabby ? 'Rabby Wallet' : 'Injected Browser Wallet');
      const fallbackWallet: EIP6963ProviderDetail = {
        info: {
          uuid: 'injected-browser-wallet',
          name,
          icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%239aa1aa" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="3"/><path d="M16 12h.01"/></svg>',
          rdns: eth.isMetaMask ? 'io.metamask' : 'injected.ethereum',
        },
        provider: eth,
      };

      setDiscoveredWallets((prev) => {
        if (prev.length === 0) return [fallbackWallet];
        return prev;
      });
    }

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    };
  }, []);

  const openChooser = useCallback(() => {
    setErrorMessage(null);
    setStatus('CHOOSER_OPEN');
  }, []);

  const closeChooser = useCallback(() => {
    if (status === 'CHOOSER_OPEN') {
      setStatus(account ? 'CONNECTED' : 'DISCONNECTED');
    }
  }, [status, account]);

  const cleanupListeners = useCallback(() => {
    const { provider, accountsChanged, chainChanged } = activeListenersRef.current;
    if (provider && provider.removeListener) {
      if (accountsChanged) provider.removeListener('accountsChanged', accountsChanged);
      if (chainChanged) provider.removeListener('chainChanged', chainChanged);
    }
    activeListenersRef.current = {};
  }, []);

  const disconnectWallet = useCallback(() => {
    cleanupListeners();
    setSelectedWalletInfo(null);
    setSelectedProvider(null);
    setAccount(null);
    setChainId(null);
    setErrorMessage(null);
    setStatus('DISCONNECTED');
  }, [cleanupListeners]);

  const switchToStudionet = useCallback(async (): Promise<boolean> => {
    const provider = selectedProvider || (typeof window !== 'undefined' && (window as any).ethereum);
    if (!provider) return false;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
      });
      setChainId(STUDIONET_CHAIN_ID);
      setStatus('CONNECTED');
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: STUDIONET_CHAIN_ID_HEX,
                chainName: STUDIONET_NAME,
                nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
                rpcUrls: [STUDIONET_RPC_URL],
                blockExplorerUrls: [STUDIONET_EXPLORER_URL],
              },
            ],
          });
          setChainId(STUDIONET_CHAIN_ID);
          setStatus('CONNECTED');
          return true;
        } catch (addError: any) {
          setErrorMessage('Could not add Studionet to wallet: ' + (addError.message || 'Rejected'));
          setStatus('WRONG_CHAIN');
          return false;
        }
      } else {
        setErrorMessage('Please approve network switch to GenLayer Studionet (61999).');
        setStatus('WRONG_CHAIN');
        return false;
      }
    }
  }, [selectedProvider]);

  const connectWallet = useCallback(
    async (walletDetail: EIP6963ProviderDetail) => {
      setStatus('CONNECTING');
      setErrorMessage(null);
      cleanupListeners();

      const provider = walletDetail.provider;
      if (!provider || typeof provider.request !== 'function') {
        setErrorMessage('Selected wallet provider is not responding.');
        setStatus('ERROR');
        return;
      }

      try {
        const accounts: string[] = await provider.request({
          method: 'eth_requestAccounts',
        });

        if (!accounts || accounts.length === 0) {
          throw new Error('No account authorized in wallet');
        }

        const rawChainId: string = await provider.request({
          method: 'eth_chainId',
        });
        const parsedChainId = parseInt(rawChainId, 16);

        // Atomic update of canonical wallet session state
        setSelectedProvider(provider);
        setSelectedWalletInfo(walletDetail);
        setAccount(accounts[0]);
        setChainId(parsedChainId);

        if (parsedChainId !== STUDIONET_CHAIN_ID) {
          setStatus('WRONG_CHAIN');
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
            });
            setChainId(STUDIONET_CHAIN_ID);
            setStatus('CONNECTED');
          } catch {
            // Keep status as WRONG_CHAIN so user can click switch
          }
        } else {
          setStatus('CONNECTED');
        }

        // Setup clean event listeners for this active provider
        const handleAccountsChanged = (newAccounts: string[]) => {
          if (!newAccounts || newAccounts.length === 0) {
            disconnectWallet();
          } else {
            setAccount(newAccounts[0]);
          }
        };

        const handleChainChanged = (newChainHex: string) => {
          const newId = parseInt(newChainHex, 16);
          setChainId(newId);
          if (newId !== STUDIONET_CHAIN_ID) {
            setStatus('WRONG_CHAIN');
          } else {
            setStatus('CONNECTED');
          }
        };

        provider.on?.('accountsChanged', handleAccountsChanged);
        provider.on?.('chainChanged', handleChainChanged);

        activeListenersRef.current = {
          provider,
          accountsChanged: handleAccountsChanged,
          chainChanged: handleChainChanged,
        };
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to connect wallet');
        setStatus('ERROR');
      }
    },
    [cleanupListeners, disconnectWallet]
  );

  const requestAccountChangeInCurrentWallet = useCallback(async () => {
    if (!selectedProvider) return;
    try {
      await selectedProvider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts: string[] = await selectedProvider.request({
        method: 'eth_accounts',
      });
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Account change cancelled');
    }
  }, [selectedProvider]);

  return (
    <WalletContext.Provider
      value={{
        status,
        account,
        chainId,
        selectedProvider,
        selectedWalletInfo,
        discoveredWallets,
        errorMessage,
        openChooser,
        closeChooser,
        connectWallet,
        disconnectWallet,
        switchToStudionet,
        requestAccountChangeInCurrentWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
