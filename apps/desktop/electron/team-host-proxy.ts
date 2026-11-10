import http from 'node:http'

/** A room relay boundary, never a tunnel to the desktop administration API. */
export function allowedTeamRelay(method: string, raw: string): boolean {
  if (!raw.startsWith('/') || /[%\\#]/.test(raw)) {
    return false
  }

  const [pathname, query = ''] = raw.split('?')

  if (raw.split('?').length > 2) {
    return false
  }

  const params = new URLSearchParams(query)

  for (const [key, value] of params) {
    if (!['since_seq', 'limit'].includes(key) || !/^\d{1,10}$/.test(value)) {
      return false
    }
  }

  if (method !== 'GET' && query) {
    return false
  }

  if (pathname === '/api/team/relay/register') {
    return method === 'POST'
  }

  const match = /^\/api\/team\/relay\/[A-Za-z0-9_-]{1,64}\/(messages|presence|work)(\/([A-Za-z0-9_-]{1,64}))?$/.exec(
    pathname
  )

  if (!match) {
    return false
  }

  if (match[2]) {
    return match[1] === 'work' && method === 'PATCH'
  }

  return method === 'GET' || method === 'POST'
}

export async function startTeamHostProxy(base: string) {
  const backend = new URL(base)

  if (
    backend.protocol !== 'http:' ||
    backend.hostname !== '127.0.0.1' ||
    backend.username ||
    backend.password ||
    backend.pathname !== '/' ||
    backend.search ||
    backend.hash
  ) {
    throw new Error('local_backend_required')
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'GET' && req.url === '/.well-known/hebri-team') {
      res.end(JSON.stringify({ protocol: 'hebri-team/1', access: 'room-invitation', lifetime: 'desktop' }))

      return
    }

    if (
      req.method === 'OPTIONS' &&
      allowedTeamRelay(req.headers['access-control-request-method'] || '', req.url || '')
    ) {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.writeHead(204).end()

      return
    }

    if (!allowedTeamRelay(req.method || '', req.url || '')) {
      res.writeHead(404).end('{"error":"room_route_required"}')

      return
    }

    try {
      const chunks: Buffer[] = []
      let length = 0

      for await (const chunk of req) {
        length += chunk.length

        if (length > 32_768) {
          res.writeHead(413).end('{"error":"request_too_large"}')

          return
        }

        chunks.push(Buffer.from(chunk))
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      // Only the room peer's bearer is forwarded. Never cookies, dashboard
      // credentials, forwarded headers or caller-controlled destination headers.
      if (req.headers.authorization) {
        headers.Authorization = req.headers.authorization
      }

      const upstream = await fetch(new URL(req.url!, backend), {
        method: req.method,
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        body: chunks.length ? Buffer.concat(chunks) : undefined
      })

      const reader = upstream.body?.getReader()
      const output: Uint8Array[] = []
      let total = 0

      if (reader) {
        for (;;) {
          const item = await reader.read()

          if (item.done) {
            break
          }

          total += item.value.length

          if (total > 4_194_304) {
            await reader.cancel()
            throw new Error('response_too_large')
          }

          output.push(item.value)
        }
      }

      res.writeHead(upstream.status).end(Buffer.concat(output))
    } catch {
      if (!res.headersSent) {
        res.writeHead(502)
      }

      res.end('{"error":"host_unavailable"}')
    }
  })

  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.maxConnections = 32
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()

  if (!address || typeof address === 'string') {
    throw new Error('host_unavailable')
  }

  const target = `http://127.0.0.1:${address.port}`

  return {
    target,
    healthy: async () => {
      try {
        // No room is created and no credential is needed. Exercise the same
        // bounded relay path; a retired backend must not remain "ready".
        const response = await fetch(`${target}/api/team/relay/hebri-host-probe/messages?limit=1`, {
          redirect: 'error',
          signal: AbortSignal.timeout(12_000)
        })

        const body = await response.json()

        return (
          (response.status === 404 && body.detail === 'Room not found') ||
          (response.status === 403 && body.detail === 'Invalid or expired relay grant')
        )
      } catch {
        return false
      }
    },
    close: () => {
      server.closeAllConnections()
      server.close()
    }
  }
}
