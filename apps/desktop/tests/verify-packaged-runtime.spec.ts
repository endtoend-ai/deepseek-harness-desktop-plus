import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { afterPack } from '../scripts/verify-packaged-runtime.ts'
import { PINNED_PACKAGE_MANAGER_VERSION } from '../src/plugin-center/package-manager.ts'

function context(appOutDir: string, electronPlatformName = 'darwin') {
  return {
    appOutDir,
    electronPlatformName,
    packager: {
      appInfo: {
        productFilename: 'DeepSeek Harness',
        updaterCacheDirName: 'deepseek-harness-updater',
      },
      config: {},
    },
  } as Parameters<typeof afterPack>[0]
}

const HOST_FILES = [
  ['@deepseek-ai', 'dsh', 'lib', 'bin.js'],
  ['@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html'],
  ['@deepseek-ai', 'dsh-web-frontend', 'dist', 'dsh-desktop', 'default-background.webp'],
  ['@deepseek-ai', 'dsh-web-frontend', 'dist', 'dsh-desktop', 'cloud-cat-background.webp'],
  ['@deepseek-ai', 'dsh-web-frontend', 'dist', 'dsh-desktop', 'jiutian-deep-space-compute-observatory.webp'],
  ['@deepseek-ai', 'dsh-web-frontend', 'dist', 'dsh-desktop', 'jiutian-quantum-glass-laboratory.webp'],
  ['@deepseek-ai', 'dsh-web-frontend', 'dist', 'dsh-desktop', 'jiutian-dawn-compute-horizon.webp'],
] as const

async function writeHostFiles(modules: string, extra: ReadonlyArray<readonly string[]> = []): Promise<void> {
  for (const segments of [...HOST_FILES, ...extra]) {
    const file = join(modules, ...segments)
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, '')
  }
}

async function writeRequiredMacRuntime(appOutDir: string): Promise<string> {
  const modules = join(appOutDir, 'DeepSeek Harness.app', 'Contents', 'Resources', 'host', 'node_modules')
  await writeHostFiles(modules, [
    ['pnpm', 'bin', 'pnpm.cjs'],
    ['@img', 'sharp-darwin-arm64', 'lib', 'sharp-darwin-arm64-test.node'],
  ])
  await writeFile(join(modules, 'pnpm/package.json'), JSON.stringify({ version: PINNED_PACKAGE_MANAGER_VERSION }))
  return modules
}

describe('packaged desktop runtime verification', () => {
  it('accepts the packaged runtime without writing any update source', async () => {
    const appOutDir = await mkdtemp(join(tmpdir(), 'dsh-packaged-runtime-'))
    try {
      await writeRequiredMacRuntime(appOutDir)

      await expect(afterPack(context(appOutDir))).resolves.toBeUndefined()
      const resources = join(appOutDir, 'DeepSeek Harness.app', 'Contents', 'Resources')
      await expect(access(join(resources, 'app-update.yml'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(appOutDir, { recursive: true, force: true })
    }
  })

  it('requires the macOS arm64 Sharp native module in a macOS package', async () => {
    const appOutDir = await mkdtemp(join(tmpdir(), 'dsh-packaged-runtime-mac-sharp-'))
    try {
      const modules = await writeRequiredMacRuntime(appOutDir)
      const sharp = join(modules, '@img', 'sharp-darwin-arm64', 'lib', 'sharp-darwin-arm64-test.node')
      await rm(sharp)
      await expect(afterPack(context(appOutDir)))
        .rejects.toThrow('macOS arm64 Sharp native module is missing from the packaged Host runtime')
    } finally {
      await rm(appOutDir, { recursive: true, force: true })
    }
  })

  it('rejects a packaged shell whose package manager is absent or not pinned', async () => {
    const appOutDir = await mkdtemp(join(tmpdir(), 'dsh-packaged-runtime-pnpm-'))
    try {
      const modules = join(appOutDir, 'DeepSeek Harness.app', 'Contents', 'Resources', 'host', 'node_modules')
      await writeHostFiles(modules, [['pnpm', 'bin', 'pnpm.cjs']])
      await mkdir(join(modules, 'pnpm'), { recursive: true })
      await writeFile(join(modules, 'pnpm/package.json'), JSON.stringify({ version: '0.0.0-unpinned' }))

      await expect(afterPack(context(appOutDir)))
        .rejects.toThrow(`packaged pnpm version must be ${PINNED_PACKAGE_MANAGER_VERSION}`)
    } finally {
      await rm(appOutDir, { recursive: true, force: true })
    }
  })

  it('rejects a shell whose Host dependency tree was filtered out', async () => {
    const appOutDir = await mkdtemp(join(tmpdir(), 'dsh-packaged-runtime-'))
    try {
      await expect(afterPack(context(appOutDir))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(appOutDir, { recursive: true, force: true })
    }
  })

  it('requires Windows x64 native modules in a Windows package', async () => {
    const appOutDir = await mkdtemp(join(tmpdir(), 'dsh-packaged-runtime-win-'))
    try {
      const modules = join(appOutDir, 'resources', 'host', 'node_modules')
      await writeHostFiles(modules, [
        ['pnpm', 'bin', 'pnpm.cjs'],
        ['@koromix', 'koffi-win32-x64', 'win32_x64', 'koffi.node'],
        ['node-addon-require-builtin-win32-x64-msvc', 'prebuilt', 'win32-x64-msvc-napi-v9.node'],
        ['node-pty', 'prebuilds', 'win32-x64', 'conpty.node'],
        ['node-pty', 'prebuilds', 'win32-x64', 'conpty_console_list.node'],
        ['@img', 'sharp-win32-x64', 'lib', 'sharp-win32-x64-test.node'],
      ])
      await writeFile(join(modules, 'pnpm/package.json'), JSON.stringify({ version: PINNED_PACKAGE_MANAGER_VERSION }))

      await expect(afterPack(context(appOutDir, 'win32'))).resolves.toBeUndefined()
      await rm(join(modules, 'node-pty', 'prebuilds', 'win32-x64', 'conpty_console_list.node'))
      await expect(afterPack(context(appOutDir, 'win32'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(appOutDir, { recursive: true, force: true })
    }
  })
})
