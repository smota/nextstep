import fs from 'node:fs'
import process from 'node:process'
import { resolvePaths } from './config.mjs'
import { adoptArtifact, artifactStatus, bootstrapSnapshots, buildContext, capabilities, doctor, get, recordInteraction, recordSubmission, registerArtifact, upsertEntity, validate } from './commands.mjs'

function parse(argv) {
  const positionals = [], options = {}
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i]
    if (!value.startsWith('--')) { positionals.push(value); continue }
    const key = value.slice(2)
    if (['json', 'help', 'all'].includes(key)) options[key] = true
    else if (argv[i + 1] == null || argv[i + 1].startsWith('--')) throw Object.assign(new Error(`Missing value for --${key}`), { code: 'USAGE' })
    else options[key] = argv[++i]
  }
  return { positionals, options }
}

function readInput(value) {
  const source = value === '-' || !value ? fs.readFileSync(0, 'utf8') : fs.readFileSync(value, 'utf8')
  try { return JSON.parse(source) } catch { throw Object.assign(new Error('Input must be valid JSON'), { code: 'INVALID_JSON' }) }
}

const ROUTES = new Map([
  ['capabilities', ['json']],
  ['doctor', ['json', 'data-root']],
  ['context build', ['json', 'data-root', 'intent', 'subject', 'task', 'budget']],
  ['get', ['json', 'data-root', 'id']],
  ['validate', ['json', 'data-root', 'scope']],
  ['entity upsert', ['json', 'data-root', 'input']],
  ['artifact status', ['json', 'data-root', 'artifact', 'application', 'all']],
  ['artifact register', ['json', 'data-root', 'input']],
  ['artifact adopt', ['json', 'data-root', 'input']],
  ['artifact bootstrap-snapshots', ['json', 'data-root', 'input']],
  ['interaction record', ['json', 'data-root', 'input']],
  ['application record-submission', ['json', 'data-root', 'input']]
])

function validateInvocation(positionals, options) {
  const route = positionals.join(' '), allowed = ROUTES.get(route)
  if (!allowed) throw Object.assign(new Error(`Unknown Nextstep command: ${route || '(none)'}`), { code: 'USAGE' })
  const unexpected = Object.keys(options).filter(key => !allowed.includes(key))
  if (unexpected.length) throw Object.assign(new Error(`Unsupported option for ${route}: --${unexpected[0]}`), { code: 'USAGE' })
}

function help() {
  return `Nextstep 1.0.0

Usage: nextstep <command> [subcommand] [options]

Read-only:
  capabilities --json
  doctor --json
  context build --intent <intent> [--subject <typed-id>] [--task <text>] [--budget small|standard|deep]
  get --id <typed-id>
  validate [--scope structure|all|application:<id>]
  artifact status (--artifact <id>|--application <id>|--all)

Mutations (JSON envelope from stdin by default):
  entity upsert --input -
  artifact register --input -
  artifact adopt --input -
  artifact bootstrap-snapshots --input -
  interaction record --input -
  application record-submission --input -

Common root options: --data-root <absolute-path> or NEXTSTEP_DATA_ROOT.
Mutation envelope: {"schemaVersion":1,"requestId":"...","idempotencyKey":"...","actor":"...","expectedRevision":0,"payload":{...}}
`
}

export async function main(argv = process.argv.slice(2), io = { out: process.stdout, err: process.stderr }) {
  try {
    const { positionals: p, options: o } = parse(argv)
    if (o.help || !p.length) { io.out.write(help()); return 0 }
    validateInvocation(p, o)
    if (p[0] === 'capabilities') { io.out.write(`${JSON.stringify(capabilities(), null, 2)}\n`); return 0 }
    const paths = resolvePaths({ dataRoot: o['data-root'] })
    let result
    if (p[0] === 'doctor') result = doctor(paths)
    else if (p[0] === 'context' && p[1] === 'build') result = buildContext(paths, { intent: o.intent, subject: o.subject, task: o.task, budget: o.budget })
    else if (p[0] === 'get') result = get(paths, o.id)
    else if (p[0] === 'validate') result = validate(paths, o.scope)
    else if (p[0] === 'entity' && p[1] === 'upsert') result = upsertEntity(paths, readInput(o.input))
    else if (p[0] === 'artifact' && p[1] === 'status') result = artifactStatus(paths, { artifactId: o.artifact, applicationId: o.application, all: o.all })
    else if (p[0] === 'artifact' && p[1] === 'register') result = registerArtifact(paths, readInput(o.input))
    else if (p[0] === 'artifact' && p[1] === 'adopt') result = adoptArtifact(paths, readInput(o.input))
    else if (p[0] === 'artifact' && p[1] === 'bootstrap-snapshots') result = bootstrapSnapshots(paths, readInput(o.input))
    else if (p[0] === 'interaction' && p[1] === 'record') result = recordInteraction(paths, readInput(o.input))
    else if (p[0] === 'application' && p[1] === 'record-submission') result = recordSubmission(paths, readInput(o.input))
    else throw Object.assign(new Error('Unknown Nextstep command'), { code: 'USAGE' })
    io.out.write(`${JSON.stringify(result, null, 2)}\n`)
    return result?.status === 'degraded' ? 2 : 0
  } catch (error) {
    io.err.write(`${JSON.stringify({ schemaVersion: 1, status: 'error', error: { code: error.code || 'NEXTSTEP_FAILED', message: error.message, details: error.details } }, null, 2)}\n`)
    return error.code === 'USAGE' ? 64 : 1
  }
}
