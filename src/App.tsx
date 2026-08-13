import { useState } from 'react';
import { ConnectionChip } from './components/ConnectionChip';
import { HeaderControls } from './components/HeaderControls';
import { Tabs } from './components/Tabs';
import { HistoryTab } from './features/history/HistoryTab';
import { MatchTab } from './features/match/MatchTab';
import { RosterTab } from './features/roster/RosterTab';
import { AppProvider, useAppState } from './state/AppContext';
import { LiveProvider } from './state/LiveContext';

type TabId = 'setup' | 'match' | 'history';

const TABS: { id: TabId; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'match', label: 'Match' },
  { id: 'history', label: 'History' },
];

export default function App() {
  return (
    <AppProvider>
      <LiveProvider>
        <AppShell />
      </LiveProvider>
    </AppProvider>
  );
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('setup');
  const { state, storageError, dismissStorageError } = useAppState();

  return (
    <div className="sp-app">
      <header className="sp-header">
        <div className="sp-header__brand">
          soccerPicker
          <small>pickup team builder</small>
        </div>
        <Tabs
          tabs={TABS}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />
        <div className="sp-header__spacer" />
        <div className="sp-header__controls">
          <span className="sp-badge">{state.players.length} PLAYERS</span>
          <ConnectionChip />
          <HeaderControls />
        </div>
      </header>
      <main className="sp-main">
        {storageError && (
          <div className="sp-banner sp-banner--danger" role="alert">
            <span>{storageError}</span>
            <button type="button" className="sp-btn sp-btn--sm" onClick={dismissStorageError}>
              Dismiss
            </button>
          </div>
        )}
        {activeTab === 'setup' && <RosterTab />}
        {activeTab === 'match' && <MatchTab />}
        {activeTab === 'history' && <HistoryTab />}
      </main>
    </div>
  );
}
