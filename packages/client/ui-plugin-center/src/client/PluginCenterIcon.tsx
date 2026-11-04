/** Sidebar panel icon for the Plugin Center page. */
import { IconCordisPluginOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the plugin glyph at the edge the sidebar asks for. The sidebar owns
 * the panel row, its selected state, and the accessible navigation label.
 * @param props - the sidebar's icon share: requested edge and selection.
 * @returns decorative plugin icon.
 */
export function PluginCenterIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconCordisPluginOutlineRegular size={size} />
}
