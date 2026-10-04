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
    if (hash === '#/app' || hash === '#app' || hash === '#/workbench') {
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
    <div className="min-h-screen flex flex-col bg-[#f8faf9] text-stone-800 font-sans selection:bg-emerald-100 selection:text-emerald-900">
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
