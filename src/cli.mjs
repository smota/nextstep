import fs from 'node:fs'
import process from 'node:process'
import { resolvePaths } from './config.mjs'
import { adoptArtifact, artifactStatus, bootstrapSnapshots, buildContext, capabilities, checkArtifactContract, closeApplication, commandDescription, createExperiment, createStrategy, doctor, evaluateExperiment, evaluateStrategy, get, getExperiment, getStrategy, getStrategyDefinition, listExperiments, listStrategies, listStrategyDefinitions, readiness, reconcileSubmission, recordArtifactQuality, recordInteraction, recordOpportunityDecision, recordOutreachSent, recordRunManifest, recordSubmission, registerApplicationPackage, registerArtifact, runList, setExperimentStatus, setStrategyStatus, strategyGuide, submissionPlan, updateExperiment, updateStrategy, upsertEntity, validate, workflowTemplate, workflowTemplates } from './commands.mjs'

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
  ['command describe', ['json', 'command']],
  ['doctor', ['json', 'data-root']],
  ['workflow templates', ['json', 'category']],
  ['workflow template', ['json', 'id']],
  ['context build', ['json', 'data-root', 'intent', 'subject', 'task', 'budget', 'strategy']],
  ['get', ['json', 'data-root', 'id']],
  ['validate', ['json', 'data-root', 'scope']],
  ['readiness', ['json', 'data-root', 'intent', 'subject']],
  ['entity upsert', ['json', 'data-root', 'input']],
  ['strategy definitions', ['json', 'category']],
  ['strategy definition', ['json', 'id']],
  ['strategy list', ['json', 'data-root', 'status', 'definition', 'subject']],
  ['strategy get', ['json', 'data-root', 'id']],
  ['strategy guide', ['json', 'data-root', 'id', 'phase', 'subject']],
  ['strategy evaluate', ['json', 'data-root', 'id']],
  ['strategy create', ['json', 'data-root', 'input']],
  ['strategy update', ['json', 'data-root', 'input']],
  ['strategy set-status', ['json', 'data-root', 'input']],
  ['experiment list', ['json', 'data-root', 'status', 'strategy']],
  ['experiment get', ['json', 'data-root', 'id']],
  ['experiment evaluate', ['json', 'data-root', 'id']],
  ['experiment create', ['json', 'data-root', 'input']],
  ['experiment update', ['json', 'data-root', 'input']],
  ['experiment set-status', ['json', 'data-root', 'input']],
  ['artifact status', ['json', 'data-root', 'artifact', 'application-attempt', 'all']],
  ['artifact contract-check', ['json', 'data-root', 'artifact', 'template']],
  ['artifact register', ['json', 'data-root', 'input']],
  ['artifact adopt', ['json', 'data-root', 'input']],
  ['artifact record-qa', ['json', 'data-root', 'input']],
  ['artifact bootstrap-snapshots', ['json', 'data-root', 'input']],
  ['interaction record', ['json', 'data-root', 'input']],
  ['opportunity record-decision', ['json', 'data-root', 'input']],
  ['outreach record-sent', ['json', 'data-root', 'input']],
  ['application-attempt register-package', ['json', 'data-root', 'input']],
  ['application-attempt submission-plan', ['json', 'data-root', 'id']],
  ['application-attempt record-submission', ['json', 'data-root', 'input']],
  ['application-attempt reconcile-submission', ['json', 'data-root', 'input']],
  ['application-attempt close', ['json', 'data-root', 'input']],
  ['run record', ['json', 'data-root', 'input']],
  ['run list', ['json', 'data-root', 'limit']]
])

export function routeNames() { return [...ROUTES.keys()] }

function validateInvocation(positionals, options) {
  const route = positionals.join(' '), allowed = ROUTES.get(route)
  if (!allowed) throw Object.assign(new Error(`Unknown Nextstep command: ${route || '(none)'}`), { code: 'USAGE' })
  const unexpected = Object.keys(options).filter(key => !allowed.includes(key))
  if (unexpected.length) throw Object.assign(new Error(`Unsupported option for ${route}: --${unexpected[0]}`), { code: 'USAGE' })
}

