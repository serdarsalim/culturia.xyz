'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCountryFlag, getCountryName } from '@/lib/countries';
import { type CountryEntry } from '@/types';

interface CountryImpressionModalProps {
  countryCode: string;
  entries: CountryEntry[];
  authorNames: Record<string, string>;
  currentUserId: string | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onSaveEntry: (payload: {
    countryCode: string;
    content: string;
    pros: string[];
    cons: string[];
    beenThere: boolean;
  }) => Promise<boolean>;
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

export default function CountryImpressionModal({
  countryCode,
  entries,
  authorNames,
  currentUserId,
  onClose,
  onRequireAuth,
  onSaveEntry,
}: CountryImpressionModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [content, setContent] = useState('');
  const [isEntryMode, setIsEntryMode] = useState(false);
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [prosInput, setProsInput] = useState('');
  const [consInput, setConsInput] = useState('');
  const [beenThere, setBeenThere] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const countryName = getCountryName(countryCode);
  const flag = getCountryFlag(countryCode);

  const existingUserEntry = useMemo(
    () => (currentUserId ? entries.find((entry) => entry.user_id === currentUserId) || null : null),
    [entries, currentUserId]
  );

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [entries]
  );
  const topPros = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const label of entry.pros || []) {
        const key = normalizeLabel(label);
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6);
  }, [entries]);
  const topCons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const label of entry.cons || []) {
        const key = normalizeLabel(label);
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6);
  }, [entries]);

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
    if (!raw.includes(',')) return;

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

  function resetToExisting() {
    if (existingUserEntry) {
      setContent(existingUserEntry.content || '');
      setPros(existingUserEntry.pros || []);
      setCons(existingUserEntry.cons || []);
      setBeenThere(!!existingUserEntry.been_there);
    } else {
      setContent('');
      setPros([]);
      setCons([]);
      setBeenThere(false);
    }
    setProsInput('');
    setConsInput('');
    setFormError(null);
  }

  function handleToggleEntryMode() {
    if (!currentUserId) {
      onRequireAuth();
      return;
    }

    setIsEntryMode((prev) => {
      const next = !prev;
      resetToExisting();
      return next;
    });
  }

  async function handleSave() {
    if (!currentUserId) {
      onRequireAuth();
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setFormError('Entry cannot be empty.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const ok = await onSaveEntry({
      countryCode,
      content: trimmed,
      pros,
      cons,
      beenThere,
    });

    setIsSaving(false);
    if (ok) {
      setIsEntryMode(false);
    } else {
      setFormError('Could not save entry. Please try again.');
    }
  }

  const entryActionLabel = isEntryMode ? '(close entry)' : existingUserEntry ? '(edit entry)' : '(add entry)';
  function shouldTruncateEntry(text: string): boolean {
    if (!text) return false;
    const lines = text.split('\n').length;
    return text.length > 520 || lines > 8;
  }
  function toggleExpandedEntry(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function formatEntryDate(raw: string): string {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        backgroundColor: '#334155',
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
            paddingLeft: isMobile ? '24px' : '56px',
            paddingRight: isMobile ? '24px' : '56px',
            paddingBottom: isMobile ? '16px' : '28px',
            color: '#0f172a',
            fontFamily: "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif"
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontSize: isMobile ? '24px' : '30px',
                fontWeight: 700,
                lineHeight: 1.2,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ marginRight: '10px' }}>{flag}</span>
              {countryName}
              <button
                type="button"
                onClick={handleToggleEntryMode}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: 0,
                  cursor: 'pointer'
                }}
              >
                {entryActionLabel}
              </button>
            </div>
          </div>

          {!isEntryMode && (
            <section style={{ marginBottom: '24px' }}>
              {(topPros.length > 0 || topCons.length > 0) && (
                <div
                  style={{
                    marginBottom: '14px',
                    display: 'grid',
                    gap: '10px',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr'
                  }}
                >
                  {topPros.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: '#166534', fontWeight: 700 }}>Top Pros:</span>
                      {topPros.map(([label, count]) => (
                        <span
                          key={`top-pro-${label}`}
                          style={{
                            color: '#166534',
                            fontSize: '12px',
                          }}
                        >
                          {label} ({count})
                        </span>
                      ))}
                    </div>
                  )}
                  {topCons.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: 700 }}>Top Cons:</span>
                      {topCons.map(([label, count]) => (
                        <span
                          key={`top-con-${label}`}
                          style={{
                            color: '#991b1b',
                            fontSize: '12px',
                          }}
                        >
                          {label} ({count})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'grid', gap: isMobile ? '24px' : '34px' }}>
                {sortedEntries.length > 0 ? (
                  sortedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: 0,
                        color: '#0f172a',
                        lineHeight: 1.45,
                        fontSize: '14px',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      <div style={{ width: '100%', maxWidth: '650px' }}>
                        <div
                          style={{
                            maxHeight: expandedEntries.has(entry.id) ? 'none' : '240px',
                            overflow: expandedEntries.has(entry.id) ? 'visible' : 'hidden'
                          }}
                        >
                          {entry.content}
                        </div>
                        {shouldTruncateEntry(entry.content) && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedEntry(entry.id)}
                            style={{
                              marginTop: '8px',
                              border: 'none',
                              background: 'transparent',
                              color: '#475569',
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: 0,
                              cursor: 'pointer'
                            }}
                          >
                            {expandedEntries.has(entry.id) ? 'Show less' : 'Read more'}
                          </button>
                        )}
                        {(entry.pros?.length > 0 || entry.cons?.length > 0) && (
                          <div
                            style={{
                              marginTop: '12px',
                              display: 'grid',
                              gap: '8px',
                              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr'
                            }}
                          >
                            <div style={{ minHeight: '20px' }}>
                              {entry.pros?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', color: '#166534', fontWeight: 700 }}>Pros:</span>
                                  {entry.pros.map((label) => (
                                    <span
                                      key={`${entry.id}-pro-${label}`}
                                      style={{
                                        color: '#166534',
                                        fontSize: '11px',
                                      }}
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ minHeight: '20px' }}>
                              {entry.cons?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: 700 }}>Cons:</span>
                                  {entry.cons.map((label) => (
                                    <span
                                      key={`${entry.id}-con-${label}`}
                                      style={{
                                        color: '#991b1b',
                                        fontSize: '11px',
                                      }}
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            marginTop: '14px',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            color: '#94a3b8',
                            fontSize: '12px',
                            whiteSpace: 'normal'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span style={{ color: '#64748b' }}>{authorNames[entry.user_id] || `user-${entry.user_id.slice(0, 6)}`}</span>
                            <span>{formatEntryDate(entry.updated_at || entry.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '14px' }}>No entries yet. Be the first to add one.</div>
                )}
              </div>
            </section>
          )}

          <section style={{ marginBottom: '24px' }}>
            {isEntryMode && (
              <div>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value.slice(0, 1000))}
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
                <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>{content.length}/1000</div>

                <div
                  style={{
                    marginTop: '16px',
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

                <section style={{ marginTop: '16px' }}>
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

                {formError && (
                  <div style={{ marginTop: '10px', color: '#b91c1c', fontSize: '13px' }}>{formError}</div>
                )}

                <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleToggleEntryMode}
                    style={{
                      height: '40px',
                      borderRadius: '999px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      padding: '0 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    style={{
                      height: '40px',
                      borderRadius: '999px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      padding: '0 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: isSaving ? 0.65 : 1
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save post'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
