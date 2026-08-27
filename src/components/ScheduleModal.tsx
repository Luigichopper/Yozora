import React, { useState } from 'react';
import { X, Calendar, Clock, Star, Play } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MOCK_ANIME_DATABASE } from '../data/mockAniDB';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const DAYS_CN: Record<string, string> = {
  Monday: '周一 (Mon)',
  Tuesday: '周二 (Tue)',
  Wednesday: '周三 (Wed)',
  Thursday: '周四 (Thu)',
  Friday: '周五 (Fri)',
  Saturday: '周六 (Sat)',
  Sunday: '周日 (Sun)'
};

export const ScheduleModal: React.FC = () => {
  const { isScheduleOpen, setIsScheduleOpen, setSelectedAnime, openPlayer } = useApp();
  const [selectedDay, setSelectedDay] = useState<string>('Friday');

  if (!isScheduleOpen) return null;

  const dayAnime = MOCK_ANIME_DATABASE.filter(a => a.broadcastDay === selectedDay || (!a.broadcastDay && selectedDay === 'Friday'));

  return (
    <div className="modal-overlay" onClick={() => setIsScheduleOpen(false)}>
      <div
        className="m3-dialog"
        style={{ maxWidth: '820px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={22} color="var(--md-sys-color-primary)" />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>新番时间表 • Seasonal Airing Timetable</h2>
              <span style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                Spring 2026 / JST Broadcast Times from AniDB
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsScheduleOpen(false)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Day Selector Pills */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '16px 24px',
            overflowX: 'auto',
            background: 'var(--md-sys-color-surface-container)'
          }}
        >
          {DAYS.map(day => (
            <button
              key={day}
              className="section-btn"
              style={{
                background: selectedDay === day ? 'var(--md-sys-color-primary-container)' : 'transparent',
                color: selectedDay === day ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
                borderColor: selectedDay === day ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setSelectedDay(day)}
            >
              {DAYS_CN[day]}
            </button>
          ))}
        </div>

        {/* Anime Broadcast Grid */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '60vh', overflowY: 'auto' }}>
          {dayAnime.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--md-sys-color-on-surface-variant)' }}>
              No airing anime registered on {selectedDay} in local cache.
            </div>
          ) : (
            dayAnime.map(anime => (
              <div
                key={anime.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--md-sys-color-surface-container-high)',
                  padding: '12px 18px',
                  borderRadius: '16px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onClick={() => {
                  setIsScheduleOpen(false);
                  setSelectedAnime(anime);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <img
                    src={anime.poster}
                    alt={anime.title}
                    style={{ width: '48px', height: '68px', objectFit: 'cover', borderRadius: '8px' }}
                  />

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: 'rgba(255, 152, 0, 0.15)',
                          color: '#ff9800',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        <Clock size={10} style={{ display: 'inline', marginRight: '3px' }} />
                        {anime.broadcastTime || '24:00 JST'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
                        {anime.studio}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                      {anime.title}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                      {anime.japaneseTitle} • {anime.genres.slice(0, 3).join(', ')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffeb3b', fontSize: '13px', fontWeight: 700 }}>
                    <Star size={13} fill="#ffeb3b" />
                    {anime.rating.toFixed(1)}
                  </span>

                  <button
                    className="poster-overlay-play"
                    style={{ position: 'static', width: '32px', height: '32px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsScheduleOpen(false);
                      openPlayer(anime);
                    }}
                    title="Play Episode 01"
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