function help() {
  return `Nextstep 2.0.0

Usage: nextstep <command> [subcommand] [options]

Read-only:
  capabilities --json
  command describe --command <command-name> --json
  doctor --json
  workflow templates [--category <category>]
  workflow template --id <workflow-template:id>
  context build --intent <intent> [--subject <typed-id>] [--task <text>] [--budget small|standard|deep]
  get --id <typed-id>
  validate [--scope structure|all|application-attempt:<id>]
  readiness --intent analyze|outreach|package|submit|close --subject <typed-id>
  strategy definitions [--category <category>]
  strategy definition --id <strategy-definition:id>
  strategy list|get|guide|evaluate
  experiment list|get|evaluate
  artifact status (--artifact <id>|--application-attempt <id>|--all)
  artifact contract-check --artifact <id> --template workflow-template:executive-cv
  application-attempt submission-plan --id <application-attempt:id>
  run list [--limit <1-100>]

Mutations (JSON envelope from stdin by default):
  entity upsert --input -
  strategy create|update|set-status --input -
  experiment create|update|set-status --input -
  artifact register --input -
  artifact adopt --input -
  artifact record-qa --input -
  artifact bootstrap-snapshots --input -
  interaction record --input -
  opportunity record-decision --input -
  outreach record-sent --input -
  application-attempt register-package --input -
  application-attempt record-submission --input -
  application-attempt reconcile-submission --input -
  application-attempt close --input -
  run record --input -

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
    if (p[0] === 'command' && p[1] === 'describe') { io.out.write(`${JSON.stringify(commandDescription(o.command), null, 2)}\n`); return 0 }
    if (p[0] === 'workflow' && p[1] === 'templates') { io.out.write(`${JSON.stringify(workflowTemplates({ category: o.category }), null, 2)}\n`); return 0 }
    if (p[0] === 'workflow' && p[1] === 'template') { io.out.write(`${JSON.stringify(workflowTemplate(o.id), null, 2)}\n`); return 0 }
    if (p[0] === 'strategy' && p[1] === 'definitions') { io.out.write(`${JSON.stringify(listStrategyDefinitions({ category: o.category }), null, 2)}\n`); return 0 }
    if (p[0] === 'strategy' && p[1] === 'definition') { io.out.write(`${JSON.stringify(getStrategyDefinition(o.id), null, 2)}\n`); return 0 }
    const paths = resolvePaths({ dataRoot: o['data-root'] })
    let result
    if (p[0] === 'doctor') result = doctor(paths)
    else if (p[0] === 'context' && p[1] === 'build') result = buildContext(paths, { intent: o.intent, subject: o.subject, task: o.task, budget: o.budget, strategyId: o.strategy })
    else if (p[0] === 'get') result = get(paths, o.id)
    else if (p[0] === 'validate') result = validate(paths, o.scope)
    else if (p[0] === 'readiness') result = readiness(paths, { intent: o.intent, subject: o.subject })
    else if (p[0] === 'entity' && p[1] === 'upsert') result = upsertEntity(paths, readInput(o.input))
    else if (p[0] === 'strategy' && p[1] === 'list') result = listStrategies(paths, { status: o.status, definitionId: o.definition, subject: o.subject })
    else if (p[0] === 'strategy' && p[1] === 'get') result = getStrategy(paths, o.id)
    else if (p[0] === 'strategy' && p[1] === 'guide') result = strategyGuide(paths, { id: o.id, phase: o.phase, subject: o.subject })
    else if (p[0] === 'strategy' && p[1] === 'evaluate') result = evaluateStrategy(paths, o.id)
    else if (p[0] === 'strategy' && p[1] === 'create') result = createStrategy(paths, readInput(o.input))
    else if (p[0] === 'strategy' && p[1] === 'update') result = updateStrategy(paths, readInput(o.input))
    else if (p[0] === 'strategy' && p[1] === 'set-status') result = setStrategyStatus(paths, readInput(o.input))
    else if (p[0] === 'experiment' && p[1] === 'list') result = listExperiments(paths, { status: o.status, strategyId: o.strategy })
    else if (p[0] === 'experiment' && p[1] === 'get') result = getExperiment(paths, o.id)
    else if (p[0] === 'experiment' && p[1] === 'evaluate') result = evaluateExperiment(paths, o.id)
    else if (p[0] === 'experiment' && p[1] === 'create') result = createExperiment(paths, readInput(o.input))
    else if (p[0] === 'experiment' && p[1] === 'update') result = updateExperiment(paths, readInput(o.input))
    else if (p[0] === 'experiment' && p[1] === 'set-status') result = setExperimentStatus(paths, readInput(o.input))
    else if (p[0] === 'artifact' && p[1] === 'status') result = artifactStatus(paths, { artifactId: o.artifact, applicationAttemptId: o['application-attempt'], all: o.all })
    else if (p[0] === 'artifact' && p[1] === 'contract-check') result = checkArtifactContract(paths, { artifactId: o.artifact, templateId: o.template })
    else if (p[0] === 'artifact' && p[1] === 'register') result = registerArtifact(paths, readInput(o.input))
    else if (p[0] === 'artifact' && p[1] === 'adopt') result = adoptArtifact(paths, readInput(o.input))
    else if (p[0] === 'artifact' && p[1] === 'record-qa') result = recordArtifactQuality(paths, readInput(o.input))
    else if (p[0] === 'artifact' && p[1] === 'bootstrap-snapshots') result = bootstrapSnapshots(paths, readInput(o.input))
    else if (p[0] === 'interaction' && p[1] === 'record') result = recordInteraction(paths, readInput(o.input))
    else if (p[0] === 'opportunity' && p[1] === 'record-decision') result = recordOpportunityDecision(paths, readInput(o.input))
    else if (p[0] === 'outreach' && p[1] === 'record-sent') result = recordOutreachSent(paths, readInput(o.input))
    else if (p[0] === 'application-attempt' && p[1] === 'register-package') result = registerApplicationPackage(paths, readInput(o.input))
    else if (p[0] === 'application-attempt' && p[1] === 'submission-plan') result = submissionPlan(paths, o.id)
    else if (p[0] === 'application-attempt' && p[1] === 'record-submission') result = recordSubmission(paths, readInput(o.input))
    else if (p[0] === 'application-attempt' && p[1] === 'reconcile-submission') result = reconcileSubmission(paths, readInput(o.input))
    else if (p[0] === 'application-attempt' && p[1] === 'close') result = closeApplication(paths, readInput(o.input))
    else if (p[0] === 'run' && p[1] === 'record') result = recordRunManifest(paths, readInput(o.input))
    else if (p[0] === 'run' && p[1] === 'list') result = runList(paths, { limit: o.limit == null ? undefined : Number(o.limit) })
    else throw Object.assign(new Error('Unknown Nextstep command'), { code: 'USAGE' })
    io.out.write(`${JSON.stringify(result, null, 2)}\n`)
    return result?.status === 'degraded' ? 2 : 0
  } catch (error) {
    io.err.write(`${JSON.stringify({ schemaVersion: 1, status: 'error', error: { code: error.code || 'NEXTSTEP_FAILED', message: error.message, details: error.details } }, null, 2)}\n`)
    return error.code === 'USAGE' ? 64 : 1
  }
}
