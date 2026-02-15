'use client';

import { useEffect, useState } from 'react';
import { getCountryFlag, getCountryName } from '@/lib/countries';

interface CountryImpressionModalProps {
  countryCode: string;
  recentPosts: string[];
  onClose: () => void;
}

function countWords(label: string): number {
  return label.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

function buildLabelSet(labels: string[]): Set<string> {
  return new Set(labels.map((label) => normalizeLabel(label).toLowerCase()));
}

function toLabelCase(label: string): string {
  return normalizeLabel(label)
    .split(' ')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ');
}

export default function CountryImpressionModal({ countryCode, recentPosts, onClose }: CountryImpressionModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [impression, setImpression] = useState('');
  const [isWriteOpen, setIsWriteOpen] = useState(recentPosts.length > 0);
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [prosInput, setProsInput] = useState('');
  const [consInput, setConsInput] = useState('');
  const [beenThere, setBeenThere] = useState(false);

  const countryName = getCountryName(countryCode);
  const flag = getCountryFlag(countryCode);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
    };
  }, []);

  function addTokenizedLabels(raw: string, kind: 'pros' | 'cons') {
    if (!raw.includes(',')) {
      return;
    }

    const parts = raw.split(',');
    const pending = parts.pop() ?? '';
    const committed = parts.map(normalizeLabel).filter(Boolean);

    if (committed.length > 0) {
      if (kind === 'pros') {
        setPros((prev) => {
          const next = [...prev];
          const existing = buildLabelSet(prev);

          for (const label of committed) {
            if (next.length >= 5) break;
            if (countWords(label) > 3) continue;
            const key = normalizeLabel(label).toLowerCase();
            if (existing.has(key)) continue;
            next.push(toLabelCase(label));
            existing.add(key);
          }

          return next;
        });
      } else {
        setCons((prev) => {
          const next = [...prev];
          const existing = buildLabelSet(prev);

          for (const label of committed) {
            if (next.length >= 5) break;
            if (countWords(label) > 3) continue;
            const key = normalizeLabel(label).toLowerCase();
            if (existing.has(key)) continue;
            next.push(toLabelCase(label));
            existing.add(key);
          }

          return next;
        });
      }
    }

    if (kind === 'pros') {
      setProsInput(pending);
    } else {
      setConsInput(pending);
    }
  }

  function commitRemaining(raw: string, kind: 'pros' | 'cons') {
    const label = normalizeLabel(raw);
    if (!label) return;
    if (countWords(label) > 3) return;

    if (kind === 'pros') {
      setPros((prev) => {
        if (prev.length >= 5) return prev;
        const key = label.toLowerCase();
        if (buildLabelSet(prev).has(key)) return prev;
        return [...prev, toLabelCase(label)];
      });
      setProsInput('');
      return;
    }

    setCons((prev) => {
      if (prev.length >= 5) return prev;
      const key = label.toLowerCase();
      if (buildLabelSet(prev).has(key)) return prev;
      return [...prev, toLabelCase(label)];
    });
    setConsInput('');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        backgroundColor: 'rgba(15, 23, 42, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '0' : '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isMobile ? '717px' : '980px',
          height: isMobile ? '100vh' : '90vh',
          maxHeight: isMobile ? '100vh' : '95vh',
          backgroundColor: '#ffffff',
          borderRadius: isMobile ? '0' : '16px',
          boxShadow: isMobile ? 'none' : '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={{
            position: 'absolute',
            top: isMobile ? 'max(env(safe-area-inset-top, 0px) + 12px, 48px)' : '12px',
            right: isMobile ? 'max(env(safe-area-inset-right, 0px) + 12px, 16px)' : '12px',
            width: isMobile ? '44px' : '40px',
            height: isMobile ? '44px' : '40px',
            borderRadius: '9999px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            zIndex: 2,
            fontSize: isMobile ? '24px' : '22px',
            fontWeight: '300',
            boxShadow: isMobile ? '0 4px 12px rgba(0, 0, 0, 0.5)' : 'none'
          }}
        >
          ✕
        </button>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingTop: isMobile ? '64px' : '56px',
            paddingLeft: isMobile ? '16px' : '32px',
            paddingRight: isMobile ? '16px' : '32px',
            paddingBottom: isMobile ? '16px' : '28px',
            color: '#0f172a'
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: isMobile ? '24px' : '30px', fontWeight: 700, lineHeight: 1.2 }}>
              <span style={{ marginRight: '10px' }}>{flag}</span>
              {countryName}
            </div>
          </div>

          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 600 }}>Recent posts</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {recentPosts.length > 0 ? (
                recentPosts.map((post, idx) => (
                  <div
                    key={`${post.slice(0, 20)}-${idx}`}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      lineHeight: 1.4,
                      fontSize: '14px'
                    }}
                  >
                    {post}
                  </div>
                ))
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>No posts yet. Be the first to add one.</div>
              )}
            </div>
          </section>

          <section style={{ marginBottom: '24px' }}>
            {recentPosts.length === 0 && (
              <button
                type="button"
                onClick={() => setIsWriteOpen((prev) => !prev)}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <span>Write what you think</span>
                <span aria-hidden="true" style={{ fontSize: '16px' }}>{isWriteOpen ? '−' : '+'}</span>
              </button>
            )}

            {(recentPosts.length > 0 || isWriteOpen) && (
              <div style={{ marginTop: recentPosts.length === 0 ? '10px' : '0' }}>
                {recentPosts.length > 0 && (
                  <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 600 }}>Write what you think</h3>
                )}
                <textarea
                  value={impression}
                  onChange={(event) => setImpression(event.target.value.slice(0, 1000))}
                  placeholder="Write your impression..."
                  style={{
                    width: '100%',
                    minHeight: '140px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    padding: '12px',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    resize: 'vertical'
                  }}
                />
                <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>{impression.length}/1000</div>
              </div>
            )}
          </section>

          <div
            style={{
              marginBottom: '24px',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '16px'
            }}
          >
            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600 }}>Pros</h3>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>
                Separate labels with commas. Up to 5 labels, max 3 words each.
              </div>
              <input
                value={prosInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setProsInput(value);
                  addTokenizedLabels(value, 'pros');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitRemaining(prosInput, 'pros');
                  }
                }}
                onBlur={() => commitRemaining(prosInput, 'pros')}
                disabled={pros.length >= 5}
                placeholder="great food, friendly people"
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  padding: '0 12px',
                  fontSize: '14px'
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {pros.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setPros((prev) => prev.filter((item) => item !== label))}
                    style={{
                      borderRadius: '999px',
                      border: '1px solid #86efac',
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      fontSize: '12px',
                      padding: '6px 10px',
                      cursor: 'pointer'
                    }}
                    title="Remove"
                  >
                    {label} ×
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600 }}>Cons</h3>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>
                Separate labels with commas. Up to 5 labels, max 3 words each.
              </div>
              <input
                value={consInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setConsInput(value);
                  addTokenizedLabels(value, 'cons');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitRemaining(consInput, 'cons');
                  }
                }}
                onBlur={() => commitRemaining(consInput, 'cons')}
                disabled={cons.length >= 5}
                placeholder="high prices, heavy traffic"
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  padding: '0 12px',
                  fontSize: '14px'
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {cons.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setCons((prev) => prev.filter((item) => item !== label))}
                    style={{
                      borderRadius: '999px',
                      border: '1px solid #fca5a5',
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      fontSize: '12px',
                      padding: '6px 10px',
                      cursor: 'pointer'
                    }}
                    title="Remove"
                  >
                    {label} ×
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section style={{ marginBottom: '24px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={beenThere}
                onChange={(event) => setBeenThere(event.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontSize: '14px' }}>I was here</span>
            </label>
          </section>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={{
                height: '40px',
                borderRadius: '999px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                padding: '0 16px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
