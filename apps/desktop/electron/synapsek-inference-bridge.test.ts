import { afterEach, expect, it, vi } from 'vitest'

import { AccountError } from './synapsek-account'
import { managedInferenceJson, startSynapsekInferenceBridge } from './synapsek-inference-bridge'

let close: (() => Promise<void>) | undefined
it('propagates Stop before managed response headers arrive', async () => {
  let started!: () => void, stopped!: () => void
  const ready = new Promise<void>(resolve => { started = resolve })
  const aborted = new Promise<void>(resolve => { stopped = resolve })
  const bridge = await startSynapsekInferenceBridge({
    status: async () => ({ state:'signed_in',account:{userId:'qa'} }),
    managedRequest: async (_action,_body,_id,_owner,signal) => {
      expect(signal).toBeInstanceOf(AbortSignal)
      started()
      return new Promise((_resolve,reject) => signal!.addEventListener('abort',()=>{ stopped();reject(signal!.reason) },{once:true}))
    }
  })
  close = bridge.close
  const controller = new AbortController()
  const call = fetch(`${bridge.env.HEBRI_SYNAPSEK_BRIDGE_URL}/chat/completions`, {
    method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${bridge.env.HEBRI_SYNAPSEK_BRIDGE_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({stream:true})
  }).catch(error=>error)
  await ready
  controller.abort()
  await aborted
  expect((await call).name).toBe('AbortError')
})

it.each(['invalid_completion', 'reasoning_required'])('retains %s as a recoverable 400 instead of a service outage', async code => {
  const originalFetch = globalThis.fetch
  const bridge = await startSynapsekInferenceBridge({
    status: async () => ({ state: 'signed_in', account: { userId: 'qa' } }),
    managedRequest: async () => {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code }, { status: 400 })))
      try { return await managedInferenceJson('https://fixture.invalid/completion', {}) }
      finally { vi.stubGlobal('fetch', originalFetch) }
    }
  })
  close = bridge.close
  const response = await originalFetch(`${bridge.env.HEBRI_SYNAPSEK_BRIDGE_URL}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${bridge.env.HEBRI_SYNAPSEK_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stream: false })
  })
  expect(response.status).toBe(400)
  const error = (await response.json()).error
  expect(error.code).toBe(code)
  if (code === 'reasoning_required') expect(error.message).toBe('Reasoning is required and cannot be disabled.')
  vi.unstubAllGlobals()
})

it('cancels the native response reader when the agent disconnects', async () => {
  const cancelled = vi.fn()
  const stream = new ReadableStream<Uint8Array>({ cancel: cancelled })
  const bridge = await startSynapsekInferenceBridge({
    status: async () => ({ state: 'signed_in', account: { userId: 'a' } }),
    managedRequest: async () => new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  })
  close = bridge.close
  const response = await fetch(`${bridge.env.HEBRI_SYNAPSEK_BRIDGE_URL}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${bridge.env.HEBRI_SYNAPSEK_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stream: true })
  })
  await response.body!.cancel()
  await vi.waitFor(() => expect(cancelled).toHaveBeenCalledOnce())
})

