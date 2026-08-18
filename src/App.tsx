import { useState } from 'react';
import { ConnectionChip } from './components/ConnectionChip';
import { HeaderControls } from './components/HeaderControls';
import { Tabs } from './components/Tabs';
import { CompareTab } from './features/compare/CompareTab';
import { EvolutionTab } from './features/evolution/EvolutionTab';
import { HistoryTab } from './features/history/HistoryTab';
import { MatchTab } from './features/match/MatchTab';
import { RosterTab } from './features/roster/RosterTab';
import { VoteJoinScreen } from './features/voting/VoteJoinScreen';
import { AppProvider, useAppState } from './state/AppContext';
import { LiveProvider } from './state/LiveContext';
import { VotingProvider } from './state/VotingContext';

type TabId = 'setup' | 'match' | 'history' | 'compare' | 'evolution';

const TABS: { id: TabId; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'match', label: 'Match' },
  { id: 'history', label: 'History' },
  { id: 'compare', label: 'Compare' },
  { id: 'evolution', label: 'Evolution' },
];

export default function App() {
  return (
    <AppProvider>
      <LiveProvider>
        <VotingProvider>
          <AppShell />
        </VotingProvider>
      </LiveProvider>
    </AppProvider>
  );
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('setup');
  // Defaults open if the page loaded from a #vote= join link, so that link
  // works standalone without also needing a click on the header button.
  const [voteJoinOpen, setVoteJoinOpen] = useState(() => location.hash.startsWith('#vote='));
  const { state, storageError, dismissStorageError } = useAppState();

  return (
    <div className="sp-app">
      <header className="sp-header">
        <div className="sp-header__brand">
          <span className="sp-header__brand-row">
            <svg className="sp-header__logo" viewBox="0 0 22 24" aria-hidden="true">
              <path
                d="M11 1.5 L20 5 V11.5 C20 17 16 21 11 22.5 C6 21 2 17 2 11.5 V5 Z"
                fill="none"
                stroke="var(--sp-accent)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle cx="11" cy="11" r="3.4" fill="none" stroke="var(--sp-accent)" strokeWidth="1.1" />
              <path d="M11 7.6 L13 9 L12.2 11.4 L9.8 11.4 L9 9 Z" fill="var(--sp-accent)" />
            </svg>
            S Q U A D - R E F
          </span>
          <small>Draft fair. Ref easy. Track everything.</small>
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
          <button type="button" className="sp-btn sp-btn--sm" onClick={() => setVoteJoinOpen(true)}>
            Stats vote
          </button>
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
        {voteJoinOpen && <VoteJoinScreen onClose={() => setVoteJoinOpen(false)} />}
        {activeTab === 'setup' && <RosterTab />}
        {activeTab === 'match' && <MatchTab onNavigateToHistory={() => setActiveTab('history')} />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'compare' && <CompareTab />}
        {activeTab === 'evolution' && <EvolutionTab />}
      </main>
    </div>
  );
}
