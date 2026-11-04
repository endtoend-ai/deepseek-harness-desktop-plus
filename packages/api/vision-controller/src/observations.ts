/**
 * Durable visual observations: the Session event the model-visible description
 * is recorded under, and the host-only projection that answers "does this
 * exact attachment/question/model already have one" without reading back
 * through the event log.
 *
 * @module @deepseek-ai/dsh-api-vision-controller/src/observations
 */

import { z } from 'zod'
import type { Session } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition, SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'

/** Durable observation recorded when an image is converted for a text-only model. */
export interface VisionObservationEventData {
  /** Attachment whose bytes the provider described. */
  attachmentId: string
  /** Question the description answers. */
  question: string
  /** Visual model that produced the description. */
  model: string
  /** The description the model received in place of the image. */
  description: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Exact provider observation used to replace one model-visible image.
     * @param data.attachmentId - attachment whose bytes the provider described.
     * @param data.question - question the description answers.
     * @param data.model - visual model that produced the description.
     * @param data.description - the description the model received.
     */
    'vision/observation': VisionObservationEventData
  }
}

/** Projection key owning the observation index for one Session. */
export const VISION_OBSERVATION_PROJECTION_KEY = 'visionObservation' as const

/** Host-only index of the observations already committed to one Session log. */
export interface VisionObservationState {
  /** Recorded description per observation identity; see {@link observationIdentity}. */
  readonly observations: Readonly<Record<string, string>>
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Host-only index of this Session's committed visual observations. */
    visionObservation: VisionObservationState
  }
}

const observationStateSchema = z.object({
  observations: z.record(z.string(), z.string()),
}).strict()

/**
 * Identity under which one observation is de-duplicated. Provider, base URL,
 * and visual model are deliberately absent: the record answers what the model
 * was told about this attachment for this question in this session.
 * @param input - attachment, question, and visual model of one observation.
 * @returns an opaque key safe to use as an object member.
 */
export function observationIdentity(input: { attachmentId: string; question: string; model: string }): string {
  return `${input.attachmentId}\0${input.question}\0${input.model}`
}

/** Host-only fold maintaining one Session's committed observations. */
export const visionObservationProjection: ProjectionDefinition<typeof VISION_OBSERVATION_PROJECTION_KEY> = {
  key: VISION_OBSERVATION_PROJECTION_KEY,
  stateSchema: observationStateSchema,
  stateVersion: 1,
  init: () => ({ observations: {} }),
  apply: (state, event) => event.type !== 'vision/observation'
    ? state
    : {
        observations: {
          ...state.observations,
          [observationIdentity(event.data)]: event.data.description,
        },
      },
}

/**
 * Ensure one exact model-visible visual observation exists in the durable
 * Session log, reusing an observation a resumed Session already carries.
 * @param projections - registry holding the host-only observation index.
 * @param session - Session that owns the durable observation event.
 * @param input - attachment, question, and model identity used for de-duplication.
 * @param analyze - Deferred provider call used only when no observation exists.
 * @returns The existing or newly generated visual description.
 */
export async function ensureLoggedVisionObservation(
  projections: SessionProjectionRegistry,
  session: Session,
  input: Omit<VisionObservationEventData, 'description'>,
  analyze: () => Promise<string>,
): Promise<string> {
  const identity = observationIdentity(input)
  const recorded = projections.stateOf(session, VISION_OBSERVATION_PROJECTION_KEY)?.observations[identity]
  if (recorded !== undefined) return recorded
  const description = await analyze()
  // A concurrent conversion of the same identity commits first; its record is
  // the one the log will replay, so this call adopts it instead of appending a
  // second, different description for the same image.
  const raced = projections.stateOf(session, VISION_OBSERVATION_PROJECTION_KEY)?.observations[identity]
  if (raced !== undefined) return raced
  session.append('vision/observation', { ...input, description })
  return description
}
