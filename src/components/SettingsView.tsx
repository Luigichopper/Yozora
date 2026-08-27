import React, { useState } from 'react';
import { Sparkles, Terminal, Shield, Rss, Palette, Check, RefreshCw, Copy, ExternalLink, HardDrive } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MATUGEN_PALETTES } from '../theme/matugen';
import { RSS_PROVIDERS } from '../data/mockSources';

export const SettingsView: React.FC = () => {
  const { activePalette, setActivePalette, blurEnabled, setBlurEnabled } = useApp();
  const [copiedRule, setCopiedRule] = useState(false);
  const [providers, setProviders] = useState(RSS_PROVIDERS);
  const [customRssUrl, setCustomRssUrl] = useState('');
  const [anidbClientName, setAnidbClientName] = useState('yozora_desktop');
  const [anidbClientVer, setAnidbClientVer] = useState('1');

  const hyprlandConfigSnippet = `# Hyprland Window Rules for Yozora (~/.config/hypr/hyprland.conf)
windowrulev2 = float, class:^(yozora)$
windowrulev2 = size 1200 800, class:^(yozora)$
windowrulev2 = center, class:^(yozora)$
windowrulev2 = opacity 0.95 0.90, class:^(yozora)$
windowrulev2 = rounding 20, class:^(yozora)$
windowrulev2 = noborder, class:^(yozora)$
windowrulev2 = idleinhibit focus, class:^(yozora)$`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hyprlandConfigSnippet);
    setCopiedRule(true);
    setTimeout(() => setCopiedRule(false), 2000);
  };

  const toggleProvider = (id: string) => {
    setProviders(prev =>
      prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p)
    );
  };

  const handleAddRss = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRssUrl.trim()) return;
    setProviders(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: `Custom RSS Feed (${new URL(customRssUrl).hostname})`,
        url: customRssUrl.trim(),
        enabled: true,
        latencyMs: 98
      }
    ]);
    setCustomRssUrl('');
  };

  return (
    <div className="settings-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
          系统与应用设置 • Settings & Theming
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
          Matugen dynamic Material You palettes, Hyprland window rules, AniDB API, and BitTorrent source adapters
        </p>
      </div>

      {/* 1. Matugen Dynamic Theme Engine */}
      <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Palette size={20} color="var(--md-sys-color-primary)" />
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
            Matugen Dynamic Material You Theming (End4-pC Spec)
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '18px' }}>
          Yozora watches <code style={{ color: 'var(--md-sys-color-primary)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>~/.config/matugen/colors.json</code> via inotify to automatically restyle with your live wallpaper changes.
        </p>

        {/* Palettes Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {MATUGEN_PALETTES.map(p => {
            const isSelected = activePalette.id === p.id;
            return (
              <div
                key={p.id}
                style={{
                  background: isSelected ? 'var(--md-sys-color-surface-container-highest)' : 'var(--md-sys-color-surface-container-high)',
                  border: `2px solid ${isSelected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}`,
                  borderRadius: '16px',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onClick={() => setActivePalette(p)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{p.name}</div>
                  {isSelected && (
                    <span style={{ background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} />
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '10px' }}>
                  {p.description}
                </div>

                {/* Color swatches */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: p.primary }} title="Primary" />
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: p.primaryContainer }} title="Primary Container" />
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: p.secondary }} title="Secondary" />
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: p.surface }} title="Surface" />
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: p.surfaceContainerHigh }} title="Surface High" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Hyprland & Wayland Compositor Integration */}
      <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={20} color="var(--md-sys-color-primary)" />
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
              Arch Linux / Hyprland Window Rules
            </h2>
          </div>

          <button className="section-btn" onClick={copyToClipboard}>
            {copiedRule ? <Check size={14} color="#4caf50" /> : <Copy size={14} />}
            <span>{copiedRule ? 'Copied to Clipboard!' : 'Copy Rule'}</span>
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '12px' }}>
          Add these window rules to your Hyprland configuration to enable seamless layer-shell blur, custom corner rounding, and idle inhibition during anime playback.
        </p>

        <pre
          style={{
            background: 'var(--md-sys-color-surface-container-high)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: '14px',
            padding: '14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: '#a6accd',
            overflowX: 'auto',
            lineHeight: 1.5
          }}
        >
          {hyprlandConfigSnippet}
        </pre>
      </div>

      {/* 3. Pluggable BitTorrent / RSS Sourcing Aggregators */}
      <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '24px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Rss size={20} color="var(--md-sys-color-primary)" />
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
            Content Sourcing Adapters (BitTorrent / RSS)
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          Per the Yozora architecture spec, content sourcing remains torrent/RSS-shaped and user-configured with zero scraping of unlicensed streaming CDNs.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
          {providers.map(p => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--md-sys-color-surface-container-high)',
                padding: '12px 16px',
                borderRadius: '14px',
                border: '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {p.url} • <span style={{ color: '#4caf50' }}>{p.latencyMs}ms</span>
                </div>
              </div>

              <input
                type="checkbox"
                checked={p.enabled}
                onChange={() => toggleProvider(p.id)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--md-sys-color-primary)', cursor: 'pointer' }}
              />
            </div>
          ))}
        </div>

        {/* Add custom RSS form */}
        <form onSubmit={handleAddRss} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="url"
            placeholder="Add custom RSS feed URL (e.g. https://.../feed.xml)"
            value={customRssUrl}
            onChange={(e) => setCustomRssUrl(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '12px',
              padding: '8px 14px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button type="submit" className="section-btn">
            <span>Add Feed</span>
          </button>
        </form>
      </div>

      {/* 4. AniDB Official Metadata API Integration */}
      <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Shield size={20} color="#ff9800" />
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
            AniDB (anidb.net) Official API Credentials
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          AniDB HTTP & UDP protocol integration with aggressive SQLite caching to adhere to strict flood-control and rate limits.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>
              AniDB Registered Client Name
            </label>
            <input
              type="text"
              value={anidbClientName}
              onChange={(e) => setAnidbClientName(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '12px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>
              Client Version Number
            </label>
            <input
              type="text"
              value={anidbClientVer}
              onChange={(e) => setAnidbClientVer(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '12px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50' }} />
          <span style={{ fontSize: '12px', color: '#4caf50', fontWeight: 600 }}>
            AniDB HTTP API: Connected (Rate Limit Backoff: 2.0s / Cache TTL: 7 Days)
          </span>
        </div>
      </div>
    </div>
  );
};
