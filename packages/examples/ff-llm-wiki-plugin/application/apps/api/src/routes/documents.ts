import { createHash, randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'
import type { FastifyPluginAsync } from 'fastify'
import type {
  DemoSeedResult,
  DocumentKind,
  DocumentRecord,
  DocumentsListResponse,
  DocumentsQuery,
  DocumentProcessingJob,
  DocumentProcessingResponse,
  DocumentDetailResponse,
  UpdateDocumentRequest,
  UpdateDocumentResult,
  DeleteDocumentResult,
  DocumentTopic,
  ReprocessResult,
  UploadDocumentResult,
} from '@llmwiki/contracts'
import { createDemoDocuments, formatBytes, inferTopic } from '../data/demo.js'
import type { DocumentRepository } from '../data/repository.js'
import type { DocumentProcessor } from '../documents/processor.js'

/** 上传文件大小上限：50 MB */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** 支持导入的文件类型（扩展名 → 文档类型） */
const ALLOWED_EXT: Record<string, DocumentKind> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
}

const DOCUMENT_TOPICS = new Set<DocumentTopic>([
  'product',
  'engineering',
  'support',
  'security',
  'operations',
  'hr',
])

function badUpload(message: string): UploadDocumentResult {
  return { ok: false, duplicate: false, document: null, message }
}

/**
 * 资料导入与处理队列路由。
 *
 * - GET  /api/documents                   列表 + 搜索 + 状态筛选 + 分页
 * - POST /api/documents/demo-seed         载入演示资料（幂等）
 * - POST /api/documents                   上传资料并启动真实解析任务
 * - GET  /api/documents/:id/processing    读取处理任务实时快照
 * - POST /api/documents/:id/reprocess     重新处理
 */
