/** Browser launcher for the standalone FF - LLM Wiki application. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './Plugin.module.css'

const NS = 'ffLlmWiki'
const OPEN_PATH = '/api/ff-llm-wiki/open'
const SIDEBAR_VISIBILITY_KEY = 'ff-llm-wiki:sidebar-visible'
const SIDEBAR_VISIBILITY_EVENT = 'ff-llm-wiki:sidebar-visibility'
const SIDEBAR_HIDDEN_ATTRIBUTE = 'data-ff-llm-wiki-sidebar-hidden'

type WikiLocaleKey = 'nav' | 'openFailed' | 'openHint'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    ffLlmWiki: WikiLocaleKey
  }
}

type NavProps = PropsRuntime<'sidebar.primary.action'> & PropsLocale<'ffLlmWiki'>

function sidebarVisible(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_VISIBILITY_KEY) !== 'false'
  } catch {
    return true
  }
}

function WikiMark() {
  return (
    <span className={css.mark} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M7 7h10M7 12h10M7 17h10M7 7v10M12 7v10M17 7v10" />
        <circle cx="7" cy="7" r="1.25" />
        <circle cx="12" cy="7" r="1.25" />
        <circle cx="17" cy="7" r="1.25" />
        <circle cx="7" cy="12" r="1.25" />
        <circle cx="12" cy="12" r="1.6" className={css.markFocus} />
        <circle cx="17" cy="12" r="1.25" />
        <circle cx="7" cy="17" r="1.25" />
        <circle cx="12" cy="17" r="1.25" />
        <circle cx="17" cy="17" r="1.25" />
      </svg>
    </span>
  )
}

function ExternalLaunchMark() {
  return (
    <svg className={css.launchMark} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M9.5 3.5h3v3M12.25 3.75 7.5 8.5M7 4.5H4.75A1.25 1.25 0 0 0 3.5 5.75v5.5a1.25 1.25 0 0 0 1.25 1.25h5.5a1.25 1.25 0 0 0 1.25-1.25V9" />
    </svg>
  )
}

function WikiNav({ wide, t }: NavProps) {
  const open = () => {
    const url = new URL(OPEN_PATH, window.location.href).toString()
    const opened = window.open(url, '_blank')
    if (opened !== null) opened.opener = null
  }

  return (
    <button
      type="button"
      className={`${css.entry}${wide ? '' : ` ${css.rail}`}`}
      aria-label={`${t('nav')}，${t('openHint')}`}
      title={wide ? undefined : `${t('nav')} · ${t('openHint')}`}
      data-ff-llm-wiki-nav="true"
      onClick={open}
    >
      <WikiMark />
      {wide ? <span className={css.label}>{t('nav')}</span> : null}
      {wide ? <ExternalLaunchMark /> : null}
    </button>
  )
}

export const inject = ['slots', 'locale']

/** Register one launcher without replacing any DSH main-page surface. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, {
    zh: { nav: 'FF - LLM Wiki', openFailed: '无法启动 FF - LLM Wiki', openHint: '在新窗口打开' },
    en: { nav: 'FF - LLM Wiki', openFailed: 'Unable to launch FF - LLM Wiki', openHint: 'Open in a new window' },
  }), 'ff-llm-wiki: dictionaries')
  ctx.effect(() => {
    const synchronize = (): void => {
      document.documentElement.toggleAttribute(SIDEBAR_HIDDEN_ATTRIBUTE, !sidebarVisible())
    }
    synchronize()
    window.addEventListener('storage', synchronize)
    window.addEventListener(SIDEBAR_VISIBILITY_EVENT, synchronize)
    return () => {
      window.removeEventListener('storage', synchronize)
      window.removeEventListener(SIDEBAR_VISIBILITY_EVENT, synchronize)
      document.documentElement.removeAttribute(SIDEBAR_HIDDEN_ATTRIBUTE)
    }
  }, 'ff-llm-wiki: sidebar visibility')
  ctx.slots.inject('sidebar.primary.action', () => ctx.slots.register({
    name: 'sidebar.primary.action',
    id: 'ff-llm-wiki',
    order: 35,
    locale: NS,
  }, WikiNav))
}
