/** Derive release-owned package and Loader-row identities from shipped Bundles. */

import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u
const MODULE_SPECIFIER = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)(?:\/[a-zA-Z0-9._/-]+)?$/u
/** Cordis builtin specifier (`cordis:group`, `cordis:editor`): composes rows without an npm package. */
const BUILTIN_SPECIFIER = /^cordis:[a-z][a-z0-9-]*$/u
const ENTRY_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u

/** One immutable protected-identity projection derived from release composition. */
export interface ProtectedSystemComponents {
  readonly packageNames: readonly string[]
  readonly entryIds: readonly string[]
}

interface BundleManifest {
  readonly name?: unknown
  readonly dsh?: { readonly bundle?: { readonly patch?: unknown } }
}

function scalar(source: string, label: string): string {
  const value = source.trim()
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1)
  }
  if (value === '' || /[\s#]/u.test(value)) throw new Error(`${label} must be one plain YAML scalar`)
  return value
}

function packageFromSpecifier(specifier: string, label: string): string {
  if (!MODULE_SPECIFIER.test(specifier)) throw new Error(`${label} has an invalid Loader module specifier`)
  if (!specifier.startsWith('@')) {
    const [packageName] = specifier.split('/')
    if (packageName === undefined) throw new Error(`${label} has no package name`)
    return packageName
  }
  return specifier.split('/').slice(0, 2).join('/')
}

function collectPatchIdentities(
  patch: string,
  label: string,
  entryIds: Set<string>,
  packageNames: Set<string>,
): void {
  let observedEntry = false
  for (const [index, line] of patch.split(/\r?\n/u).entries()) {
    const entry = line.match(/^\s*-\s+id:\s+(.+?)\s*$/u)
    if (entry?.[1] !== undefined) {
      const value = scalar(entry[1], `${label}:${String(index + 1)} id`)
      if (!ENTRY_ID.test(value)) throw new Error(`${label}:${String(index + 1)} has an invalid Loader row id`)
      entryIds.add(value)
      observedEntry = true
      continue
    }
    const packageRow = line.match(/^\s+name:\s+(.+?)\s*$/u)
    if (packageRow?.[1] === undefined) continue
    const rowLabel = `${label}:${String(index + 1)} name`
    const specifier = scalar(packageRow[1], rowLabel)
    // A builtin specifier names a Cordis builtin rather than a package in the
    // packaged Host dependency map, so it contributes no protected package.
    if (specifier.includes(':')) {
      if (!BUILTIN_SPECIFIER.test(specifier)) {
        throw new Error(`${rowLabel} has an unsupported Loader builtin specifier`)
      }
      continue
    }
    packageNames.add(packageFromSpecifier(specifier, rowLabel))
  }
  if (!observedEntry) throw new Error(`${label} contains no protected Loader rows`)
}

/**
 * Read shipped Bundle manifests and patches without evaluating YAML expressions.
 * @param manifestPaths - Exact package manifests composing the Desktop Web profile.
 * @returns Sorted release-owned package and Loader-row identities.
 */
export function deriveProtectedSystemComponents(manifestPaths: readonly string[]): ProtectedSystemComponents {
  if (manifestPaths.length === 0) throw new Error('shipped composition must contain at least one Bundle')
  const packageNames = new Set<string>()
  const entryIds = new Set<string>()
  for (const manifestPath of manifestPaths) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as BundleManifest
    if (typeof manifest.name !== 'string' || !PACKAGE_NAME.test(manifest.name)) {
      throw new Error(`${manifestPath} has no valid package name`)
    }
    const declared = manifest.dsh?.bundle?.patch
    const declaredPatches = typeof declared === 'string'
      ? [declared]
      : Array.isArray(declared) ? declared.filter((entry): entry is string => typeof entry === 'string') : []
    if (declaredPatches.length === 0 || declaredPatches.some(entry => entry === '')) {
      throw new Error(`${manifestPath} declares no dsh.bundle.patch`)
    }
    const root = dirname(manifestPath)
    packageNames.add(manifest.name)
    for (const declaredPatch of declaredPatches) {
      const patchPath = resolve(root, declaredPatch)
      const fromRoot = relative(root, patchPath)
      if (fromRoot === '..' || fromRoot.startsWith('../') || fromRoot.startsWith('..\\')) {
        throw new Error(`${manifestPath} declares a Bundle patch outside its package`)
      }
      collectPatchIdentities(readFileSync(patchPath, 'utf8'), patchPath, entryIds, packageNames)
    }
  }
  return {
    packageNames: [...packageNames].sort(),
    entryIds: [...entryIds].sort(),
  }
}
