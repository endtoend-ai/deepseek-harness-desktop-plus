/** Bundled verified fixture used until the catalog operator service ships in F006. */

import {
  decodeCatalogSnapshot,
  type CatalogArtifactEvidence,
  type CatalogSnapshot,
  type CatalogSummary,
  type CatalogVersionPreflight,
} from '@deepseek-ai/dsh-plugin-center-contracts'

const CATALOG_ETAG = 'bundled-f003-2026-08-15'

const COMPATIBILITY = {
  status: 'compatible',
  reason: null,
  platforms: ['darwin-arm64', 'win32-x64'],
} as const

const WORKSPACE_TOOLS = {
  pluginId: 'fixture.workspace-tools',
  version: '0.1.0-rc.5',
  catalogKind: 'plugin',
  scope: 'public',
  displayName: 'Workspace Productivity Tools',
  summary: 'Built-in sample Bundle used to exercise plugin discovery, search and detail flows.',
  publisher: 'DeepSeek Harness Fixture',
  verified: true,
  keywords: ['workspace', 'tools', 'productivity', 'efficiency'],
  capabilities: ['host', 'client', 'tool'],
  icon: null,
  brandColor: '#5B8CFF',
  compatibility: COMPATIBILITY,
  updatedAt: '2026-08-15T03:00:00.000Z',
  installed: false,
} as const satisfies CatalogSummary

const SKILL_PACK = {
  pluginId: 'fixture.skill-pack',
  version: '0.1.0-rc.5',
  catalogKind: 'skill-pack',
  scope: 'public',
  displayName: 'Harness Base Skill Pack',
  summary: 'Sample Skill Pack packaged as a DSH Bundle, used to exercise the skill discovery path.',
  publisher: 'DeepSeek Harness Fixture',
  verified: true,
  keywords: ['skill', 'skills', 'pack', 'bundle'],
  capabilities: ['skill'],
  icon: null,
  brandColor: '#8B5CF6',
  compatibility: COMPATIBILITY,
  updatedAt: '2026-08-15T02:00:00.000Z',
  installed: false,
} as const satisfies CatalogSummary

const LOCAL_BUNDLE = {
  pluginId: 'local.developer-bundle',
  version: '0.1.0',
  catalogKind: 'plugin',
  scope: 'local',
  displayName: 'Local Development Bundle',
  summary: 'Local sample projected from the current profile; shown for inspection only, with no mutation actions.',
  publisher: 'Local profile',
  verified: false,
  keywords: ['local', 'profile', 'development'],
  capabilities: ['host'],
  icon: null,
  brandColor: '#64748B',
  compatibility: { ...COMPATIBILITY, status: 'unknown', reason: 'Local Bundle has not been reviewed by the catalog.' },
  updatedAt: '2026-08-15T01:00:00.000Z',
  installed: true,
} as const satisfies CatalogSummary

function detail(
  summary: CatalogSummary,
  values: {
    readonly description: string
    readonly permissions: readonly string[]
    readonly riskSummary: string
    readonly expectedEntries: readonly string[]
    readonly expectedClientModules: readonly string[]
    readonly expectedSkillIds: readonly string[]
    readonly eligible: boolean
  },
) {
  return {
    summary,
    description: values.description,
    screenshots: [],
    permissions: values.permissions,
    riskLevel: summary.scope === 'local' ? 'medium' : 'low',
    riskSummary: values.riskSummary,
    changelog: 'First pinned version covering the plugin-center discovery loop.',
    publishedAt: summary.updatedAt,
    expectedEntries: values.expectedEntries,
    expectedClientModules: values.expectedClientModules,
    expectedSkillIds: values.expectedSkillIds,
    eligible: values.eligible,
    withdrawn: false,
  }
}

function preflight(
  summary: CatalogSummary,
  packageName: string,
  values: {
    readonly riskSummary: string
    readonly expectedEntries: readonly string[]
    readonly expectedClientModules: readonly string[]
    readonly expectedSkillIds: readonly string[]
    readonly eligible: boolean
    readonly artifact?: {
      readonly sha256: string
      readonly integrity: string
      readonly packedBytes: number
      readonly unpackedBytes: number
      readonly fileCount: number
    }
  },
): CatalogVersionPreflight {
  const artifact = values.artifact
  const artifacts: readonly CatalogArtifactEvidence[] = summary.scope === 'public' && artifact !== undefined
    ? (['darwin-arm64', 'win32-x64'] as const).map(platform => ({
      platform,
      url: `https://cdn.deepseek.com/plugins/${summary.pluginId}/${summary.version}/${platform}.tgz`,
      ...artifact,
    }))
    : []
  return {
    pluginId: summary.pluginId,
    version: summary.version,
    packageName,
    catalogEtag: CATALOG_ETAG,
    reviewed: summary.verified,
    eligible: values.eligible,
    withdrawn: false,
    desktopRange: '>=0.1.0-rc.1 <0.2.0',
    dshRange: '>=0.1.0-rc.1 <0.2.0',
    nodeRange: '>=22.19 <25',
    artifacts,
    bundlePatch: './cordis.patch.yml',
    capabilities: summary.capabilities,
    riskLevel: summary.scope === 'local' ? 'medium' : 'low',
    riskSummary: values.riskSummary,
    executionAuthority: 'broad-application-authority',
    conflicts: { pluginIds: [], packageNames: [], entryIds: [] },
    expectedEntries: values.expectedEntries,
    expectedClientModules: values.expectedClientModules,
    expectedSkillIds: values.expectedSkillIds,
    supportedActions: summary.scope === 'public' ? ['install', 'update', 'enable', 'disable', 'uninstall'] : [],
    restartRequired: true,
  }
}

