import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  requestAccountSwitch: () => Promise<void>;
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

  // EIP-6963 announcement listener
  useEffect(() => {
    const handleAnnounce = (event: Event) => {
      const customEvent = event as CustomEvent<EIP6963ProviderDetail>;
      if (!customEvent.detail || !customEvent.detail.info) return;

      const detail = customEvent.detail;
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

    // Check for standard window.ethereum fallback
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      const fallbackWallet: EIP6963ProviderDetail = {
        info: {
          uuid: 'injected-metamask-fallback',
          name: eth.isMetaMask ? 'MetaMask' : (eth.isRabby ? 'Rabby Wallet' : 'Injected Browser Wallet'),
          icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2310b981" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="3"/><path d="M16 12h.01"/></svg>',
          rdns: 'io.metamask',
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

  const disconnectWallet = useCallback(() => {
    setSelectedWalletInfo(null);
    setSelectedProvider(null);
    setAccount(null);
    setChainId(null);
    setErrorMessage(null);
    setStatus('DISCONNECTED');
  }, []);

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
      setSelectedWalletInfo(walletDetail);
      const provider = walletDetail.provider;
      setSelectedProvider(provider);

      try {
        const accounts: string[] = await provider.request({
          method: 'eth_requestAccounts',
        });

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts selected');
        }

        const rawChainId: string = await provider.request({
          method: 'eth_chainId',
        });
        const parsedChainId = parseInt(rawChainId, 16);

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
            // Keep status as WRONG_CHAIN
          }
        } else {
          setStatus('CONNECTED');
        }

        // Account & chain change event listeners
        provider.on?.('accountsChanged', (newAccounts: string[]) => {
          if (!newAccounts || newAccounts.length === 0) {
            disconnectWallet();
          } else {
            setAccount(newAccounts[0]);
          }
        });

        provider.on?.('chainChanged', (newChainHex: string) => {
          const newId = parseInt(newChainHex, 16);
          setChainId(newId);
          if (newId !== STUDIONET_CHAIN_ID) {
            setStatus('WRONG_CHAIN');
          } else {
            setStatus('CONNECTED');
          }
        });
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to connect wallet');
        setStatus('ERROR');
      }
    },
    [disconnectWallet]
  );

  const requestAccountSwitch = useCallback(async () => {
    const provider = selectedProvider || (typeof window !== 'undefined' && (window as any).ethereum);
    if (!provider) return;

    try {
      // EIP-2255 or wallet_requestPermissions forces account picker prompt
      await provider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts: string[] = await provider.request({
        method: 'eth_accounts',
      });
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch {
      // Fallback: open chooser to let user pick a different wallet extension
      openChooser();
    }
  }, [selectedProvider, openChooser]);

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
        requestAccountSwitch,
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
