import { compileWiki } from './compiler.js'

/**
 * `pnpm wiki:compile` CLI 入口。
 * 运行确定性编译，把 raw/ 的 18 份源资料重组为 wiki/ 的 47 个知识页。
 */
const manifest = compileWiki()

console.log('Compilation finished ✔')
console.log(`- Sources: ${manifest.sources.length} (raw/ unchanged, nothing added)`)
console.log(`- Pages: ${manifest.stats.pages}`)
console.log(
  `- Type distribution: ${manifest.types
    .map(t => `${t.type} ${t.count}`)
    .join(' · ')}`,
)
console.log(
  `- Interlinks: ${manifest.stats.interlinks} · source citations: ${manifest.stats.sourceCitations} · topics covered: ${manifest.stats.topicsCovered}`,
)
console.log(`- Compiled at: ${manifest.stats.lastCompiledAt}`)
console.log('- Output directory: content/wiki/')
