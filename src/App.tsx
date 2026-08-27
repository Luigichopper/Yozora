import React from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { DiscoverView } from './components/DiscoverView';
import { AniDBBrowseView } from './components/AniDBBrowseView';
import { LibraryView } from './components/LibraryView';
import { CacheManagerView } from './components/CacheManagerView';
import { SettingsView } from './components/SettingsView';
import { AnimeDetailModal } from './components/AnimeDetailModal';
import { ScheduleModal } from './components/ScheduleModal';
import { PlayerView } from './components/PlayerView';
import { useApp } from './context/AppContext';

export const AppContent: React.FC = () => {
  const { currentView, selectedAnime, setSelectedAnime, playerState } = useApp();

  return (
    <div className="yozora-app">
      {/* Wayland Hyprland TitleBar */}
      <TitleBar />

      <div className="app-body">
        {/* Floating Side Dock */}
        <Sidebar />

        {/* Main Viewport */}
        <main className="main-viewport">
          {currentView === 'discover' && <DiscoverView />}
          {currentView === 'browse' && <AniDBBrowseView />}
          {currentView === 'library' && <LibraryView />}
          {currentView === 'cache' && <CacheManagerView />}
          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Anime Detail Modal */}
      {selectedAnime && (
        <AnimeDetailModal
          anime={selectedAnime}
          onClose={() => setSelectedAnime(null)}
        />
      )}

      {/* Seasonal Airing Schedule Modal */}
      <ScheduleModal />

      {/* Embedded Video Player */}
      {playerState?.isOpen && <PlayerView />}
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
