'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCountryFlag, getCountryName } from '@/lib/countries';
import { type CountryEntry } from '@/types';

interface CountryImpressionModalProps {
  countryCode: string;
  entries: CountryEntry[];
  authorNames: Record<string, string>;
  favoriteEntryIds: Set<string>;
  currentUserId: string | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onSaveEntry: (payload: {
    countryCode: string;
    content: string;
    pros: string[];
    cons: string[];
    beenThere: boolean;
    livedThere: boolean;
  }) => Promise<boolean>;
  onDeleteEntry: (entryId: string) => Promise<boolean>;
  onToggleFavorite: (entryId: string) => Promise<boolean>;
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

interface EntryDraft {
  content: string;
  pros: string[];
  cons: string[];
  prosInput: string;
  consInput: string;
  beenThere: boolean;
  livedThere: boolean;
}

export default function CountryImpressionModal({
  countryCode,
  entries,
  authorNames,
  favoriteEntryIds,
  currentUserId,
  onClose,
  onRequireAuth,
  onSaveEntry,
  onDeleteEntry,
  onToggleFavorite,
}: CountryImpressionModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [content, setContent] = useState('');
  const [isEntryMode, setIsEntryMode] = useState(entries.length === 0);
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [prosInput, setProsInput] = useState('');
  const [consInput, setConsInput] = useState('');
  const [beenThere, setBeenThere] = useState(false);
  const [livedThere, setLivedThere] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [entryOverflowMap, setEntryOverflowMap] = useState<Record<string, boolean>>({});
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastSavedSnapshotRef = useRef('');

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
  const draftStorageKey = useMemo(
    () => `country-entry-draft:${currentUserId ?? 'guest'}:${countryCode}`,
    [currentUserId, countryCode]
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
      setLivedThere(!!existingUserEntry.lived_there);
    } else {
      setContent('');
      setPros([]);
      setCons([]);
      setBeenThere(false);
      setLivedThere(false);
    }
    setProsInput('');
    setConsInput('');
    setFormError(null);
  }

  function applyDraft(draft: EntryDraft) {
    setContent(draft.content || '');
    setPros((draft.pros || []).slice(0, 5));
    setCons((draft.cons || []).slice(0, 5));
    setProsInput(draft.prosInput || '');
    setConsInput(draft.consInput || '');
    setBeenThere(!!draft.beenThere);
    setLivedThere(!!draft.livedThere);
    setFormError(null);
  }

  function loadDraftFromStorage(): EntryDraft | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as EntryDraft;
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function isMeaningfulDraft(draft: EntryDraft): boolean {
    return Boolean(
      draft.content?.trim() ||
      draft.prosInput?.trim() ||
      draft.consInput?.trim() ||
      (draft.pros && draft.pros.length > 0) ||
      (draft.cons && draft.cons.length > 0) ||
      draft.beenThere ||
      draft.livedThere
    );
  }

  function hydrateEntryForm() {
    const draft = loadDraftFromStorage();
    if (draft && isMeaningfulDraft(draft)) {
      applyDraft(draft);
      return;
    }
    resetToExisting();
  }

