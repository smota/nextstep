import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { main, routeNames } from '../src/cli.mjs'
import { COMMAND_CONTRACTS, ERROR_TAXONOMY, commandNames, describeCommand } from '../src/command-catalog.mjs'
import { RECORD_FILES, RECORD_TYPES } from '../src/model.mjs'

const root = path.resolve(import.meta.dirname, '..')
const readDoc = name => fs.readFileSync(path.join(root, 'docs', name), 'utf8')
const cli = readDoc('cli.md')
const dataLayout = readDoc('data-layout.md')
const architecture = readDoc('architecture.md')

const COMMANDS = [
  'model upgrade-preview',
  'model upgrade-apply',
  'action list',
  'action get',
  'action plan',
  'action wait',
  'action unwait',
  'action update',
  'action reschedule',
  'action complete',
  'action cancel',
  'interaction record',
  'outreach record-sent'
]

const NO_INIT = 'There is no new init command. Upgrade does not create a vault.'
const FORGOTTEN = 'A missing token is INVALID_COMMAND before the lock and does not recover. A forgotten token is not --recover-only.'
const BUNDLE = 'Vault schema_version 5 is not a submission-bundle version. Submission bundles stay on their own evidence versions.'
const TORN = 'Lock-free reads, including `model upgrade-preview`, `action list`, `action get`, `pipeline status`, and `readiness`, can observe a torn multi-file read while a locked mutation writes files one at a time. A torn read is not a successful upgrade and is not a reason to create `actions.json`.'
const COMPLETION = 'Completion is an event match or internal evidence. Direction and a clock-usable time are clock classification, not completion evidence.'
const READ_ONLY = '`action list` and `action get` are lock-free, write nothing, and do not create `actions.json`.'
const BACKLINKS = 'Parent career files and generated index pages do not gain action backlinks.'
const UPSERT = '`entity upsert` cannot create or replace an action.'
const HISTORY = 'Historical rows are not rewritten to add direction.'
const SUBMISSION_DIRECTION = 'A supplied direction is INVALID_COMMAND. This command does not set direction and does not feed contact clocks.'
const SHA = /^[a-f0-9]{64}$/
const TOKEN_KEYS = ['schemaVersion', 'vaultSchemaVersion', 'manifestSha256', 'careerFileSha256', 'actionsSha256', 'snapshotAndTransmissionSha256', 'currentIndexSha256', 'auditPrefixSha256', 'ledgerPreimage', 'writeSet']

