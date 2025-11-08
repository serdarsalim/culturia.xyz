'use client';

import { getCountryFlag, getCountryName } from '@/lib/countries';
import type { VideoCategory } from '@/types';

interface CategoryPickerProps {
  countryCode: string;
  counts: Record<VideoCategory, number>;
  loading?: boolean;
  onSelect: (category: VideoCategory) => void;
  onSubmitVideos: () => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<VideoCategory, { label: string; icon: string }> = {
  inspiration: { label: 'Inspiration', icon: '💡' },
  music: { label: 'Music', icon: '🎵' },
  comedy: { label: 'Comedy', icon: '😄' },
  cooking: { label: 'Cooking', icon: '🍳' },
  street_voices: { label: 'Street Voices', icon: '🎤' },
};

export default function CategoryPicker({ countryCode, counts, loading, onSelect, onSubmitVideos, onClose }: CategoryPickerProps) {
  const countryName = getCountryName(countryCode);
  const flag = getCountryFlag(countryCode);

  const allZero = Object.values(counts).every((c) => c === 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#ffffff',
          color: '#000000',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          padding: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>{flag}</span>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{countryName}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Choose a category to start</div>
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '9999px', border: 'none', background: '#f3f4f6', color: '#6b7280', cursor: 'pointer'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#000000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; }}
          >
            ✕
          </button>
        </div>

        {/* Categories */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '10px' }}>
          {(Object.keys(CATEGORY_LABELS) as VideoCategory[]).map((cat) => {
            const count = counts[cat] || 0;
            const disabled = loading || count === 0;
            return (
              <button
                key={cat}
                disabled={disabled}
                onClick={() => !disabled && onSelect(cat)}
                style={{
                  // Tighter top/bottom, roomier left/right
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: '1px solid ' + (disabled ? '#f3f4f6' : '#e5e7eb'),
                  background: disabled ? '#f9fafb' : '#ffffff',
                  color: '#000000',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  transition: 'background 0.2s, border 0.2s',
                }}
                onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.border = '1px solid #d1d5db'; } }}
                onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.border = '1px solid #e5e7eb'; } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>{CATEGORY_LABELS[cat].icon}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{CATEGORY_LABELS[cat].label}</span>
                </div>
                <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>{loading ? '…' : count}</span>
              </button>
            );
          })}

          {/* 6th tile: Submit Videos */}
          <button
            onClick={onSubmitVideos}
            style={{
              // Match category tile density but keep subtle accent
              padding: '10px 18px',
              borderRadius: '12px',
              border: '1px solid #fed7aa',
              background: '#fff7ed',
              color: '#9a3412',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'background 0.2s, border 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#ffedd5'; e.currentTarget.style.border = '1px solid #fdba74'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff7ed'; e.currentTarget.style.border = '1px solid #fed7aa'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>＋</span>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>Submit Videos</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