  async function persistEntryIfNeeded(): Promise<boolean> {
    if (!isEntryMode || !currentUserId) return true;

    const trimmed = content.trim();
    const hasPersistableData =
      Boolean(trimmed) ||
      pros.length > 0 ||
      cons.length > 0 ||
      beenThere ||
      livedThere;
    if (!hasPersistableData) return true;

    const snapshot = JSON.stringify({
      content: trimmed,
      pros,
      cons,
      beenThere,
      livedThere,
    });

    if (snapshot === lastSavedSnapshotRef.current) return true;

    setIsSaving(true);
    setFormError(null);
    const ok = await onSaveEntry({
      countryCode,
      content: trimmed,
      pros,
      cons,
      beenThere,
      livedThere,
    });
    setIsSaving(false);

    if (ok) {
      lastSavedSnapshotRef.current = snapshot;
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftStorageKey);
      }
      return true;
    }

    setFormError('Could not save post. Please try again.');
    return false;
  }

  async function handleRequestClose() {
    const ok = await persistEntryIfNeeded();
    if (!ok) return;
    onClose();
  }

  async function handleToggleEntryMode() {
    if (!isEntryMode && !currentUserId) {
      onRequireAuth();
      return;
    }

    if (isEntryMode) {
      const ok = await persistEntryIfNeeded();
      if (!ok) return;
      setIsEntryMode(false);
      return;
    }

    hydrateEntryForm();
    setIsEntryMode(true);
  }

  async function handleDelete() {
    if (!existingUserEntry) return;
    setIsDeleting(true);
    setFormError(null);

    const ok = await onDeleteEntry(existingUserEntry.id);
    setIsDeleting(false);

    if (ok) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftStorageKey);
      }
      setIsEntryMode(false);
    } else {
      setFormError('Could not delete post. Please try again.');
    }
  }

  async function handleToggleFavorite(entryId: string) {
    setFavoriteBusyId(entryId);
    await onToggleFavorite(entryId);
    setFavoriteBusyId(null);
  }

  const entryActionLabel = isEntryMode ? '(edit complete)' : existingUserEntry ? '(edit post)' : '(add post)';
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

  useEffect(() => {
    setEntryOverflowMap((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const entry of sortedEntries) {
        if (expandedEntries.has(entry.id)) continue;
        const el = contentRefs.current[entry.id];
        if (!el) continue;
        const isOverflowing = el.scrollHeight > 240 + 1;
        if (next[entry.id] !== isOverflowing) {
          next[entry.id] = isOverflowing;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [sortedEntries, expandedEntries]);

  useEffect(() => {
    const savedSnapshot = JSON.stringify({
      content: existingUserEntry?.content?.trim() || '',
      pros: existingUserEntry?.pros || [],
      cons: existingUserEntry?.cons || [],
      beenThere: !!existingUserEntry?.been_there,
      livedThere: !!existingUserEntry?.lived_there,
    });
    lastSavedSnapshotRef.current = savedSnapshot;
  }, [existingUserEntry?.id, existingUserEntry?.updated_at, existingUserEntry?.content, existingUserEntry?.been_there, existingUserEntry?.lived_there, existingUserEntry?.pros, existingUserEntry?.cons]);

  useEffect(() => {
    if (!isEntryMode) return;
    hydrateEntryForm();
  }, [isEntryMode, countryCode, existingUserEntry?.id, draftStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draft: EntryDraft = {
      content,
      pros,
      cons,
      prosInput,
      consInput,
      beenThere,
      livedThere,
    };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Ignore localStorage write errors (quota/private mode).
    }
  }, [draftStorageKey, content, pros, cons, prosInput, consInput, beenThere, livedThere]);

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
      onClick={handleRequestClose}
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
          onClick={handleRequestClose}
          aria-label="Close"
          title="Close"
          style={{
            position: 'absolute',
            top: isMobile ? 'max(env(safe-area-inset-top, 0px) + 12px, 48px)' : '12px',
            right: isMobile ? 'max(env(safe-area-inset-right, 0px) + 12px, 16px)' : '12px',
            width: isMobile ? '44px' : '40px',
            height: isMobile ? '44px' : '40px',
            borderRadius: '9999px',
            backgroundColor: isMobile ? '#f8fafc' : 'transparent',
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
          className="country-modal-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarGutter: 'stable',
            paddingTop: isMobile ? '64px' : '56px',
            paddingLeft: isMobile ? '24px' : '120px',
            paddingRight: isMobile ? '24px' : '120px',
            paddingBottom: isMobile ? '16px' : '28px',
            color: '#0f172a',
            fontFamily: "'Manrope', 'Avenir Next', 'Segoe UI', sans-serif"
          }}
        >
          <div style={{ marginBottom: '24px', maxWidth: '650px', width: '100%' }}>
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
            <section style={{ marginBottom: '24px', maxWidth: '650px', width: '100%' }}>
              {sortedEntries.length >= 5 && (topPros.length > 0 || topCons.length > 0) && (
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
                      <span style={{ color: '#166534', fontSize: '12px' }}>
                        {topPros.map(([label, count]) => `${label} (${count})`).join(', ')}
                      </span>
                    </div>
                  )}
                  {topCons.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: 700 }}>Top Cons:</span>
                      <span style={{ color: '#991b1b', fontSize: '12px' }}>
                        {topCons.map(([label, count]) => `${label} (${count})`).join(', ')}
                      </span>
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
                        lineHeight: '24px',
                        fontSize: '16px',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      <div style={{ width: '100%', maxWidth: '650px' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(entry.id)}
                            disabled={favoriteBusyId === entry.id}
                            title={favoriteEntryIds.has(entry.id) ? 'Remove from favorites' : 'Add to favorites'}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: favoriteEntryIds.has(entry.id) ? '#e11d48' : '#64748b',
                              fontSize: '18px',
                              lineHeight: 1,
                              cursor: 'pointer',
                              padding: 0,
                              opacity: favoriteBusyId === entry.id ? 0.6 : 1
                            }}
                          >
                            {favoriteEntryIds.has(entry.id) ? '♥' : '♡'}
                          </button>
                        </div>
                        <div
                          ref={(el) => {
                            contentRefs.current[entry.id] = el;
                          }}
                          style={{
                            overflow: expandedEntries.has(entry.id) ? 'visible' : 'hidden',
                            maxHeight: expandedEntries.has(entry.id) ? 'none' : '240px'
                          }}
                        >
                          {entry.content}
                        </div>
                        {(entryOverflowMap[entry.id] || expandedEntries.has(entry.id)) && (
                          <button
                            type="button"
                            onClick={() => toggleExpandedEntry(entry.id)}
                            style={{
                              marginTop: '8px',
                              border: 'none',
                              background: 'transparent',
                              color: '#475569',
                              fontSize: '13px',
                              fontWeight: 600,
                              padding: 0,
                              cursor: 'pointer'
                            }}
                          >
                            {expandedEntries.has(entry.id) ? 'Show less' : 'Read more...'}
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
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Pros:</span>
                                  <span style={{ color: '#0f172a', fontSize: '12px' }}>{entry.pros.join(', ')}</span>
                                </div>
                              )}
                            </div>
                            <div style={{ minHeight: '20px' }}>
                              {entry.cons?.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 700 }}>Cons:</span>
                                  <span style={{ color: '#0f172a', fontSize: '12px' }}>{entry.cons.join(', ')}</span>
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
                            <span style={{ color: '#334155' }}>
                              {authorNames[entry.user_id] || `user-${entry.user_id.slice(0, 6)}`}
                              {entry.lived_there
                                ? ` | Lived in ${countryName}`
                                : entry.been_there
                                  ? ` | Visited ${countryName}`
                                  : ''}
                            </span>
                            <span>{formatEntryDate(entry.updated_at || entry.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '14px' }}>No posts yet. Be the first to add one.</div>
                )}
              </div>
            </section>
          )}

          <section style={{ marginBottom: '24px' }}>
            {isEntryMode && (
              <div>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value.slice(0, 2000))}
                  placeholder="Write your impression..."
                  style={{
                    width: '100%',
                    minHeight: '140px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    padding: '12px',
                    fontSize: isMobile ? '16px' : '14px',
                    lineHeight: 1.5,
                    resize: 'vertical'
                  }}
                />
                <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>{content.length}/2000</div>

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
                      className="entry-label-input"
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
                        fontSize: isMobile ? '16px' : '14px'
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
                      className="entry-label-input"
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
                        fontSize: isMobile ? '16px' : '14px'
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 20px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={beenThere}
                        onChange={(event) => setBeenThere(event.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '14px' }}>I was there</span>
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={livedThere}
                        onChange={(event) => setLivedThere(event.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '14px' }}>I lived there</span>
                    </label>
                  </div>
                </section>

                {formError && (
                  <div style={{ marginTop: '10px', color: '#b91c1c', fontSize: '13px' }}>{formError}</div>
                )}

                <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
                  {existingUserEntry && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      style={{
                        height: '40px',
                        borderRadius: '999px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#ffffff',
                        color: '#b91c1c',
                        padding: '0 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginRight: '8px',
                        opacity: isDeleting ? 0.6 : 1
                      }}
                      disabled={isSaving || isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
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
                    disabled={isSaving || isDeleting}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
        <style jsx>{`
          .entry-label-input::placeholder {
            color: #94a3b8;
          }
          .country-modal-scroll {
            scrollbar-width: thin;
            scrollbar-color: #94a3b8 #e2e8f0;
          }
          .country-modal-scroll::-webkit-scrollbar {
            width: 10px;
          }
          .country-modal-scroll::-webkit-scrollbar-track {
            background: #e2e8f0;
            border-radius: 9999px;
          }
          .country-modal-scroll::-webkit-scrollbar-thumb {
            background: #94a3b8;
            border-radius: 9999px;
            border: 2px solid #e2e8f0;
          }
          .country-modal-scroll::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
        `}</style>
      </div>
    </div>
  );
}