/** Product-owned fixture is decoded through the same strict boundary as remote data. */
export const BUNDLED_CATALOG: CatalogSnapshot = decodeCatalogSnapshot({
  schemaVersion: 1,
  etag: CATALOG_ETAG,
  generatedAt: '2026-08-15T04:00:00.000Z',
  maxAgeSeconds: 86_400,
  sections: {
    featured: [WORKSPACE_TOOLS.pluginId, SKILL_PACK.pluginId],
    popular: [SKILL_PACK.pluginId, WORKSPACE_TOOLS.pluginId],
    recent: [WORKSPACE_TOOLS.pluginId, SKILL_PACK.pluginId],
  },
  entries: [WORKSPACE_TOOLS, SKILL_PACK, LOCAL_BUNDLE],
  details: [
    detail(WORKSPACE_TOOLS, {
      description: 'Reviewed install-test Bundle; installing it activates one Host entry and adds a visible Workspace Tools page to the sidebar.',
      permissions: ['Read the workspace the user explicitly selected.'],
      riskSummary: 'Built-in reviewed fixture; “verified” does not imply process isolation.',
      expectedEntries: ['fixture.workspace-tools'],
      expectedClientModules: ['@deepseek-ai/dsh-plugin-center-fixture'],
      expectedSkillIds: [],
      eligible: true,
    }),
    detail(SKILL_PACK, {
      description: 'Shows how a Skill Pack enters the same catalog and transaction path as a DSH Bundle instead of accepting arbitrary skill folders or Git repositories.',
      permissions: ['Register reviewed skill definitions with the Harness after install.'],
      riskSummary: 'This Skill Pack reuses the plugin compatibility and install authority; it introduces no second installer.',
      expectedEntries: ['fixture.harness-basics-provider'],
      expectedClientModules: [],
      expectedSkillIds: ['fixture-harness-basics'],
      eligible: true,
    }),
    detail(LOCAL_BUNDLE, {
      description: 'Local profile sample, used only to exercise the local scope and the read-only state outside catalog management.',
      permissions: ['Permission details are the local author’s responsibility.'],
      riskSummary: 'Local entries are not catalog-reviewed, so the plugin center performs no install or uninstall on them.',
      expectedEntries: ['local.developer-bundle'],
      expectedClientModules: [],
      expectedSkillIds: [],
      eligible: false,
    }),
  ],
  preflights: [
    preflight(WORKSPACE_TOOLS, '@deepseek-ai/dsh-plugin-center-fixture', {
      riskSummary: 'Built-in reviewed fixture; “verified” does not imply process isolation.',
      expectedEntries: ['fixture.workspace-tools'],
      expectedClientModules: ['@deepseek-ai/dsh-plugin-center-fixture'],
      expectedSkillIds: [],
      eligible: true,
      artifact: {
        sha256: 'c7ed790a74a9ba74fa5c9037642a3233fe67a2624a84c8bd368452c09b205e81',
        integrity: 'sha512-nI72LPDEDLQflFIbq7/kxh889TvJMpGkSslu+Vwq1+Xs1LbknlUHl5UWyJX6dhE7jsh9BzohvghCWjgowWxC3Q==',
        packedBytes: 4_368,
        unpackedBytes: 10_450,
        fileCount: 13,
      },
    }),
    preflight(SKILL_PACK, '@deepseek-ai/dsh-plugin-center-skill-fixture', {
      riskSummary: 'This Skill Pack reuses the plugin compatibility and install authority; it introduces no second installer.',
      expectedEntries: ['fixture.harness-basics-provider'],
      expectedClientModules: [],
      expectedSkillIds: ['fixture-harness-basics'],
      eligible: true,
      artifact: {
        sha256: 'c7cea08358a5b64e1944c9ec49c436eda16c84e78151bb5e52d58bcba36492c2',
        integrity: 'sha512-4vw9vM5HEnp0ZaSBY8hQGENODss4lCK528McFoz0kheqjqb+KxBNAXr+Tr+bKTF+bP/2stTUiyttQjn2eZZVRA==',
        packedBytes: 3_064,
        unpackedBytes: 5_887,
        fileCount: 10,
      },
    }),
    preflight(LOCAL_BUNDLE, '@local/developer-bundle', {
      riskSummary: 'Local entries are not catalog-reviewed, so the plugin center performs no install or uninstall on them.',
      expectedEntries: ['local.developer-bundle'],
      expectedClientModules: [],
      expectedSkillIds: [],
      eligible: false,
    }),
  ],
})
