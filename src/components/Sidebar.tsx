import React from 'react';
import { Compass, Star, HardDriveDownload, Settings, Search, LayoutGrid } from 'lucide-react';
import { useApp, ActiveView } from '../context/AppContext';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView } = useApp();

  return (
    <aside className="sidebar-dock">
      <div className="sidebar-top">
        {/* Search quick button */}
        <button
          className="sidebar-search-btn"
          onClick={() => setCurrentView('browse')}
          title="Search AniDB & Torrents"
        >
          <Search size={20} />
        </button>

        {/* Navigation items */}
        <button
          className={`nav-item ${currentView === 'discover' ? 'active' : ''}`}
          onClick={() => setCurrentView('discover')}
          title="Explore / 探索"
        >
          <Compass size={20} />
          <span className="nav-label">探索</span>
        </button>

        <button
          className={`nav-item ${currentView === 'browse' ? 'active' : ''}`}
          onClick={() => setCurrentView('browse')}
          title="AniDB Catalog / 浏览"
        >
          <LayoutGrid size={20} />
          <span className="nav-label">浏览</span>
        </button>

        <button
          className={`nav-item ${currentView === 'library' ? 'active' : ''}`}
          onClick={() => setCurrentView('library')}
          title="Watchlist / 追番"
        >
          <Star size={20} />
          <span className="nav-label">追番</span>
        </button>

        <button
          className={`nav-item ${currentView === 'cache' ? 'active' : ''}`}
          onClick={() => setCurrentView('cache')}
          title="Offline Cache & Torrents / 缓存"
        >
          <HardDriveDownload size={20} />
          <span className="nav-label">缓存</span>
        </button>
      </div>

      <div className="sidebar-bottom">
        <button
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentView('settings')}
          title="Settings / 设置"
        >
          <Settings size={20} />
          <span className="nav-label">设置</span>
        </button>
      </div>
    </aside>
  );
};
