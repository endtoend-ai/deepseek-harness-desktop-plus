import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const readme = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8')
const rootPackage = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
) as { readonly scripts: Readonly<Record<string, string>> }
const desktopPackage = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'apps/desktop/package.json'), 'utf8'),
) as {
  readonly build: Readonly<Record<string, unknown>>
  readonly scripts: Readonly<Record<string, string>>
}

describe('repository delivery documentation', () => {
  it('keeps one English README with no brand or translation pointer', () => {
    expect(existsSync(resolve(repositoryRoot, 'README.en.md'))).toBe(false)
    expect(readme).not.toMatch(/[\u4e00-\u9fff]/u)
    for (const token of ['赋范', 'fufan', 'beyondata']) {
      expect(readme.toLowerCase()).not.toContain(token.toLowerCase())
    }
  })

  it('documents only commands the repository actually exposes', () => {
    for (const name of ['build:desktop', 'dist:desktop:mac', 'dist:desktop:win', 'check:all', 'dev:web', 'typecheck']) {
      expect(readme).toContain(`pnpm run ${name}`)
      expect(Object.keys(rootPackage.scripts)).toContain(name)
    }
  })

  it('keeps product repository links neutral', () => {
    const urls = readme.match(/https:\/\/github\.com\/[^\s)\]"')]+/gu) ?? []
    for (const url of urls) expect(url).not.toContain('fufankeji')
    for (const url of urls.filter(candidate => candidate.includes('deepseek-harness-desktop'))) {
      expect(url.startsWith('https://github.com/WilliamShi666/deepseek-harness-desktop')).toBe(true)
    }
  })

  it('retires the hosted release and publish chain', () => {
    for (const path of [
      '.github/workflows/desktop-release.yml',
      '.github/workflows/desktop-publish.yml',
      '.github/workflows/desktop-windows-preview.yml',
      'apps/desktop/scripts/publish-update.ts',
    ]) {
      expect(existsSync(resolve(repositoryRoot, path))).toBe(false)
    }
    expect(desktopPackage.build).not.toHaveProperty('publish')
    expect(Object.keys(desktopPackage.scripts)).not.toContain('publish:update')
  })
})
