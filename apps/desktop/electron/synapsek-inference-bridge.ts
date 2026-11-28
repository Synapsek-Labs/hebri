import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import http from 'node:http'

import { AccountError } from './synapsek-account'

interface ManagedAccount {
  status(): Promise<{ state: string; account?: { userId: string } }>
  connectorRequest?(body: unknown, expectedUserId?: string): Promise<any>
  managedRequest(
    action: 'models' | 'completion',
    body?: unknown,
    requestId?: string,
    expectedUserId?: string,
    signal?: AbortSignal
  ): Promise<any>
}

/** Local runtime adapter. No OAuth credential or provider key crosses this socket. */
export async function startSynapsekInferenceBridge(account: ManagedAccount) {
  const secret = randomBytes(32).toString('hex')
  let host = ''
  let owner: string | undefined

  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json')

    const fail = (status: number, code: string) => {
      res.writeHead(status)
      // A fixed, non-sensitive description lets the agent's existing reasoning
      // compatibility ladder recover; raw upstream diagnostics never cross here.
      const message = code === 'reasoning_required' ? 'Reasoning is required and cannot be disabled.' : code
      res.end(JSON.stringify({ error: { message, type: 'synapsek_error', code } }))
    }

    const supplied = Buffer.from(String(req.headers.authorization || ''))
    const expected = Buffer.from(`Bearer ${secret}`)

    if (
      req.headers.host !== host ||
      req.headers.origin ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      fail(401, 'unauthenticated')

      return
    }

    const models = req.method === 'GET' && req.url === '/v1/models'
    const completion = req.method === 'POST' && req.url === '/v1/chat/completions'
    const connector = req.method === 'POST' && req.url === '/v1/connectors'

    if (!models && !completion && !connector) {
      fail(404, 'not_found')

      return
    }

    // SDK retries cannot repeat a possibly accepted paid generation. The user
    // can deliberately retry with a new turn after inspecting the result.
    if (Number(req.headers['x-stainless-retry-count'] || 0) > 0) {
      fail(409, 'automatic_retry_disabled')

      return
    }

    const cancelled = new AbortController()
    const disconnect = () => { if (!res.writableEnded) cancelled.abort() }
    res.once('close', disconnect)
    try {
      let body: any

      if (completion || connector) {
        if (!String(req.headers['content-type']).startsWith('application/json')) {
          fail(415, 'json_required')

          return
        }

        let size = 0
        const chunks: Buffer[] = []

        for await (const chunk of req) {
          size += chunk.length

          if (size > (connector ? 24_000 : 512_000)) {
            fail(413, 'request_too_large')

            return
          }

          chunks.push(Buffer.from(chunk))
        }

        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          fail(400, 'invalid_json')

          return
        }
      }

      // Pin this runtime once. managedRequest revalidates status AND the pinned
      // owner on every call; a second status round-trip here adds no protection.
      if (!owner || connector) {
        const view = await account.status()
        if (view.state !== 'signed_in' || !view.account) {
          throw new AccountError('inference_not_enabled')
        }
        owner ??= view.account.userId
        if (owner !== view.account.userId) {
          throw new AccountError('restart_after_account_switch')
        }
      }

      if (connector) {
        if (!account.connectorRequest) {throw new AccountError('connector_service_unavailable')}
        res.end(JSON.stringify(await account.connectorRequest(body, owner)))
        return
      }
      cancelled.signal.throwIfAborted()
      const result = await account.managedRequest(models ? 'models' : 'completion', body, randomUUID(), owner, cancelled.signal)

      if (result instanceof Response) {
        if (!completion || body?.stream !== true || !result.body || !result.headers.get('content-type')?.startsWith('text/event-stream')) {
          await result.body?.cancel()
          throw new AccountError('invalid_response')
        }
        const reader = result.body.getReader()
        const disconnected = () => { void reader.cancel().catch(() => {}) }
        res.once('close', disconnected)
        res.setHeader('Content-Type', 'text/event-stream')
        res.flushHeaders()
        let size = 0
        let pending = '', completed = false, failed = false
        const decoder = new TextDecoder('utf-8', { fatal: true })
        try {
          for (;;) {
            const part = await reader.read()
            if (part.done || res.destroyed) break
            size += part.value.length
            if (size > 2_000_000) throw new AccountError('invalid_response')
            pending = (pending + decoder.decode(part.value, { stream: true })).replace(/\r\n/g, '\n')
            let boundary: number
            while ((boundary = pending.indexOf('\n\n')) >= 0) {
              const frame = pending.slice(0, boundary)
              pending = pending.slice(boundary + 2)
              const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
              if (data === '[DONE]') completed = true
              else if (data) { const value = JSON.parse(data); if (value.error) failed = true }
            }
            if (!res.write(part.value)) await new Promise<void>(resolve => {
              const ready = () => { res.off('drain', ready); res.off('close', ready); resolve() }
              res.once('drain', ready); res.once('close', ready)
            })
          }
          if (!res.destroyed && !failed && (!completed || pending.trim() || decoder.decode())) throw new AccountError('invalid_response')
          res.end()
        } finally {
          res.off('close', disconnected)
          await reader.cancel().catch(() => {})
        }
        return
      }

      if (!models && body?.stream === true) {
        // The server completes receipt settlement before releasing a response.
        // Preserve the OpenAI stream contract for the existing Hebri runtime.
        res.setHeader('Content-Type', 'text/event-stream')
        const base = { id: result.id, object: 'chat.completion.chunk', created: result.created, model: result.model }

        const choices = result.choices.map((choice: any) => ({
          index: choice.index,
          delta: {
            ...choice.message,
            ...(choice.message.tool_calls
              ? { tool_calls: choice.message.tool_calls.map((t: any, index: number) => ({ ...t, index })) }
              : {})
          },
          finish_reason: null
        }))

        res.write(`data: ${JSON.stringify({ ...base, choices })}\n\n`)
        res.write(
          `data: ${JSON.stringify({ ...base, choices: result.choices.map((c: any) => ({ index: c.index, delta: {}, finish_reason: c.finish_reason })) })}\n\n`
        )

        if (body.stream_options?.include_usage) {
          res.write(`data: ${JSON.stringify({ ...base, choices: [], usage: result.usage })}\n\n`)
        }

        res.end('data: [DONE]\n\n')
      } else {
        res.end(JSON.stringify(result))
      }
    } catch (error) {
      if (res.destroyed) return
      const code = error instanceof AccountError ? error.code : 'managed_inference_unavailable'

      const status =
        code === 'shared_budget_exhausted'
          ? 402
          : ['request_already_submitted', 'restart_after_account_switch'].includes(code)
            ? 409
            : [
                  'inference_not_enabled',
                  'personal_paid_plan_required',
                  'manual_model_not_in_plan',
                  'developer_access_revoked'
                ].includes(code)
              ? 403
              : code === 'too_many_requests'
                ? 429
                : code === 'managed_inference_unavailable' || code === 'developer_access_unavailable'
                  ? 503
                  : 400

      if (res.headersSent) {
        if (!res.destroyed) res.end(`data: ${JSON.stringify({ error: { message: code, type: 'synapsek_error', code } })}\n\n`)
      } else fail(status, code)
    } finally { res.off('close', disconnect) }
  })

  server.requestTimeout = 200_000
  server.headersTimeout = 10_000
  server.maxConnections = 8
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()

  if (!address || typeof address === 'string') {
    throw new Error('Local inference listener unavailable')
  }

  host = `127.0.0.1:${address.port}`
  server.unref()

  return {
    env: { HEBRI_SYNAPSEK_BRIDGE_URL: `http://${host}/v1`, HEBRI_SYNAPSEK_BRIDGE_TOKEN: secret },
    close: () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  }
}

