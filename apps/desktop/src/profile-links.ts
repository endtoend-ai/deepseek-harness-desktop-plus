/** Profile-side resolution for the release-owned application bundles. */

import { existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** One shipped bundle manifest resolved from its package root. */
interface ShippedBundle {
  /** Package name recorded in the manifest. */
  readonly name: string
  /** Absolute package directory owning the manifest. */
  readonly directory: string
}

/**
 * Read the package name and root of every shipped bundle manifest.
 * @param manifestPaths - Absolute paths of the shipped bundle manifests.
 * @returns One entry per readable manifest, in input order.
 */
function readShippedBundles(manifestPaths: readonly string[]): ShippedBundle[] {
  const bundles: ShippedBundle[] = []
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { readonly name?: unknown }
      if (typeof manifest.name !== 'string' || manifest.name === '') continue
      bundles.push({ name: manifest.name, directory: dirname(manifestPath) })
    } catch {
      // A manifest the host cannot read is reported by the catalog authority;
      // linking is best-effort and must not block startup.
    }
  }
  return bundles
}

/**
 * Point the Profile's `node_modules` at the shipped application bundles.
 *
 * The 0.2.1 runtime resolution finds bundles that are dependencies of the
 * installation, and the shipped application bundles are only installed into
 * the packaged runtime. A development launch therefore has to expose them to
 * the Profile explicitly; an existing entry is left untouched so a user
 * installation of the same name keeps ownership.
 * @param profileDirectory - The Profile directory receiving the links.
 * @param manifestPaths - Absolute paths of the shipped bundle manifests.
 */
export function linkShippedBundles(profileDirectory: string, manifestPaths: readonly string[]): void {
  const modules = join(profileDirectory, 'node_modules')
  for (const bundle of readShippedBundles(manifestPaths)) {
    const target = join(modules, ...bundle.name.split('/'))
    if (existsSync(target)) continue
    mkdirSync(dirname(target), { recursive: true })
    try {
      symlinkSync(resolve(bundle.directory), target, 'junction')
    } catch {
      // A concurrent launch may have created the same link; startup continues
      // with whatever entry now exists.
    }
  }
}
