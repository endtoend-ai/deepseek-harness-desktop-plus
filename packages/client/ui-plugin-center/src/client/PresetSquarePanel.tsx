/** Preset Square browser and local roster management for the independent page. */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  IconCloseOutline16, IconRefreshOutline16, IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  PresetArchiveWarning,
  PresetInstallPreviewRequest,
  PresetInstallPreviewResult,
  PresetInstallRequest,
  PresetInstallResult,
  PresetSquareDetailQuery,
  PresetSquareDetailResult,
  PresetSquareItem,
  PresetSquareListQuery,
  PresetSquareListResult,
  PresetSquareSort,
} from '@deepseek-ai/dsh-plugin-center-contracts'
import type { PluginCenterLocaleKey } from './locales.ts'
import css from './PresetSquarePanel.module.css'

/** Renderer-safe projection of one Host-owned Preset roster entry. */
export interface LocalPresetEntry {
  readonly id: string
  readonly trust: 'system' | 'user'
  readonly isDefault: boolean
  readonly name?: string
  readonly description?: string
  readonly broken?: string
}

/** Renderer-safe projection of the Host's live Preset roster. */
export interface LocalPresetRoster {
  readonly presets: readonly LocalPresetEntry[]
  readonly authorable: boolean
}

/** Shared Preset operations injected by the client plugin. */
export interface PresetSquareInjected {
  readonly presetAvailable: boolean
  readonly presetDevelopment: boolean
  readonly presetMutationsEnabled: boolean
  readonly listPresetSquare: (query: PresetSquareListQuery) => Promise<PresetSquareListResult>
  readonly detailPresetSquare: (query: PresetSquareDetailQuery) => Promise<PresetSquareDetailResult>
  readonly previewPresetInstall: (request: PresetInstallPreviewRequest) => Promise<PresetInstallPreviewResult>
  readonly installPreset: (request: PresetInstallRequest) => Promise<PresetInstallResult>
  readonly listLocalPresets: () => Promise<LocalPresetRoster>
  readonly removeLocalPreset: (id: string) => Promise<void>
  readonly useLocalPreset: (id: string) => Promise<'opened' | 'workspace-needed'>
}

interface PresetSquarePanelProps extends PresetSquareInjected {
  readonly t: (key: PluginCenterLocaleKey) => string
}

type PresetView = 'square' | 'installed'

type RemoteState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly result: PresetSquareListResult }

type LocalState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly result: LocalPresetRoster }

type DetailState =
  | { readonly status: 'loading'; readonly fallback: PresetSquareItem }
  | { readonly status: 'error'; readonly fallback: PresetSquareItem }
  | { readonly status: 'ready'; readonly item: PresetSquareItem }

type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly value: PresetInstallPreviewResult }

const WARNING_KEYS = {
  'absolute-paths': 'presetWarningAbsolute',
  'possible-secrets': 'presetWarningSecrets',
  'version-mismatch': 'presetWarningVersion',
} as const satisfies Record<PresetArchiveWarning, PluginCenterLocaleKey>

