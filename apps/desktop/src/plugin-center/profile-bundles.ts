/**
 * Profile Bundle composition owned by the Desktop plugin center.
 *
 * A Bundle is active exactly when its package name appears in
 * `dsh.profile.bundles`; an installed dependency that is a Bundle but absent
 * from that list is disabled. Both transitions rewrite the same ordered list,
 * so the manifest never carries two disagreeing membership records.
 */

import type { ProfileManifest } from '@deepseek-ai/dsh-app-boot'

/** Validated ordered active Bundle list. */
export interface ProfileBundleState {
  /** Active Bundle package names in composition order. */
  readonly bundles: readonly string[]
}

/** Result of reconciling dependency-managed Bundles in one profile manifest. */
export interface ProfileBundleReconciliation {
  /** The reconciled manifest; identical to the input `after` value when unchanged. */
  readonly manifest: ProfileManifest
  /** Whether the ordered active Bundle list changed. */
  readonly changed: boolean
  /** Newly activated Bundle dependencies, in manifest dependency order. */
  readonly addedBundles: readonly string[]
  /** Dependency-managed Bundle entries removed from the active list. */
  readonly removedBundles: readonly string[]
  /** Newly added dependencies that do not export a Harness Bundle. */
  readonly addedPlainDependencies: readonly string[]
}

/**
 * Read the active Bundle list and reject a manifest the launcher cannot compose.
 * @param manifest - The Profile manifest that owns the Bundle composition.
 * @returns The validated active Bundle list.
 */
export function readProfileBundleState(manifest: ProfileManifest): ProfileBundleState {
  const bundles = [...manifest.dsh?.profile?.bundles ?? []]
  if (bundles.some(value => typeof value !== 'string' || value.length === 0)) {
    throw new Error('dsh: dsh.profile.bundles must contain non-empty package names')
  }
  if (new Set(bundles).size !== bundles.length) {
    throw new Error('dsh: dsh.profile.bundles must not contain duplicates')
  }
  return { bundles }
}

/**
 * Atomically express the user's active or disabled intent for one installed Bundle.
 *
 * The caller proves Bundle identity — the plugin center only reaches this
 * function with a reviewed catalog version whose declared patch was verified —
 * so this step owns membership alone.
 *
 * @param manifest - The Profile manifest to update immutably.
 * @param packageName - The installed Profile Bundle package to update.
 * @param enabled - Whether the Bundle should be active in the next Host generation.
 * @returns The original manifest for an idempotent request, otherwise an updated manifest.
 */
export function setProfileBundleEnabled(
  manifest: ProfileManifest,
  packageName: string,
  enabled: boolean,
): ProfileManifest {
  if (!(packageName in (manifest.dependencies ?? {}))) {
    throw new Error(`dsh: cannot change uninstalled Profile Bundle ${JSON.stringify(packageName)}`)
  }
  const state = readProfileBundleState(manifest)
  if (enabled === state.bundles.includes(packageName)) return manifest
  const bundles = enabled
    ? [...state.bundles, packageName]
    : state.bundles.filter(value => value !== packageName)
  return {
    ...manifest,
    dsh: {
      ...manifest.dsh,
      profile: { ...manifest.dsh?.profile, bundles },
    },
  }
}

/**
 * Reconcile the ordered Bundle list after a package-manager mutation.
 *
 * Only dependency-managed entries are added or removed. Shipped template and
 * other user-managed Bundles that were never dependencies remain untouched.
 * Package inspection is supplied by the caller so the same deterministic
 * transition serves install, remove, and repair paths.
 *
 * @param before - Profile manifest captured before the package-manager mutation.
 * @param after - Profile manifest written by the successful mutation.
 * @param exportsBundle - Inspect one currently installed dependency for `dsh.bundle`.
 * @returns The immutable reconciliation result and change details for caller diagnostics.
 */
export function reconcileProfileBundles(
  before: ProfileManifest,
  after: ProfileManifest,
  exportsBundle: (packageName: string) => boolean,
): ProfileBundleReconciliation {
  const beforeDependencies = new Set(Object.keys(before.dependencies ?? {}))
  const dependencies = Object.keys(after.dependencies ?? {})
  const dependencySet = new Set(dependencies)
  const bundleStatus = new Map(dependencies.map(packageName => [packageName, exportsBundle(packageName)]))
  const bundles = [...readProfileBundleState(after).bundles]
  const addedBundles: string[] = []
  const removedBundles: string[] = []
  const addedPlainDependencies: string[] = []

  for (const packageName of dependencies) {
    if (bundleStatus.get(packageName) === true) {
      if (bundles.includes(packageName)) continue
      bundles.push(packageName)
      addedBundles.push(packageName)
    } else if (!beforeDependencies.has(packageName)) {
      addedPlainDependencies.push(packageName)
    }
  }

  const reconciled = bundles.filter((packageName) => {
    const dependencyManaged = beforeDependencies.has(packageName) || dependencySet.has(packageName)
    const remainsBundle = dependencySet.has(packageName) && bundleStatus.get(packageName) === true
    if (!dependencyManaged || remainsBundle) return true
    removedBundles.push(packageName)
    return false
  })

  const changed = reconciled.length !== bundles.length
    || reconciled.some((packageName, index) => packageName !== bundles[index])
  const manifest = changed
    ? {
      ...after,
      dsh: {
        ...after.dsh,
        profile: { ...after.dsh?.profile, bundles: reconciled },
      },
    }
    : after
  return { manifest, changed, addedBundles, removedBundles, addedPlainDependencies }
}
