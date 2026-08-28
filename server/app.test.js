import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from './app.js'

async function withServer(run) {
  const server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  try {
    const { port } = server.address()
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('backend-only service returns JSON for root and unknown API routes', async () => {
  await withServer(async (base) => {
    for (const pathname of ['/', '/missing', '/api/missing']) {
      const response = await fetch(`${base}${pathname}`)
      assert.equal(response.status, 404)
      assert.match(response.headers.get('content-type'), /^application\/json/)
      assert.deepEqual(await response.json(), { error: 'Route not found' })
    }
  })
})

test('backend-only service suppresses framework identity headers', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/`)
    assert.equal(response.headers.has('x-powered-by'), false)
  })
})