export function documentsRoutes(
  repo: DocumentRepository,
  processor: DocumentProcessor,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: DocumentsQuery }>(
      '/api/documents',
      async (req): Promise<DocumentsListResponse> => {
        const q = (req.query ?? {}) as DocumentsQuery
        return repo.list({
          search: q.search,
          status: q.status,
          kind: q.kind,
          topic: q.topic,
          origin: q.origin,
          page: q.page,
          pageSize: q.pageSize,
        })
      },
    )

    app.post('/api/documents/demo-seed', async (): Promise<DemoSeedResult> => {
      return repo.seed(createDemoDocuments())
    })

    app.post('/api/documents', async (req, reply): Promise<UploadDocumentResult> => {
      let file
      try {
        file = await req.file()
      } catch (err) {
        const code = (err as { code?: string })?.code
        if (code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.code(413).send(badUpload('The file is too large. The limit is 50 MB per file.'))
        }
        return reply.code(400).send(badUpload('The uploaded content could not be read. Try again.'))
      }

      if (!file) {
        return reply.code(400).send(badUpload('No file was received. Choose a document to import.'))
      }

      const ext = extname(file.filename).toLowerCase()
      const kind = ALLOWED_EXT[ext]
      if (!kind) {
        return reply
          .code(400)
          .send(badUpload('Unsupported file type. Upload a PDF, DOCX, Markdown, or TXT file.'))
      }

      const buffer = await file.toBuffer()
      if (buffer.length === 0) {
        return reply.code(400).send(badUpload('The file is empty. Choose a document with content.'))
      }
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return reply.code(413).send(badUpload('The file is too large. The limit is 50 MB per file.'))
      }

      const sha256 = createHash('sha256').update(buffer).digest('hex')
      let existing = await repo.findBySha256(sha256)
      if (existing) {
        let processing = await processor.get(existing.id)
        if (
          existing.origin === 'upload' &&
          (!processing || processing.status === 'failed') &&
          existing.status !== 'ready'
        ) {
          existing =
            (await repo.updateProcessingState(existing.id, 'queued', 0, null)) ??
            existing
          processing = await processor.enqueue(existing, buffer)
        }
        return reply.send({
          ok: true,
          duplicate: true,
          document: existing,
          existingId: existing.id,
          message: processing
            ? `File already exists; resumed processing for "${existing.title}"`
            : `File already exists as "${existing.title}"`,
          ...(processing ? { processing } : {}),
        })
      }

      const title = basename(file.filename, ext).trim() || file.filename
      const now = new Date().toISOString()
      const doc: DocumentRecord = {
        id: `doc-${randomUUID().slice(0, 8)}`,
        title,
        originalName: file.filename,
        kind,
        topic: inferTopic(file.filename),
        origin: 'upload',
        status: 'queued',
        progress: 0,
        size: formatBytes(buffer.length),
        sizeBytes: buffer.length,
        sha256,
        source: 'Manual upload',
        error: null,
        createdAt: now,
        updatedAt: now,
      }

      await repo.insert(doc)
      let processing: DocumentProcessingJob
      try {
        processing = await processor.enqueue(doc, buffer)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to save the original file. Try again later.'
        const failed = await repo.updateProcessingState(
          doc.id,
          'failed',
          0,
          message,
        )
        return reply.code(500).send({
          ok: false,
          duplicate: false,
          document: failed ?? doc,
          message,
        })
      }

      return reply.code(201).send({
        ok: true,
        duplicate: false,
        document: doc,
        processing,
        message: 'File received; parsing and indexing started',
      })
    })

    app.get<{ Params: { id: string } }>(
      '/api/documents/:id',
      async (req, reply): Promise<DocumentDetailResponse> => {
        const document = await repo.getById(req.params.id)
        if (!document) {
          return reply.code(404).send({
            ok: false,
            document: null,
            processing: null,
            extractedText: '',
            chunks: [],
            wikiPages: [],
            message: 'Document not found',
          })
        }
        const [{ extractedText, chunks }, processing] = await Promise.all([
          processor.getArtifacts(document),
          processor.get(document.id),
        ])
        return {
          ok: true,
          document,
          processing,
          extractedText,
          chunks,
          wikiPages: processor.getWikiLinks(document.id),
          message: 'Document details updated',
        }
      },
    )

    app.patch<{ Params: { id: string }; Body: UpdateDocumentRequest }>(
      '/api/documents/:id',
      async (req, reply): Promise<UpdateDocumentResult> => {
        const body = req.body ?? {}
        const title = body.title?.trim()
        const source = body.source?.trim()
        if (body.title !== undefined && !title) {
          return reply.code(400).send({
            ok: false,
            document: null,
            wikiPages: [],
            message: 'Document title is required',
          })
        }
        if (body.topic !== undefined && !DOCUMENT_TOPICS.has(body.topic)) {
          return reply.code(400).send({
            ok: false,
            document: null,
            wikiPages: [],
            message: 'Invalid document topic',
          })
        }
        const document = await repo.updateMetadata(req.params.id, {
          ...(title ? { title: title.slice(0, 120) } : {}),
          ...(source !== undefined ? { source: source.slice(0, 120) } : {}),
          ...(body.topic ? { topic: body.topic } : {}),
        })
        if (!document) {
          return reply.code(404).send({
            ok: false,
            document: null,
            wikiPages: [],
            message: 'Document not found',
          })
        }
        await processor.publishCurrent(document)
        return {
          ok: true,
          document,
          wikiPages: processor.getWikiLinks(document.id),
          message: 'Document and linked Wiki pages updated',
        }
      },
    )

    app.delete<{ Params: { id: string } }>(
      '/api/documents/:id',
      async (req, reply): Promise<DeleteDocumentResult> => {
        const document = await repo.getById(req.params.id)
        if (!document) {
          return reply.code(404).send({
            ok: false,
            id: req.params.id,
            removedWikiSlugs: [],
            message: 'Document not found',
          })
        }
        const removedWikiSlugs = await processor.remove(document)
        await repo.delete(document.id)
        return {
          ok: true,
          id: document.id,
          removedWikiSlugs,
          message: 'Document, processing artifacts, and linked Wiki pages deleted',
        }
      },
    )

    app.get<{ Params: { id: string } }>(
      '/api/documents/:id/processing',
      async (req, reply): Promise<DocumentProcessingResponse> => {
        const document = await repo.getById(req.params.id)
        if (!document) {
          return reply.code(404).send({
            ok: false,
            document: null,
            job: null,
            message: 'Document not found',
          })
        }
        const job = await processor.get(document.id)
        if (!job) {
          return reply.code(404).send({
            ok: false,
            document,
            job: null,
            message: 'This document has no processing job',
          })
        }
        return { ok: true, document, job, message: 'Processing status updated' }
      },
    )

    app.post<{ Params: { id: string } }>(
      '/api/documents/:id/reprocess',
      async (req, reply): Promise<ReprocessResult> => {
        const { id } = req.params
        const document = await repo.reprocess(id)
        if (!document) {
          return reply.code(404).send({ ok: false, document: null, message: 'Document not found' })
        }
        if (document.origin === 'upload') {
          await processor.reprocess(document)
        }
        return { ok: true, document, message: 'Resubmitted for processing' }
      },
    )
  }
}
