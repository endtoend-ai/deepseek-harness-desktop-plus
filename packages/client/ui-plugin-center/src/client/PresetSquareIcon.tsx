/** Sidebar panel icon for Preset Square. */
import { IconAgentPresetOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the preset glyph at the edge the sidebar asks for; the sidebar owns
 * the panel row, its selected state, and the accessible label.
 * @param props - the sidebar's icon share: requested edge and selection.
 * @returns decorative preset icon.
 */
export function PresetSquareIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconAgentPresetOutlineRegular size={size} />
}
