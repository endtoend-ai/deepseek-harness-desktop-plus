/** Visible browser capability contributed by the reviewed fixture Bundle. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: the slot-registry service merge this plugin registers through.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

const PAGE_ID = 'fixture-workspace-tools' as MainPanelId
const NS = 'pluginCenterFixture'

type FixtureLocaleKey = 'nav' | 'title' | 'description' | 'running'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    pluginCenterFixture: FixtureLocaleKey
  }
}

type NavProps = PropsRuntime<'sidebar.panellist'> & PropsLocale<'pluginCenterFixture'>
type PageProps = PropsRuntime<'main'> & PropsLocale<'pluginCenterFixture'>

/**
 * Panel glyph: the sidebar owns the row, its label, the selected state, and the
 * click that selects this page in the main column.
 * @param props - the sidebar's icon share: requested edge and selection.
 * @returns the fixture glyph at that edge.
 */
function FixtureNav({ size }: NavProps) {
  return <span aria-hidden="true" data-plugin-center-fixture-nav="workspace-tools" style={{ fontSize: size, lineHeight: 1 }}>◇</span>
}

function FixturePage({ t }: PageProps) {
  return (
    <main data-plugin-center-fixture-capability="workspace-tools" style={{ padding: 40, maxWidth: 760 }}>
      <p style={{ color: '#5f8cff', fontWeight: 600 }}>{t('running')}</p>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </main>
  )
}

export const inject = ['slots', 'layout', 'locale']

/** Register one first-level navigation action and observable capability page. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, {
    zh: {
      nav: '工作区工具',
      title: '工作区工具已运行',
      description: '这个页面由插件中心的受审查测试插件提供。',
      running: '插件运行中',
    },
    en: {
      nav: 'Workspace tools',
      title: 'Workspace tools are running',
      description: 'This page is contributed by the Plugin Center reviewed fixture.',
      running: 'Plugin running',
    },
  }), 'plugin-center-fixture: dictionaries')
  const t = ctx.locale.bind(NS)
  const { slots } = ctx
  // One panel, addressed by the same id from the sidebar launcher and the main
  // column; the sidebar renders the row and selects it on click.
  slots.inject('sidebar.panellist', () => slots.register({
    name: 'sidebar.panellist',
    id: PAGE_ID,
    order: 30,
    locale: NS,
    label: () => t('nav'),
  }, FixtureNav))
  slots.inject('main', () => slots.register({
    name: 'main',
    key: PAGE_ID,
    locale: NS,
  }, FixturePage))
  ctx.effect(() => () => {
    if (ctx.layout.panelInfo.getSnapshot().activePanelId === PAGE_ID) ctx.layout.selectPanel(null)
  }, 'plugin-center-fixture: release its main panel')
}