it('delivers an upstream chunk over the real loopback socket before generation completes', async () => {
  let upstream!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start(c) { upstream = c } })
  const bridge = await startSynapsekInferenceBridge({
    status: async () => ({ state: 'signed_in', account: { userId: 'a' } }),
    managedRequest: async () => new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  })
  close = bridge.close
  const response = await fetch(`${bridge.env.HEBRI_SYNAPSEK_BRIDGE_URL}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${bridge.env.HEBRI_SYNAPSEK_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stream: true })
  })
  const reader = response.body!.getReader()
  upstream.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"first"},"finish_reason":null}]}\n\n'))
  const first = await reader.read()
  expect(new TextDecoder().decode(first.value)).toContain('first')
  expect(first.done).toBe(false)
  upstream.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); upstream.close()
  let rest = ''
  for (;;) { const part = await reader.read(); if (part.done) break; rest += new TextDecoder().decode(part.value) }
  expect(rest).toContain('[DONE]')
})

it('turns a clean but truncated SSE body into an error, never successful partial tool execution', async () => {
  const bridge = await startSynapsekInferenceBridge({
    status: async () => ({ state: 'signed_in', account: { userId: 'a' } }),
    managedRequest: async () => new Response('data: {"choices":[{"delta":{"tool_calls":[]},"finish_reason":null}]}\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } })
  })
  close = bridge.close
  const response = await fetch(`${bridge.env.HEBRI_SYNAPSEK_BRIDGE_URL}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${bridge.env.HEBRI_SYNAPSEK_BRIDGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stream: true })
  })
  const text = await response.text()
  expect(text).toContain('"error"')
  expect(text).not.toContain('[DONE]')
})
it('keeps connector requests on the owner-pinned native channel and rejects browsers and oversized bodies', async () => {
  let user = 'a'
  const connectorRequest = vi.fn(async () => ({ items: [] }))
  const bridge = await startSynapsekInferenceBridge({
    status: async () => ({ state: 'signed_in', account: { userId: user } }),
    managedRequest: async () => ({}),
    connectorRequest
  })
  close = bridge.close
  const send = (body: unknown, headers = {}) =>
    fetch(`${bridge.env.HEBRI_SYNAPSEK_BRIDGE_URL}/connectors`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bridge.env.HEBRI_SYNAPSEK_BRIDGE_TOKEN}`,
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    })
  expect((await send({}, { Origin: 'https://evil.example' })).status).toBe(401)
  expect((await send({}, { Authorization: 'Bearer wrong' })).status).toBe(401)
  expect((await send({ payload: 'x'.repeat(24_001) })).status).toBe(413)
  expect(connectorRequest).not.toHaveBeenCalled()
  const body = { bitId: 'a', command: { action: 'catalog' } }
  expect((await send(body)).status).toBe(200)
  expect(connectorRequest).toHaveBeenCalledWith(body, 'a')
  user = 'b'
  expect((await send(body)).status).toBe(409)
  expect(connectorRequest).toHaveBeenCalledTimes(1)
})
afterEach(async () => {
  await close?.()
  close = undefined
})

it.each([
  ['inference_not_enabled', 403],
  ['developer_access_revoked', 403],
  ['manual_model_not_in_plan', 403],
  ['shared_budget_exhausted', 402],
  ['too_many_requests', 429],
  ['developer_access_unavailable', 503]
])('preserves the meaning of %s at the authenticated loopback boundary', async (code, status) => {
  const bridge = await startSynapsekInferenceBridge({
    status: async () => ({ state: 'signed_in', account: { userId: 'a' } }),
    managedRequest: async () => {
      throw new AccountError(String(code))
    }
  })

  close = bridge.close

  const response = await fetch(`${bridge.env.HEBRI_SYNAPSEK_BRIDGE_URL}/models`, {
    headers: { Authorization: `Bearer ${bridge.env.HEBRI_SYNAPSEK_BRIDGE_TOKEN}` }
  })

  expect(response.status).toBe(status)
  expect((await response.json()).error.code).toBe(code)
})

it('carries real HTTP tool/usage streams and rejects ambient browsers, retries and cross-account reuse', async () => {
  let user = 'account-a'

  const status = vi.fn(async () => ({ state: 'signed_in', account: { userId: user } }))
  const managedRequest = vi.fn(async (_action: string, _body: unknown, _id: string | undefined, expectedUserId: string | undefined) => {
    // Model the account adapter's per-request ownership enforcement.
    if (expectedUserId !== user) throw new AccountError('restart_after_account_switch')
    return ({
    id: 'gen-test',
    created: 1,
    model: 'test/model',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 't1', type: 'function', function: { name: 'read_file', arguments: '{}' } }]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 }
  }) })

  const bridge = await startSynapsekInferenceBridge({
    status,
    managedRequest
  })

  close = bridge.close
  const url = `${bridge.env.HEBRI_SYNAPSEK_BRIDGE_URL}/chat/completions`

  const headers = {
    Authorization: `Bearer ${bridge.env.HEBRI_SYNAPSEK_BRIDGE_TOKEN}`,
    'Content-Type': 'application/json'
  }

  const send = (extra = {}, payload: unknown = { stream: true, stream_options: { include_usage: true } }) =>
    fetch(url, {
      method: 'POST',
      headers: { ...headers, ...extra },
      body: JSON.stringify(payload)
    })

  expect((await send({ Origin: 'https://evil.example' })).status).toBe(401)
  expect((await send({ Authorization: 'Bearer wrong' })).status).toBe(401)
  expect((await send({ 'x-stainless-retry-count': '1' })).status).toBe(409)
  expect(managedRequest).not.toHaveBeenCalled()
  const response = await send()
  const stream = await response.text()
  expect(stream).toContain('"name":"read_file"')
  expect(stream).toContain('"total_tokens":14')
  expect(stream).toContain('[DONE]')
  expect(managedRequest.mock.calls[0]).toEqual([
    'completion',
    expect.any(Object),
    expect.stringMatching(/^[a-f0-9-]{36}$/),
    'account-a',
    expect.any(AbortSignal)
  ])
  user = 'account-b'
  expect(await (await send()).text()).toContain('restart_after_account_switch')
  expect(managedRequest).toHaveBeenCalledTimes(2)
  user = 'account-a'
  expect((await send({}, { stream: false })).status).toBe(200)
  expect(managedRequest).toHaveBeenCalledTimes(3)
  expect(status).toHaveBeenCalledOnce()
})