export async function managedInferenceJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(190_000), ...(init.signal ? [init.signal] : [])]) })
  return readManagedJson(response)
}

/** Older deployed backends return JSON; accept that explicit compatibility path. */
export async function managedInferenceStream(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(190_000), ...(init.signal ? [init.signal] : [])]) })
  if (response.ok && response.headers.get('content-type')?.startsWith('text/event-stream')) return response
  return readManagedJson(response)
}

async function readManagedJson(response: Response) {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new AccountError('invalid_response')
  }

  const chunks: Uint8Array[] = []
  let size = 0

  try {
    for (;;) {
      const part = await reader.read()

      if (part.done) {
        break
      }

      size += part.value.length

      if (size > 2_000_000) {
        throw new AccountError('invalid_response')
      }

      chunks.push(part.value)
    }

    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'))

    if (!response.ok) {
      const codes = [
        'reasoning_required',
        'invalid_completion',
        'idempotency_key_required',
        'shared_budget_exhausted',
        'request_already_submitted',
        'inference_not_enabled',
        'personal_paid_plan_required',
        'request_budget_too_large',
        'model_or_context_unavailable',
        'manual_model_not_in_plan',
        'developer_access_revoked',
        'developer_access_unavailable',
        'too_many_requests',
        'usage_settlement_pending'
      ]

      throw new AccountError(codes.includes(result.code) ? result.code : 'managed_inference_unavailable')
    }

    return result
  } finally {
    await reader.cancel().catch(() => {})
  }
}
