import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Terminal, Shield, Rss, Palette, Check, RefreshCw, Copy, ExternalLink, HardDrive, Image as ImageIcon, FileCode, CheckCircle2, Cpu, Play } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MATUGEN_PALETTES } from '../theme/matugen';
import { sourceService, RSSFeedProvider } from '../services/sourceService';
import { matugenService } from '../services/matugenService';
import { rqbitService, RqbitStatus } from '../services/rqbitService';
import { anilistService } from '../services/tracking/anilist';
import { db } from '../services/db';

export const SettingsView: React.FC = () => {
  const { activePalette, setActivePalette, blurEnabled, setBlurEnabled, showToast } = useApp();
  const [copiedRule, setCopiedRule] = useState(false);
  const [providers, setProviders] = useState<RSSFeedProvider[]>([]);
  const [customRssUrl, setCustomRssUrl] = useState('');
  const [customRssName, setCustomRssName] = useState('');
  const [anilistToken, setAnilistToken] = useState(anilistService.getToken() || '');
  const [matugenJsonInput, setMatugenJsonInput] = useState('');
  const [showJsonDialog, setShowJsonDialog] = useState(false);
  const [rqbitStatus, setRqbitStatus] = useState<RqbitStatus>({ running: false, listen_addr: '127.0.0.1:3030' });
  const [rqbitListenPort, setRqbitListenPort] = useState('3030');
  const [useExternalMpv, setUseExternalMpv] = useState(false);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);

  const [anilistApiOnline, setAnilistApiOnline] = useState<boolean>(true);

  // Load active providers, AniList token, and rqbit daemon status on mount
  useEffect(() => {
    async function loadData() {
      const p = await sourceService.getProviders();
      setProviders(p);
      setAnilistToken(anilistService.getToken() || '');

      const savedMpvPref = await db.getSetting<boolean>('use_external_mpv', false);
      setUseExternalMpv(savedMpvPref);

      const savedPort = await db.getSetting<string>('rqbit_port', '3030');
      setRqbitListenPort(savedPort);

      const rStatus = await rqbitService.checkStatus(`127.0.0.1:${savedPort}`);
      setRqbitStatus(rStatus);

      // Measure real AniList GraphQL connectivity
      try {
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ Page(page: 1, perPage: 1) { media { id } } }' }),
          signal: AbortSignal.timeout(3000)
        });
        setAnilistApiOnline(res.ok);
      } catch {
        setAnilistApiOnline(false);
      }
    }
    loadData();
  }, []);

  const handleToggleExternalMpv = async () => {
    const nextVal = !useExternalMpv;
    setUseExternalMpv(nextVal);
    await db.saveSetting('use_external_mpv', nextVal);
    showToast(
      nextVal
        ? 'External mpv selected as primary player (10-bit HEVC & ASS subtitles).'
        : 'In-app HTML5 player selected as primary player.',
      'info'
    );
  };

  const handleSaveAniListToken = () => {
    if (anilistToken.trim()) {
      anilistService.setToken(anilistToken.trim());
      showToast('Saved AniList Personal Access Token! Progress will sync automatically.', 'success');
    } else {
      anilistService.clearToken();
      setAnilistToken('');
      showToast('Cleared AniList token (Local-only mode active).', 'info');
    }
  };

  const handleStartRqbit = async () => {
    rqbitService.setListenPort(rqbitListenPort);
    await db.saveSetting('rqbit_port', rqbitListenPort);
    showToast('Starting rqbit background daemon on port ' + rqbitListenPort + '...', 'info');
    try {
      const res = await rqbitService.startServer(`127.0.0.1:${rqbitListenPort}`);
      setRqbitStatus(res);
      if (res.running) {
        showToast('rqbit server online and listening on ' + res.listen_addr, 'success');
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to start rqbit daemon. Is rqbit installed on your system PATH?', 'error');
    }
  };

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
    showToast('Copied Hyprland window rule to clipboard!', 'success');
    setTimeout(() => setCopiedRule(false), 2000);
  };

  const toggleProvider = async (id: string) => {
    const updated = providers.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p);
    setProviders(updated);
    await sourceService.updateProviders(updated);
    showToast('Updated RSS source provider status.', 'info');
  };

  const handleAddRss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRssUrl.trim()) return;
    const name = customRssName.trim() || new URL(customRssUrl).hostname;
    const newP = await sourceService.addProvider(name, customRssUrl.trim());
    setProviders(prev => [...prev, newP]);
    setCustomRssUrl('');
    setCustomRssName('');
    showToast(`Added RSS Feed: ${name}`, 'success');
  };

  // Extract palette from uploaded desktop wallpaper
  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const extracted = await matugenService.extractPaletteFromImage(file);
    await setActivePalette(extracted);
    showToast(`Extracted Matugen palette from "${file.name}"!`, 'success');
  };

  // Parse pasted Matugen colors.json
  const handleApplyMatugenJson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matugenJsonInput.trim()) return;
    const parsed = matugenService.parseMatugenJson(matugenJsonInput.trim());
    if (parsed) {
      await setActivePalette(parsed);
      setShowJsonDialog(false);
      setMatugenJsonInput('');
      showToast('Applied live Matugen colors.json configuration!', 'success');
    } else {
      showToast('Invalid Matugen colors.json format.', 'error');
    }
  };

  return (
    <div className="settings-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <input
        type="file"
        ref={wallpaperInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleWallpaperUpload}
      />

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Palette size={20} color="var(--md-sys-color-primary)" />
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
              Matugen Dynamic Material You Theming (End4-pC Spec)
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="section-btn"
              onClick={() => wallpaperInputRef.current?.click()}
              title="Pick wallpaper image to extract colors"
            >
              <ImageIcon size={14} />
              <span>Extract from Wallpaper</span>
            </button>

            <button
              className="section-btn"
              onClick={() => setShowJsonDialog(true)}
              title="Import ~/.config/matugen/colors.json"
            >
              <FileCode size={14} />
              <span>Import colors.json</span>
            </button>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '18px' }}>
          Yozora consumes Matugen tokens dynamically to restyle with your live wallpaper changes. Choose a curated preset or extract palette tokens directly from your desktop wallpaper.
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

      {/* 2. Hyprland & Wayland Window Rules */}
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
          Add these window rules to your Hyprland configuration (<code style={{ color: 'var(--md-sys-color-primary)' }}>~/.config/hypr/hyprland.conf</code>) to enable smooth layer-shell blur, custom corner rounding, and idle inhibition during playback.
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
                  {p.url} • <span style={{ color: '#4caf50' }}>{p.latencyMs}ms latency</span>
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
            type="text"
            placeholder="Provider Name (e.g. SubsPlease)"
            value={customRssName}
            onChange={(e) => setCustomRssName(e.target.value)}
            style={{
              width: '180px',
              background: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '12px',
              padding: '8px 14px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <input
            type="url"
            placeholder="RSS feed URL (e.g. https://nyaa.si/?page=rss)"
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

      {/* 4. AniList GraphQL Metadata & Account Watch Sync */}
      <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '24px', padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Shield size={20} color="#02a9ff" />
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
            AniList GraphQL Metadata & Cover Service
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          Live anime metadata, cover posters, banners, streaming episodes, and seasonal airing schedules are queried directly via the public <strong>AniList GraphQL API</strong> with local 7-day TTL caching.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: anilistApiOnline ? '#4caf50' : '#f44336' }} />
          <span style={{ fontSize: '12px', color: anilistApiOnline ? '#4caf50' : '#f44336', fontWeight: 600 }}>
            {anilistApiOnline ? 'AniList GraphQL Engine Active • 800ms Rate Limit Protection' : 'AniList GraphQL Offline / Unreachable'}
          </span>
        </div>
      </div>

      {/* 4b. AniList Account Watch Progress Sync */}
      <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '24px', padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} color="var(--md-sys-color-primary)" />
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
              AniList Account Watch Sync
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: anilistToken ? '#4caf50' : '#888' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: anilistToken ? '#4caf50' : '#aaa' }}>
              {anilistToken ? 'AniList Sync Connected' : 'Unlinked (Local-Only Tracking)'}
            </span>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          Enter your <strong>AniList Personal Access Token</strong> to automatically sync episode watch progress, completed status, and ratings back to your public AniList profile as you watch.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="password"
            placeholder="Paste your AniList OAuth / Access Token..."
            value={anilistToken}
            onChange={(e) => setAnilistToken(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: '12px',
              padding: '8px 14px',
              color: '#fff',
              fontSize: '13px'
            }}
          />
          <button
            type="button"
            className="section-btn"
            onClick={handleSaveAniListToken}
            style={{ padding: '8px 20px' }}
          >
            {anilistToken ? 'Save Token' : 'Clear Token'}
          </button>
        </div>
      </div>

      {/* 5. rqbit BT Streaming Core & mpv Hardware Acceleration */}
      <div style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '24px', padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={20} color="var(--md-sys-color-primary)" />
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
              rqbit BitTorrent Streaming Server & mpv Core
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: rqbitStatus.running ? '#4caf50' : '#ff9800' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: rqbitStatus.running ? '#4caf50' : '#ff9800' }}>
              {rqbitStatus.running ? `rqbit Daemon Online (Port ${rqbitListenPort})` : 'rqbit Daemon Standby'}
            </span>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          Yozora drives <code>rqbit server start</code> as a background subprocess, prioritizing sequential piece downloads and serving high-throughput <code>GET /torrents/&#123;id&#125;/stream/&#123;idx&#125;</code> streams with Range header seeking directly to the player.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>
              rqbit HTTP Listen Port
            </label>
            <input
              type="text"
              value={rqbitListenPort}
              onChange={(e) => setRqbitListenPort(e.target.value)}
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
              Torrent Disk Cache Directory
            </label>
            <input
              type="text"
              readOnly
              value="~/.cache/yozora/torrents"
              style={{
                width: '100%',
                background: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '12px',
                padding: '8px 12px',
                color: '#a6accd',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
              Default to External mpv Player (Seanime Standard)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
              Launch mpv with IPC socket, hardware acceleration, and native 10-bit HEVC / ASS subtitle decoding
            </div>
          </div>

          <input
            type="checkbox"
            checked={useExternalMpv}
            onChange={handleToggleExternalMpv}
            style={{ width: '18px', height: '18px', accentColor: 'var(--md-sys-color-primary)', cursor: 'pointer' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          <button
            type="button"
            className="section-btn"
            onClick={handleStartRqbit}
            style={{ background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderColor: 'var(--md-sys-color-primary)', padding: '8px 18px' }}
          >
            <RefreshCw size={14} />
            <span>{rqbitStatus.running ? 'Restart rqbit Daemon' : 'Start rqbit Daemon'}</span>
          </button>

          {rqbitStatus.running && (
            <button
              type="button"
              className="section-btn"
              onClick={async () => {
                await rqbitService.stopServer();
                setRqbitStatus({ running: false, listen_addr: `127.0.0.1:${rqbitListenPort}` });
                showToast('Stopped rqbit daemon.', 'info');
              }}
              style={{ background: 'var(--md-sys-color-surface-container-high)', color: '#ff5252', padding: '8px 18px' }}
            >
              <span>Stop Daemon</span>
            </button>
          )}

          <div style={{ fontSize: '11px', color: 'var(--md-sys-color-on-surface-variant)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
            Endpoint: http://127.0.0.1:{rqbitListenPort}/torrents/&#123;id&#125;/stream/0
          </div>
        </div>
      </div>

      {/* Matugen JSON Dialog */}
      {showJsonDialog && (
        <div className="modal-overlay" onClick={() => setShowJsonDialog(false)}>
          <div className="m3-dialog" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                Import Matugen colors.json Config
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
                Paste the contents of <code style={{ color: 'var(--md-sys-color-primary)' }}>~/.config/matugen/colors.json</code> to apply your live Hyprland theme.
              </p>

              <form onSubmit={handleApplyMatugenJson}>
                <textarea
                  placeholder='{"colors": {"primary": "#e4b5cb", "surface": "#151218", ...}}'
                  value={matugenJsonInput}
                  onChange={(e) => setMatugenJsonInput(e.target.value)}
                  style={{
                    width: '100%',
                    height: '140px',
                    background: 'var(--md-sys-color-surface-container-high)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: '12px',
                    padding: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    resize: 'none',
                    marginBottom: '16px'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="section-btn" onClick={() => setShowJsonDialog(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="section-btn"
                    style={{ background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderColor: 'var(--md-sys-color-primary)', fontWeight: 700 }}
                  >
                    Apply Theme
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
