/** Sidebar panel icon for the Application Center page. */
import { IconDataOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the application glyph at the edge the sidebar asks for; the sidebar
 * owns the panel row, its selected state, and the accessible label.
 * @param props - the sidebar's icon share: requested edge and selection.
 * @returns decorative application icon.
 */
export function ApplicationCenterIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconDataOutlineRegular size={size} />
}