function matches(item: PresetSquareItem, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return true
  return [item.title, item.description, item.presetId, item.publisher.username]
    .some(value => value.toLocaleLowerCase().includes(needle))
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`
  return `${(value / 1_048_576).toFixed(1)} MB`
}

function PresetArtwork({ item, compact = false }: {
  readonly item: PresetSquareItem
  readonly compact?: boolean
}): ReactNode {
  return (
    <span
      className={`${css.artwork}${compact ? ` ${css.artworkCompact}` : ''}`}
      data-variant={String(item.visualVariant % 6)}
      aria-hidden="true"
    >
      <span>{item.title.slice(0, 1).toLocaleUpperCase()}</span>
    </span>
  )
}

/** Shared first-party UI over the fixed-origin Preset Square and Host roster. */
export function PresetSquarePanel({
  presetAvailable,
  presetDevelopment,
  presetMutationsEnabled,
  listPresetSquare,
  detailPresetSquare,
  previewPresetInstall,
  installPreset,
  listLocalPresets,
  removeLocalPreset,
  useLocalPreset,
  t,
}: PresetSquarePanelProps): ReactNode {
  const [view, setView] = useState<PresetView>('square')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<PresetSquareSort>('downloads')
  const [remoteRevision, setRemoteRevision] = useState(0)
  const [localRevision, setLocalRevision] = useState(0)
  const [remote, setRemote] = useState<RemoteState>({ status: 'loading' })
  const [local, setLocal] = useState<LocalState>({ status: 'loading' })
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [targetId, setTargetId] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<LocalPresetEntry | null>(null)
  const [removing, setRemoving] = useState(false)
  const [feedback, setFeedback] = useState<PluginCenterLocaleKey | null>(null)

  useEffect(() => {
    if (!presetAvailable) return
    let current = true
    setRemote({ status: 'loading' })
    void Promise.resolve().then(() => listPresetSquare({ query: '', sort })).then(
      (result) => { if (current) setRemote({ status: 'ready', result }) },
      () => { if (current) setRemote({ status: 'error' }) },
    )
    return () => { current = false }
  }, [listPresetSquare, presetAvailable, remoteRevision, sort])

  useEffect(() => {
    if (!presetAvailable) return
    let current = true
    setLocal({ status: 'loading' })
    void Promise.resolve().then(listLocalPresets).then(
      (result) => { if (current) setLocal({ status: 'ready', result }) },
      () => { if (current) setLocal({ status: 'error' }) },
    )
    return () => { current = false }
  }, [listLocalPresets, localRevision, presetAvailable])

  const visible = useMemo(() => remote.status === 'ready'
    ? remote.result.items.filter(item => matches(item, query))
    : [], [query, remote])
  const officialVisible = useMemo(() => visible.filter(item => item.source === 'fufan-official'), [visible])
  const communityVisible = useMemo(() => visible.filter(item => item.source === 'community'), [visible])

  const localById = useMemo(() => new Map(local.status === 'ready'
    ? local.result.presets.map(item => [item.id, item] as const)
    : []), [local])

  const closeDetail = (): void => {
    if (installing) return
    setDetail(null)
    setPreview({ status: 'idle' })
    setTargetId('')
    setAcknowledged(false)
  }

  const openDetail = (item: PresetSquareItem): void => {
    setDetail({ status: 'loading', fallback: item })
    setPreview({ status: 'idle' })
    setTargetId(item.presetId)
    setAcknowledged(false)
    void detailPresetSquare({ slug: item.slug }).then(
      (result) => {
        if (result.item === null) setDetail({ status: 'error', fallback: item })
        else setDetail({ status: 'ready', item: result.item })
      },
      () => { setDetail({ status: 'error', fallback: item }) },
    )
  }

  const startPreview = (item: PresetSquareItem, requestedTarget: string | null = null): void => {
    if (!presetMutationsEnabled) {
      setFeedback('presetDesktopOnly')
      return
    }
    if (detail === null) openDetail(item)
    setPreview({ status: 'loading' })
    setAcknowledged(false)
    void previewPresetInstall({ slug: item.slug, targetId: requestedTarget }).then(
      (value) => {
        setTargetId(value.targetId)
        setPreview({ status: 'ready', value })
      },
      () => { setPreview({ status: 'error' }) },
    )
  }

  const selectedItem = detail === null
    ? null
    : detail.status === 'ready' ? detail.item : detail.fallback

  const confirmInstall = (): void => {
    if (selectedItem === null || installing || !acknowledged || targetId.trim() === '') return
    setInstalling(true)
    setFeedback(null)
    void previewPresetInstall({ slug: selectedItem.slug, targetId: targetId.trim() }).then(
      (checked) => {
        setPreview({ status: 'ready', value: checked })
        setTargetId(checked.targetId)
        if (checked.conflict) throw new Error('preset id conflict')
        return installPreset({ slug: selectedItem.slug, targetId: checked.targetId })
      },
    ).then(
      () => {
        setFeedback('presetInstallSuccess')
        setLocalRevision(value => value + 1)
        setDetail(null)
        setPreview({ status: 'idle' })
        setTargetId('')
        setAcknowledged(false)
      },
      () => { setFeedback('presetInstallFailed') },
    ).finally(() => { setInstalling(false) })
  }

  const confirmRemove = (): void => {
    if (removeTarget === null || removing) return
    setRemoving(true)
    setFeedback(null)
    void removeLocalPreset(removeTarget.id).then(
      () => {
        setRemoveTarget(null)
        setLocalRevision(value => value + 1)
      },
      () => { setFeedback('presetRemoveFailed') },
    ).finally(() => { setRemoving(false) })
  }

  const usePreset = (id: string): void => {
    setFeedback(null)
    void useLocalPreset(id).then(
      (result) => {
        if (result === 'workspace-needed') setFeedback('presetWorkspaceNeeded')
      },
      () => { setFeedback('presetUseFailed') },
    )
  }

  const renderCards = (items: readonly PresetSquareItem[]): ReactNode => (
    <div className={css.grid}>
      {items.map((item) => {
        const installed = localById.get(item.presetId)
        return (
          <article key={item.slug} className={css.card} data-source={item.source}>
            <PresetArtwork item={item} />
            <div className={css.cardCopy}>
              <div className={css.cardTitle}>
                <strong>{item.title}</strong>
                {item.source === 'fufan-official' ? <span>{t('presetFufanOfficialBadge')}</span> : null}
              </div>
              <p>{item.description}</p>
              <span>{item.source === 'fufan-official'
                ? t('presetFufanOfficialPackage')
                : `@${item.publisher.username} · ${item.downloadCount.toLocaleString()} ${t('presetDownloads')}`}</span>
            </div>
            <div className={css.cardActions}>
              <button type="button" onClick={() => { openDetail(item) }}>{t('details')}</button>
              {installed === undefined ? (
                <button
                  type="button"
                  className={css.primary}
                  disabled={!presetMutationsEnabled}
                  onClick={() => { startPreview(item) }}
                >
                  {t('install')}
                </button>
              ) : (
                <button
                  type="button"
                  className={css.primary}
                  disabled={!presetMutationsEnabled || installed.broken !== undefined}
                  onClick={() => { usePreset(installed.id) }}
                >
                  {t('presetUse')}
                </button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )

  if (!presetAvailable) {
    return <div className={css.unavailable}><p>{t('presetDesktopOnly')}</p></div>
  }

  return (
    <div
      className={css.root}
      data-development={presetDevelopment || undefined}
      aria-busy={remote.status === 'loading' || local.status === 'loading' || installing || removing}
    >
      <div className={css.scroller}>
        <main className={css.content}>
          <header className={css.header}>
            <div>
              <h1>{t('presetTitle')}</h1>
              <p>{t('presetIntro')}</p>
            </div>
            <button
              type="button"
              className={css.refresh}
              aria-label={t('refresh')}
              title={t('refresh')}
              onClick={() => {
                setRemoteRevision(value => value + 1)
                setLocalRevision(value => value + 1)
              }}
            >
              <IconRefreshOutline16 size={16} />
            </button>
          </header>

          <div className={css.viewTabs} role="tablist" aria-label={t('presetTitle')}>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'square'}
              data-active={view === 'square' || undefined}
              onClick={() => { setView('square') }}
            >
              <span>{t('presetBrowseTab')}</span>
              {remote.status === 'ready' ? <em>{remote.result.total}</em> : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'installed'}
              data-active={view === 'installed' || undefined}
              onClick={() => { setView('installed') }}
            >
              <span>{t('presetInstalledTab')}</span>
              {local.status === 'ready' ? <em>{local.result.presets.length}</em> : null}
            </button>
          </div>

          {feedback === null ? null : <p className={css.feedback} role="status">{t(feedback)}</p>}
          {!presetMutationsEnabled ? <p className={css.desktopNote}>{t('presetDesktopOnly')}</p> : null}

          {view === 'square' ? <label className={css.search}>
            <IconSearchOutline16 aria-hidden="true" />
            <span className={css.visuallyHidden}>{t('presetSearch')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('presetSearch')}
              aria-label={t('presetSearch')}
              onChange={(event) => { setQuery(event.currentTarget.value) }}
            />
          </label> : null}

          {view === 'installed' ? <section className={css.section} aria-labelledby="local-presets-heading">
            <div className={css.sectionHeading}>
              <h2 id="local-presets-heading">{t('presetInstalledTitle')}</h2>
              {local.status === 'error' ? (
                <button type="button" onClick={() => { setLocalRevision(value => value + 1) }}>{t('retry')}</button>
              ) : null}
            </div>
            {local.status === 'loading' ? <div className={css.localSkeleton} /> : null}
            {local.status === 'error' ? <p className={css.status} role="alert">{t('presetLocalError')}</p> : null}
            {local.status === 'ready' ? (
              <div className={css.localList}>
                {local.result.presets.length === 0 ? <p className={css.status}>{t('presetInstalledEmpty')}</p> : null}
                {local.result.presets.map(item => (
                  <article key={item.id} className={css.localItem} data-broken={item.broken === undefined ? undefined : true}>
                    <span className={css.localMark} aria-hidden="true">{(item.name ?? item.id).slice(0, 1).toLocaleUpperCase()}</span>
                    <div className={css.localCopy}>
                      <strong>{item.name ?? item.id}</strong>
                      <span>{item.description ?? item.id}</span>
                      {item.broken === undefined ? null : <em title={item.broken}>{t('presetBroken')}</em>}
                    </div>
                    <span className={css.trust} data-trust={item.trust}>{t(item.trust === 'system' ? 'presetSystem' : 'presetUser')}</span>
                    <div className={css.localActions}>
                      <button
                        type="button"
                        disabled={!presetMutationsEnabled || item.broken !== undefined}
                        onClick={() => { usePreset(item.id) }}
                      >
                        {t('presetUse')}
                      </button>
                      {item.trust === 'user' ? (
                        <button
                          type="button"
                          className={css.danger}
                          disabled={!presetMutationsEnabled}
                          onClick={() => { setRemoveTarget(item) }}
                        >
                          {t('presetRemove')}
                        </button>
                      ) : <span className={css.protected}>{t('presetProtected')}</span>}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section> : null}

          {view === 'square' ? <section className={css.section} aria-labelledby="square-presets-heading">
            <div className={css.sectionHeading}>
              <h2 id="square-presets-heading">{t('presetSquareTitle')}</h2>
              <div className={css.sort} aria-label={t('presetSquareTitle')}>
                {(['downloads', 'newest'] as const).map(value => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={sort === value}
                    onClick={() => { setSort(value) }}
                  >
                    {t(value === 'downloads' ? 'presetSortDownloads' : 'presetSortNewest')}
                  </button>
                ))}
              </div>
            </div>
            {remote.status === 'loading' ? (
              <div className={css.grid} role="status" aria-label={t('presetLoading')}>
                {[0, 1, 2, 3].map(value => <span key={value} className={css.cardSkeleton} />)}
              </div>
            ) : null}
            {remote.status === 'error' ? (
              <div className={css.failure} role="alert">
                <span>{t('presetError')}</span>
                <button type="button" onClick={() => { setRemoteRevision(value => value + 1) }}>{t('retry')}</button>
              </div>
            ) : null}
            {remote.status === 'ready' && visible.length === 0 ? <p className={css.status}>{t('presetEmpty')}</p> : null}
            {remote.status === 'ready' && visible.length > 0 ? (
              <div className={css.sourceGroups}>
                {officialVisible.length === 0 ? null : (
                  <section className={css.sourceGroup} aria-labelledby="fufan-official-presets">
                    <div className={css.sourceHeading}>
                      <div>
                        <h3 id="fufan-official-presets">{t('presetFufanOfficialTitle')}</h3>
                        <p>{t('presetFufanOfficialHint')}</p>
                      </div>
                      <span>{officialVisible.length}</span>
                    </div>
                    {renderCards(officialVisible)}
                  </section>
                )}
                {communityVisible.length === 0 ? null : (
                  <section className={css.sourceGroup} aria-labelledby="community-presets">
                    <div className={css.sourceHeading}>
                      <div>
                        <h3 id="community-presets">{t('presetCommunityTitle')}</h3>
                        <p>{t('presetCommunityHint')}</p>
                      </div>
                      <span>{communityVisible.length}</span>
                    </div>
                    {renderCards(communityVisible)}
                  </section>
                )}
              </div>
            ) : null}
          </section> : null}
        </main>
      </div>

      {detail === null || selectedItem === null ? null : (
        <div className={css.overlay} role="presentation">
          <section className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="preset-detail-title">
            <header className={css.dialogHeader}>
              <PresetArtwork item={selectedItem} compact />
              <div>
                <span>{t('presetDetails')}</span>
                <h2 id="preset-detail-title">{selectedItem.title}</h2>
              </div>
              <button type="button" aria-label={t('close')} onClick={closeDetail}><IconCloseOutline16 size={16} /></button>
            </header>
            <div className={css.dialogBody}>
              {detail.status === 'loading' ? <p className={css.status}>{t('detailLoading')}</p> : null}
              {detail.status === 'error' ? <p className={css.failureText}>{t('detailError')}</p> : null}
              <p className={css.description}>{selectedItem.description}</p>
              {selectedItem.source === 'fufan-official' ? (
                <div className={css.officialNotice}>
                  <strong>{t('presetFufanOfficialBadge')}</strong>
                  <p>{t('presetFufanOfficialDisclaimer')}</p>
                </div>
              ) : null}
              <dl className={css.metadata}>
                <div><dt>{t('publisher')}</dt><dd>@{selectedItem.publisher.username}</dd></div>
                <div><dt>{t('presetId')}</dt><dd><code>{selectedItem.presetId}</code></dd></div>
                <div><dt>{t('presetDownloads')}</dt><dd>{selectedItem.downloadCount.toLocaleString()}</dd></div>
                <div><dt>{t('presetCreated')}</dt><dd>{new Date(selectedItem.createdAt).toLocaleDateString()}</dd></div>
                <div><dt>{t('presetPackageSize')}</dt><dd>{formatBytes(selectedItem.artifact.sizeBytes)}</dd></div>
                <div><dt>{t('presetSourceVersion')}</dt><dd>{selectedItem.artifact.sourceDshVersion}</dd></div>
              </dl>
              <div className={css.securityNotice}>
                <strong>{t('presetSecurityTitle')}</strong>
                <p>{t('presetSecurityWarning')}</p>
              </div>

              {preview.status === 'idle' ? (
                <button
                  type="button"
                  className={css.primaryWide}
                  disabled={!presetMutationsEnabled}
                  onClick={() => { startPreview(selectedItem) }}
                >
                  {t('presetPreview')}
                </button>
              ) : null}
              {preview.status === 'loading' ? <p className={css.status}>{t('presetPreviewing')}</p> : null}
              {preview.status === 'error' ? (
                <div className={css.failure} role="alert">
                  <span>{t('presetInstallFailed')}</span>
                  <button type="button" onClick={() => { startPreview(selectedItem, targetId || null) }}>{t('retry')}</button>
                </div>
              ) : null}
              {preview.status === 'ready' ? (
                <div className={css.preview}>
                  <label>
                    <span>{t('presetTargetId')}</span>
                    <input
                      type="text"
                      value={targetId}
                      disabled={installing}
                      onChange={(event) => {
                        setTargetId(event.currentTarget.value)
                        setAcknowledged(false)
                      }}
                    />
                  </label>
                  <div className={css.previewFacts}>
                    <span>{t('presetFiles')}: {preview.value.fileCount}</span>
                    <span>{formatBytes(selectedItem.artifact.sizeBytes)}</span>
                  </div>
                  {preview.value.warnings.length === 0 ? null : (
                    <ul className={css.warnings}>
                      {preview.value.warnings.map(warning => <li key={warning}>{t(WARNING_KEYS[warning])}</li>)}
                    </ul>
                  )}
                  {preview.value.conflict ? <p className={css.conflict} role="alert">{t('presetConflict')}</p> : null}
                  {targetId !== preview.value.targetId ? (
                    <button
                      type="button"
                      className={css.secondaryWide}
                      disabled={installing || targetId.trim() === ''}
                      onClick={() => { startPreview(selectedItem, targetId.trim()) }}
                    >
                      {t('presetPreview')}
                    </button>
                  ) : null}
                  <label className={css.acknowledge}>
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      disabled={installing || preview.value.conflict || targetId !== preview.value.targetId}
                      onChange={(event) => { setAcknowledged(event.currentTarget.checked) }}
                    />
                    <span>{t('presetTrustAcknowledge')}</span>
                  </label>
                  <button
                    type="button"
                    className={css.primaryWide}
                    disabled={installing || !acknowledged || preview.value.conflict || targetId !== preview.value.targetId}
                    onClick={confirmInstall}
                  >
                    {installing ? t('presetInstalling') : t('confirmInstall')}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {removeTarget === null ? null : (
        <div className={css.overlay} role="presentation">
          <section className={`${css.dialog} ${css.confirmDialog}`} role="dialog" aria-modal="true" aria-labelledby="preset-remove-title">
            <header className={css.dialogHeader}>
              <div>
                <span>{t('presetRemoveTitle')}</span>
                <h2 id="preset-remove-title">{removeTarget.name ?? removeTarget.id}</h2>
              </div>
              <button type="button" aria-label={t('close')} disabled={removing} onClick={() => { setRemoveTarget(null) }}>
                <IconCloseOutline16 size={16} />
              </button>
            </header>
            <div className={css.dialogBody}>
              <p className={css.description}>{t('presetRemoveWarning')}</p>
              <div className={css.confirmActions}>
                <button type="button" disabled={removing} onClick={() => { setRemoveTarget(null) }}>{t('cancel')}</button>
                <button type="button" className={css.dangerSolid} disabled={removing} onClick={confirmRemove}>
                  {removing ? t('presetRemoving') : t('presetRemove')}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
