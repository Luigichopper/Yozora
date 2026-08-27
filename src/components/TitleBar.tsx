import React from 'react';
import { Search, Settings, Shield, Sparkles, Terminal } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const TitleBar: React.FC = () => {
  const { currentView, setCurrentView, activePalette, searchQuery, setSearchQuery } = useApp();

  return (
    <div className="wayland-titlebar">
      <div className="window-controls">
        <div className="window-dot close" title="Close (Super+Q)" />
        <div className="window-dot minimize" title="Minimize" />
        <div className="window-dot maximize" title="Toggle Floating (Super+Space)" />
        <span style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginLeft: '8px', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
          archlinux:wayland (hyprland)
        </span>
      </div>

      <div className="app-title-chip">
        <div className="pulse-dot" />
        <span>Yozora v0.1.0 • {activePalette.name.split(' ')[0]}</span>
      </div>

      <div className="titlebar-actions">
        <button
          className="section-btn"
          style={{ padding: '4px 10px', fontSize: '11px', background: 'transparent' }}
          onClick={() => setCurrentView('settings')}
          title="Matugen Dynamic Theming"
        >
          <Sparkles size={13} color="var(--md-sys-color-primary)" />
          <span>Matugen Sync</span>
        </button>

        <button
          className="section-btn"
          style={{ padding: '4px 10px', fontSize: '11px' }}
          onClick={() => setCurrentView('settings')}
          title="Hyprland & App Settings"
        >
          <Settings size={13} />
        </button>

        <div
          className="avatar-badge"
          title="AniDB Profile: Luigi (Connected)"
          onClick={() => setCurrentView('library')}
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=120&q=80)'
          }}
        />
      </div>
    </div>
  );
};
