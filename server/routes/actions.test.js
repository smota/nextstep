import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { streamRunEvents } from './actions.js'

function response() { return { writes: [], ended: false, write(value){this.writes.push(value)}, end(){this.ended=true} } }

test('SSE ends immediately after a terminal snapshot without registering a listener', () => {
  const runner = new EventEmitter(), req = new EventEmitter(), res = response()
  streamRunEvents({ runner, run: { id: '1', state: 'completed' }, req, res })
  assert.equal(res.ended, true)
  assert.equal(runner.listenerCount('run:1'), 0)
})

test('SSE sends a terminal event, removes its listener, and ends', () => {
  const runner = new EventEmitter(), req = new EventEmitter(), res = response()
  streamRunEvents({ runner, run: { id: '2', state: 'running' }, req, res })
  assert.equal(runner.listenerCount('run:2'), 1)
  runner.emit('run:2', { event: 'completed', run: { id: '2', state: 'completed' } })
  assert.equal(res.ended, true)
  assert.equal(runner.listenerCount('run:2'), 0)
  assert.match(res.writes.at(-1), /event: completed/)
})