function toLf(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function sectionByHeading(markdown, heading) {
  const text = toLf(markdown)
  const start = text.indexOf(heading)
  assert.ok(start >= 0, heading)
  const rest = text.slice(start + heading.length)
  const next = rest.search(/\n## /)
  return next === -1 ? rest : rest.slice(0, next)
}

function commandSections(markdown) {
  const sections = new Map()
  for (const part of toLf(markdown).split(/^### /m).slice(1)) {
    const newline = part.indexOf('\n')
    const title = part.slice(0, newline).trim()
    const match = title.match(/^`([^`]+)`$/)
    if (!match) continue
    sections.set(match[1], part.slice(newline + 1))
  }
  return sections
}

function fences(section) {
  const found = []
  const text = toLf(section)
  const re = /```([^\n]*)\n([\s\S]*?)```/g
  for (let match = re.exec(text); match; match = re.exec(text)) found.push({ info: match[1].trim(), body: match[2] })
  return found
}

function jsonFences(section, info) {
  return fences(section).filter(item => item.info === info).map(item => JSON.parse(item.body))
}

function invariantsOf(section) {
  const lines = toLf(section).split('\n')
  const start = lines.indexOf('Invariants:')
  assert.ok(start >= 0, 'missing Invariants')
  const items = []
  for (const line of lines.slice(start + 1)) {
    if (line === '') break
    assert.equal(line.startsWith('- '), true, line)
    items.push(line.slice(2))
  }
  assert.ok(items.length > 0)
  return items
}

function parseInvocation(line) {
  const tokens = line.trim().split(/\s+/)
  assert.equal(tokens[0], 'nextstep', line)
  const words = []
  const flags = []
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.startsWith('--')) {
      flags.push(token.slice(2))
      const next = tokens[index + 1]
      if (next && !next.startsWith('--')) index += 1
    } else {
      assert.equal(token.startsWith('['), false, line)
      words.push(token)
    }
  }
  return { route: words.join(' '), flags }
}

function typesOf(spec) {
  if (spec.type == null) return []
  return Array.isArray(spec.type) ? spec.type : [spec.type]
}

function assertValue(spec, value, key) {
  if (spec.enum) {
    assert.ok(spec.enum.includes(value), key)
    return
  }
  const types = typesOf(spec)
  if (value === null) {
    assert.ok(types.includes('null'), key)
    return
  }
  if (types.includes('array')) {
    assert.ok(Array.isArray(value), key)
    if (spec.minItems != null) assert.ok(value.length >= spec.minItems, key)
    if (spec.items) for (const item of value) assertValue(spec.items, item, key)
    return
  }
  if (types.includes('object')) {
    assert.equal(typeof value, 'object', key)
    assert.equal(Array.isArray(value), false, key)
    if (spec.properties) {
      for (const required of spec.required || []) assert.equal(Object.hasOwn(value, required), true, `${key}.${required}`)
      for (const [childKey, child] of Object.entries(value)) {
        assert.ok(spec.properties[childKey], `${key}.${childKey}`)
        assertValue(spec.properties[childKey], child, `${key}.${childKey}`)
      }
    }
    return
  }
  if (types.includes('string') || ['typed-id', 'date-time', 'sha256', 'absolute-path', 'json-file-or-stdin'].includes(spec.type)) {
    assert.equal(typeof value, 'string', key)
    if (spec.minLength != null) assert.ok(value.length >= spec.minLength, key)
    if (spec.pattern) assert.match(value, new RegExp(spec.pattern), key)
    if (spec.format === 'date') assert.match(value, /^\d{4}-\d{2}-\d{2}$/, key)
    if (spec.format === 'date-time' || spec.type === 'date-time') assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, key)
    return
  }
  assert.fail(`unhandled schema for ${key}`)
}

function assertEnvelope(contract, body) {
  assert.equal(body.schemaVersion, contract.envelope.properties.schemaVersion.const)
  assert.equal(typeof body.requestId, 'string')
  assert.ok(body.requestId.length > 0)
  assert.equal(typeof body.idempotencyKey, 'string')
  assert.ok(body.idempotencyKey.length > 0)
  if (body.actor !== undefined) assert.equal(typeof body.actor, 'string')
  const text = contract.invariants.join('\n')
  if (text.includes('plan rejects expectedRevision')) assert.equal(Object.hasOwn(body, 'expectedRevision'), false)
  if (text.includes('expectedRevision is required')) {
    assert.equal(Number.isInteger(body.expectedRevision), true)
    assert.ok(body.expectedRevision >= 0)
  }
  assert.equal(typeof body.payload, 'object')
  for (const key of contract.payload.required) assert.equal(Object.hasOwn(body.payload, key), true, key)
  for (const [key, value] of Object.entries(body.payload)) {
    const spec = contract.payload.properties[key]
    assert.ok(spec, key)
    assertValue(spec, value, key)
  }
}

function camelToSnake(name) {
  return name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function tornParagraph(markdown) {
  return sectionByHeading(markdown, '## Torn multi-file reads').trim().split('\n\n')[0].replaceAll('\n', ' ').trim()
}

function assertToken(token) {
  assert.deepEqual(Object.keys(token), TOKEN_KEYS)
  assert.equal(token.schemaVersion, 1)
  assert.equal(token.vaultSchemaVersion, 4)
  assert.match(token.manifestSha256, SHA)
  assert.match(token.auditPrefixSha256, SHA)
  const career = RECORD_TYPES.filter(type => type !== 'actions').map(type => RECORD_FILES[type])
  assert.deepEqual(Object.keys(token.careerFileSha256), career)
  for (const digest of Object.values(token.careerFileSha256)) assert.match(digest, SHA)
  assert.equal(token.actionsSha256, null)
  assert.deepEqual(token.snapshotAndTransmissionSha256, {})
  assert.deepEqual(token.currentIndexSha256, {})
  assert.deepEqual(token.ledgerPreimage, { present: false, sha256: null })
  assert.deepEqual(token.writeSet, {
    actionsJson: 'create-empty',
    manifest: 'rewrite-v5',
    projectedIndexSha256: {},
    ledger: 'append-or-replace-record',
    audit: 'append-one-line'
  })
}

test('shipped routes have no init and no downgrade', () => {
  for (const names of [commandNames(), routeNames()]) {
    assert.equal(names.includes('init'), false)
    assert.equal(names.includes('model init'), false)
    assert.equal(names.some(name => name.includes('downgrade')), false)
  }
  assert.equal(COMMAND_CONTRACTS['entity upsert'].payload.properties.type.enum.includes('action'), false)
  assert.equal(Object.hasOwn(COMMAND_CONTRACTS['application-attempt record-submission'].payload.properties, 'direction'), false)
  assert.ok(COMMAND_CONTRACTS['application-attempt record-submission'].invariants.includes(SUBMISSION_DIRECTION))
  assert.deepEqual(COMMAND_CONTRACTS['interaction record'].payload.properties.direction.enum, ['outbound', 'inbound'])
  assert.equal(COMMAND_CONTRACTS['interaction record'].payload.required.includes('direction'), false)
  assert.deepEqual(COMMAND_CONTRACTS['outreach record-sent'].payload.properties.direction.enum, ['outbound', 'inbound'])
})

test('command describe matches the catalog for upgrade and action commands', () => {
  for (const name of COMMANDS) {
    const described = describeCommand(name)
    assert.equal(described.schemaVersion, 1)
    assert.equal(described.status, 'ok')
    assert.equal(described.command, name)
    assert.deepEqual(described.contract, COMMAND_CONTRACTS[name])
    assert.equal(described.errorTaxonomy.VAULT_UPGRADE_REQUIRED, ERROR_TAXONOMY.VAULT_UPGRADE_REQUIRED)
    assert.equal(routeNames().includes(name), true)
  }
  for (const name of ['action list', 'action get']) {
    const contract = describeCommand(name).contract
    assert.equal(contract.mode, 'read-only')
    assert.equal(Object.hasOwn(contract.options, 'input'), false)
    assert.equal(Object.hasOwn(contract.options, 'dry-run'), false)
    assert.equal(Object.hasOwn(contract.options, 'filter'), false)
  }
  assert.deepEqual(Object.keys(describeCommand('action list').contract.options), ['json', 'data-root'])
  const getOptions = describeCommand('action get').contract.options
  assert.deepEqual(Object.keys(getOptions), ['json', 'data-root', 'id'])
  assert.equal(getOptions.id.required, true)
  assert.equal(describeCommand('model upgrade-preview').contract.mode, 'read-only')
  assert.equal(describeCommand('model upgrade-apply').contract.mode, 'mutation')
  assert.deepEqual(describeCommand('model upgrade-apply').contract.payload.required, ['token'])
})

test('docs/cli.md examples match shipped command schemas', () => {
  const sections = commandSections(cli)
  for (const name of COMMANDS) {
    const section = sections.get(name)
    assert.ok(section, name)
    const contract = COMMAND_CONTRACTS[name]
    assert.deepEqual(invariantsOf(section), contract.invariants)
    const inputs = jsonFences(section, 'json command-input')
    const lines = fences(section).filter(item => item.info === 'text').flatMap(item => item.body.split('\n').map(line => line.trim()).filter(Boolean))
    assert.ok(lines.length > 0, name)
    for (const line of lines) {
      const parsed = parseInvocation(line)
      assert.equal(parsed.route, name, line)
      if (parsed.flags.includes('recover-only')) {
        assert.equal(name, 'model upgrade-apply')
        assert.equal(parsed.flags.includes('input'), false)
        assert.equal(parsed.flags.includes('dry-run'), false)
        for (const flag of parsed.flags) assert.ok(['json', 'data-root', 'recover-only'].includes(flag), flag)
      } else if (contract.mode === 'read-only') {
        const allowed = new Set(Object.keys(contract.options))
        for (const flag of parsed.flags) assert.ok(allowed.has(flag), `${name} ${flag}`)
        for (const [key, spec] of Object.entries(contract.options)) if (spec.required) assert.ok(parsed.flags.includes(key), key)
        assert.equal(parsed.flags.includes('input'), false)
      } else {
        for (const flag of parsed.flags) assert.ok(['json', 'data-root', 'input', 'dry-run'].includes(flag), `${name} ${flag}`)
        assert.ok(parsed.flags.includes('input'), name)
      }
    }
    if (contract.mode === 'read-only') assert.equal(inputs.length, 0, name)
    if (contract.examples) {
      assert.ok(inputs.length >= contract.examples.length, name)
      for (let index = 0; index < contract.examples.length; index += 1) assert.deepEqual(inputs[index], contract.examples[index])
    }
    for (const input of inputs) assertEnvelope(contract, input)
  }

  const preview = sections.get('model upgrade-preview')
  const [previewOutput] = jsonFences(preview, 'json command-output')
  assert.equal(previewOutput.schemaVersion, 1)
  assert.equal(previewOutput.status, 'ok')
  assertToken(previewOutput.token)
  assert.deepEqual(jsonFences(preview, 'json vault-upgrade-required')[0], {
    schemaVersion: 4,
    previewCommand: 'model upgrade-preview',
    applyCommand: 'model upgrade-apply'
  })
  assert.deepEqual(jsonFences(preview, 'json pending-journal')[0], { recoverCommand: 'model upgrade-apply --recover-only' })

  const apply = sections.get('model upgrade-apply')
  assert.deepEqual(jsonFences(apply, 'json command-input')[0].payload.token, previewOutput.token)
  const fresh = jsonFences(apply, 'json command-output')[0]
  assert.deepEqual(fresh, {
    schemaVersion: 1,
    requestId: 'upgrade-apply-1',
    status: 'applied',
    changedEntities: [],
    revision: null,
    warnings: [],
    unresolvedEvidence: [],
    nextActions: [],
    recovery: { performed: false, journals: 0 },
    schemaChanged: true
  })
  assert.equal(Object.hasOwn(fresh, 'currentRecovery'), false)
  assert.deepEqual(jsonFences(apply, 'json recover-only')[0], {
    schemaVersion: 1,
    status: 'ok',
    recovery: { performed: false, journals: 0 },
    schemaChanged: false
  })
  const replay = jsonFences(apply, 'json replay')[0]
  assert.deepEqual(replay, {
    replayed: true,
    schemaChanged: true,
    recovery: { performed: false, journals: 0 },
    currentRecovery: { performed: true, journals: 1 }
  })
  assert.equal(replay.currentRecovery.performed, replay.currentRecovery.journals > 0)
  assert.equal(Object.hasOwn(jsonFences(apply, 'json recover-only')[0], 'currentRecovery'), false)

  assert.deepEqual(jsonFences(sections.get('action list'), 'json command-output')[0], { schemaVersion: 1, status: 'ok', actions: [] })
  assert.deepEqual(jsonFences(sections.get('action get'), 'json command-output')[0], { schemaVersion: 1, status: 'ok', action: {} })

  const planInputs = jsonFences(sections.get('action plan'), 'json command-input')
  assert.equal(planInputs[1].payload.category, 'internal')
  assert.equal(Object.hasOwn(planInputs[1].payload, 'expectedKind'), false)
  assert.deepEqual(planInputs[1].payload.subjects, [{ type: 'person', id: 'person:example' }])
  assert.equal(planInputs[0].payload.category, planInputs[0].payload.category.toLowerCase())
  assert.equal(planInputs[0].payload.expectedKind, planInputs[0].payload.expectedKind.toLowerCase())

  const completeInputs = jsonFences(sections.get('action complete'), 'json command-input')
  assert.equal(Object.hasOwn(completeInputs[1].payload, 'interactionId'), false)
  assert.equal(completeInputs[1].payload.result.length > 0, true)

  const recorded = jsonFences(sections.get('interaction record'), 'json command-input')[0]
  const kindList = COMMAND_CONTRACTS['interaction record'].invariants.join(' ').match(/contact kinds ([^.]+)\./)[1]
  const kinds = kindList.replace(/ and /g, '').split(',').map(item => item.trim())
  assert.ok(kinds.includes(recorded.payload.record.kind))
  assert.equal(Object.hasOwn(recorded.payload.record, 'direction'), false)
  assert.ok(COMMAND_CONTRACTS['interaction record'].payload.properties.direction.enum.includes(recorded.payload.direction))
  assert.equal(jsonFences(sections.get('outreach record-sent'), 'json command-input')[0].payload.direction, 'outbound')

  const mapText = COMMAND_CONTRACTS['action plan'].invariants.find(item => item.startsWith('Payload fields are camelCase:'))
  const payloadNames = mapText.slice('Payload fields are camelCase: '.length).split('. Stored fields')[0].split(', ')
  const rows = []
  for (const line of sectionByHeading(cli, '## Payload field map').split(/^### /m)[0].split('\n')) {
    const match = line.match(/^\| `([A-Za-z]+)` \| `([a-z_]+)` \|$/)
    if (match) rows.push([match[1], match[2]])
  }
  assert.deepEqual(rows.map(row => row[0]), payloadNames)
  assert.deepEqual(rows.map(row => row[1]), payloadNames.map(camelToSnake))
})

test('operator docs state upgrade, read-only, clock, and torn-read limits', () => {
  const noDowngrade = COMMAND_CONTRACTS['model upgrade-preview'].invariants.find(item => item.startsWith('No downgrade command exists.'))
  assert.equal(COMMAND_CONTRACTS['model upgrade-apply'].invariants.includes(noDowngrade), true)
  for (const doc of [cli, dataLayout, architecture]) {
    assert.ok(doc.includes(noDowngrade))
    assert.ok(doc.includes(NO_INIT))
    assert.ok(doc.includes(FORGOTTEN))
    assert.ok(doc.includes(BUNDLE))
    assert.equal(tornParagraph(doc), TORN)
    assert.equal(doc.includes('/home/'), false)
    assert.equal(doc.includes('/Users/'), false)
  }
  assert.ok(cli.includes(ERROR_TAXONOMY.VAULT_UPGRADE_REQUIRED))
  assert.ok(cli.includes(ERROR_TAXONOMY.PENDING_JOURNAL))
  assert.ok(cli.includes(COMPLETION))
  assert.ok(architecture.includes(COMPLETION))
  assert.ok(cli.includes(READ_ONLY))
  assert.ok(architecture.includes(READ_ONLY))
  assert.ok(cli.includes(BACKLINKS))
  assert.ok(dataLayout.includes(BACKLINKS))
  assert.ok(architecture.includes(BACKLINKS))
  assert.ok(cli.includes(UPSERT))
  assert.ok(dataLayout.includes(UPSERT))
  assert.ok(cli.includes(HISTORY))
  assert.ok(architecture.includes(HISTORY))
  assert.ok(cli.includes(SUBMISSION_DIRECTION))
  assert.ok(cli.includes('A confirmed conversation or interview completes an action whose expected kind is that kind, including when direction and a clock-usable `occurred_at` are absent.'))
  assert.ok(architecture.includes('A confirmed conversation or interview completes an action whose expected kind is that kind, including when direction and a clock-usable `occurred_at` are absent.'))
  for (const type of RECORD_TYPES) assert.ok(dataLayout.includes(RECORD_FILES[type]), RECORD_FILES[type])
  assert.equal(RECORD_TYPES.length, 9)
  assert.equal(RECORD_TYPES.at(-1), 'actions')
  assert.ok(dataLayout.includes('`schema_version` 5'))
  assert.ok(dataLayout.includes('counts.actions'))
  assert.ok(dataLayout.includes('`actions.json` is the ninth collection.'))
  assert.ok(dataLayout.includes('only after the explicit upgrade'))
  assert.ok(dataLayout.includes('only after `model upgrade-preview` and `model upgrade-apply`'))
  assert.ok(dataLayout.includes('The product does not load legacy collection names or initialize an older model at runtime.'))
  assert.ok(dataLayout.includes('Ordinary commands on a consistent `schema_version` 4 vault fail with `VAULT_UPGRADE_REQUIRED` and write nothing.'))
  assert.ok(cli.includes('until the operator runs `model upgrade-preview` and then `model upgrade-apply` with that token'))
  assert.ok(cli.includes('fail with `VAULT_UPGRADE_REQUIRED` and write nothing'))
  assert.ok(architecture.includes('Upgrade is `model upgrade-preview`, then `model upgrade-apply` with that token.'))
  for (const doc of [cli, dataLayout, architecture]) assert.equal(doc.includes('prefer an optional file outside'), false)
})

test('help lists read-only action commands and the upgrade routes', async () => {
  let out = ''
  const code = await main(['--help'], { out: { write(value) { out += value } }, err: { write() {} } })
  assert.equal(code, 0)
  const readOnly = out.slice(0, out.indexOf('Mutations'))
  const mutations = out.slice(out.indexOf('Mutations'))
  assert.match(readOnly, /^ {2}model upgrade-preview$/m)
  assert.match(readOnly, /^ {2}action list$/m)
  assert.match(readOnly, /^ {2}action get --id <action:id>$/m)
  assert.equal(readOnly.includes('action plan'), false)
  assert.match(mutations, /^ {2}action plan\|wait\|unwait\|update\|reschedule\|complete\|cancel --input -$/m)
  assert.match(mutations, /^ {2}model upgrade-apply --input -$/m)
  assert.match(mutations, /^ {2}model upgrade-apply --recover-only$/m)
  assert.equal(/downgrade/.test(out), false)
  assert.equal(/^ {2}init\b/m.test(out), false)
})

test('markdown parsers keep the same contract text for LF and CRLF', () => {
  const lfDoc = toLf(cli)
  const crlfDoc = lfDoc.replace(/\n/g, '\r\n')
  assert.equal(crlfDoc.includes('\r\n'), true)
  assert.equal(/(^|[^\r])\n/.test(crlfDoc), false)

  const lfSections = commandSections(lfDoc)
  const crlfSections = commandSections(crlfDoc)
  assert.deepEqual([...crlfSections.keys()], [...lfSections.keys()])
  assert.equal(sectionByHeading(crlfDoc, '## Torn multi-file reads'), sectionByHeading(lfDoc, '## Torn multi-file reads'))
  assert.equal(tornParagraph(crlfDoc), TORN)
  assert.equal(tornParagraph(lfDoc), TORN)

  for (const name of COMMANDS) {
    const lfSection = lfSections.get(name)
    const raw = lfSection.replace(/\n/g, '\r\n')
    assert.ok(raw.split('\n').includes('Invariants:\r'), name)
    assert.equal(raw.split('\n').includes('Invariants:'), false, name)
    const parsed = invariantsOf(raw)
    assert.deepEqual(parsed, COMMAND_CONTRACTS[name].invariants)
    assert.deepEqual(parsed, invariantsOf(lfSection))
    assert.deepEqual(crlfSections.get(name), lfSection)
    assert.deepEqual(fences(raw), fences(lfSection))
    for (const item of parsed) assert.equal(item.includes('\r'), false, item)
  }

  const preview = lfSections.get('model upgrade-preview')
  const previewCrlf = preview.replace(/\n/g, '\r\n')
  const [output] = jsonFences(previewCrlf, 'json command-output')
  assert.equal(output.schemaVersion, 1)
  assert.equal(output.status, 'ok')
  assertToken(output.token)
  assert.deepEqual(jsonFences(previewCrlf, 'json command-output'), jsonFences(preview, 'json command-output'))
  assert.deepEqual(jsonFences(previewCrlf, 'json vault-upgrade-required'), jsonFences(preview, 'json vault-upgrade-required'))

  const bareCr = preview.replace(/\n/g, '\r')
  assert.equal(bareCr.includes('\n'), false)
  assert.deepEqual(invariantsOf(bareCr), COMMAND_CONTRACTS['model upgrade-preview'].invariants)
  assert.deepEqual(fences(bareCr), fences(preview))
  const [bareOutput] = jsonFences(bareCr, 'json command-output')
  assert.equal(bareOutput.schemaVersion, 1)
  assert.equal(bareOutput.status, 'ok')
  assertToken(bareOutput.token)
  assert.deepEqual(jsonFences(bareCr, 'json command-output'), jsonFences(preview, 'json command-output'))
})
