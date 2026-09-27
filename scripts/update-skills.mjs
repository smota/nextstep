import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { packageSkills, skillNames, fileHashes } from './package-skills.mjs'

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function updateSkills({ manager = process.env.SKILLS_MANAGER_CLI || path.join(os.homedir(), '.skills-manager', 'bin', process.platform === 'win32' ? 'skills-manager-cli.exe' : 'skills-manager-cli'), skillsRoot, sourceRoot, outputRoot = path.resolve(import.meta.dirname, '..', '.skill-distribution'), install = false } = {}) {
  outputRoot = path.resolve(outputRoot)
  fs.mkdirSync(outputRoot, { recursive: true })
  const lockFile = path.join(outputRoot, 'update.lock'), lock = fs.openSync(lockFile, 'wx')
  function managerCall(...args) {
    const result = spawnSync(manager, [...(skillsRoot ? ['--skills-root', skillsRoot] : []), '--json', ...args], { encoding: 'utf8', windowsHide: true, timeout: 120000 })
    if (result.error || result.status !== 0) throw new Error(`Skills Manager ${args[0]} ${args[1]} failed: ${result.error?.message || result.stderr}`)
    return JSON.parse(result.stdout)
  }
  try {
    const build = packageSkills({ sourceRoot, outputRoot }), stateFile = path.join(outputRoot, 'sync-state.json')
    const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : { schemaVersion: 1, skills: {} }
    const inventory = managerCall('skills', 'list'), planned = []
    // Check every existing copy before making the first library mutation.
    for (const name of skillNames) {
      const candidates = inventory.filter(item => item.name === name)
      if (candidates.length > 1) throw new Error(`Duplicate library entries for ${name}`)
      const skill = candidates[0], expected = build.manifest.packages[name], prior = state.skills[name]
      const source = path.join(build.current, name)
      if (!skill) {
        if (!install) throw new Error(`${name} is not installed; initial import requires --install`)
        planned.push({ name, source, expected }); continue
      }
      const status = managerCall('skills', 'status', skill.id)
      if (!['local', 'import'].includes(status.source_type) || path.resolve(status.source_ref || '') !== source) throw new Error(`Unexpected source for ${name}; preserve this entry`)
      const actual = fileHashes(status.path)
      if (!equal(actual, expected) && (!prior || prior.id !== skill.id || !equal(actual, prior.files))) throw new Error(`Library drift in ${name}; review edits before updating`)
      for (const agent of status.agents.filter(item => item.deployed)) {
        if (!agent.target_path || !fs.existsSync(agent.target_path) || !equal(fileHashes(agent.target_path), actual)) throw new Error(`Deployment drift in ${name}/${agent.key}; review before updating`)
      }
      planned.push({ name, source, expected, status, changed: !equal(actual, expected) })
    }
    const reports = []
    for (const item of planned) {
      if (!item.status) managerCall('skills', 'install', item.source, '--local')
      else if (item.changed) {
        const reports = managerCall('skills', 'update', item.status.id)
        if (reports.some(report => report.error || report.held_back_removals?.length)) throw new Error(`Update needs review for ${item.name}: ${JSON.stringify(reports)}`)
      }
      const status = managerCall('skills', 'status', item.status?.id || item.name)
      if (!equal(fileHashes(status.path), item.expected)) throw new Error(`Library verification failed for ${item.name}`)
      if (item.status && (!equal(status.preset_ids, item.status.preset_ids) || !equal(status.deployed_to, item.status.deployed_to))) throw new Error(`Membership/deployment changed during update for ${item.name}`)
      for (const agent of status.agents.filter(agent => agent.deployed)) {
        if (!agent.target_path || !equal(fileHashes(agent.target_path), item.expected)) throw new Error(`Deployment verification failed for ${item.name}/${agent.key}`)
      }
      state.skills[item.name] = { id: status.id, source: item.source, files: item.expected }
      const temporary = `${stateFile}.tmp`
      fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`); fs.renameSync(temporary, stateFile)
      reports.push({ name: item.name, id: status.id, changed: !item.status || item.changed, deployedTo: status.deployed_to, verified: true })
    }
    return { status: 'ok', digest: build.manifest.digest, reports }
  } finally { fs.closeSync(lock); fs.unlinkSync(lockFile) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {}
    for (let i = 2; i < process.argv.length; i++) {
      const key = process.argv[i]
      if (key === '--install') options.install = true
      else if (['--manager', '--skills-root'].includes(key) && process.argv[i + 1]) options[key === '--manager' ? 'manager' : 'skillsRoot'] = path.resolve(process.argv[++i])
      else throw new Error(`Unknown or incomplete option: ${key}`)
    }
    console.log(JSON.stringify(updateSkills(options), null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
