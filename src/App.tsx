import React, { useState, useEffect } from 'react';
import { WalletProvider } from './context/WalletContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { WalletModal } from './components/common/WalletModal';
import { LandingPage } from './components/landing/LandingPage';
import { AppWorkbench } from './components/app/AppWorkbench';

export const AppContent: React.FC = () => {
  // Sync state with URL hash
  const getTabFromHash = (): 'landing' | 'app' => {
    const hash = window.location.hash.toLowerCase();
    if (hash.startsWith('#/app') || hash.startsWith('#app') || hash.startsWith('#/workbench')) {
      return 'app';
    }
    return 'landing';
  };

  const [currentTab, setCurrentTab] = useState<'landing' | 'app'>(getTabFromHash);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentTab(getTabFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSetTab = (tab: 'landing' | 'app') => {
    setCurrentTab(tab);
    window.location.hash = tab === 'app' ? '#/app' : '#/';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col text-[#eef0f2] font-sans selection:bg-white/20 selection:text-white relative">
      <div className="app-atmosphere" aria-hidden="true" />
      <div className="relative z-10 flex flex-col flex-1">
        <Navbar currentTab={currentTab} setCurrentTab={handleSetTab} />
        <WalletModal />

        <main className="flex-1">
          {currentTab === 'landing' ? (
            <LandingPage onLaunchApp={() => handleSetTab('app')} />
          ) : (
            <AppWorkbench />
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
};

export default App;
