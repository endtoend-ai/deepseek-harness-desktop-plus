import { ensureWikiCompiled } from '../wiki/service.js'
import { extractGraph } from './extractor.js'

/**
 * `pnpm graph:extract` CLI 入口。
 * 运行确定性本地规则抽取：读真实编译产物 → 生成 output/kg_nodes.json 与 kg_edges.json。
 * 无模型、无网络，标注「本地规则抽取演示模式」。
 */
ensureWikiCompiled()
const result = extractGraph()

console.log('Graph extraction finished ✔ (local rule-based demo mode)')
console.log(`- Nodes: ${result.stats.nodes} · edges: ${result.stats.edges}`)
console.log(
  `- Node types: pages ${result.stats.pageNodes} · sources ${result.stats.sourceNodes} · topics ${result.stats.topicNodes} · page types ${result.stats.pageTypeNodes}`,
)
console.log(
  `- Edge semantics: link ${result.stats.interlinkEdges} · source ${result.stats.sourceEdges} · topic ${result.stats.topicEdges} · type ${result.stats.typeEdges}`,
)
console.log(`- Extracted at: ${result.generatedAt}`)
console.log('- Output directory: output/ (kg_nodes.json + kg_edges.json + kg_meta.json)')
