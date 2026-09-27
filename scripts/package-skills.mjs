import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { skillInventory } from '../src/integration.mjs'

export const skillNames = ['nxt-application', 'nxt-context', 'nxt-networking', 'nxt-opportunity', 'nxt-review']
const productRoot = path.resolve(import.meta.dirname, '..')
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

export function fileHashes(root) {
  const result = {}
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, item.name)
      if (item.isSymbolicLink()) throw new Error(`Unexpected link in package: ${file}`)
      if (item.isDirectory()) walk(file)
      else result[path.relative(root, file).split(path.sep).join('/')] = hash(fs.readFileSync(file))
    }
  }
  walk(root)
  return result
}

function contained(root, file) {
  const relative = path.relative(root, file)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Reference escapes skill sources: ${file}`)
  if (!fs.statSync(file).isFile() || fs.realpathSync.native(file) !== path.resolve(file)) throw new Error(`Reference must be a regular source file: ${file}`)
}

export function packageSkills({ sourceRoot = path.join(productRoot, 'skills'), outputRoot = path.join(productRoot, '.skill-distribution') } = {}) {
  sourceRoot = fs.realpathSync.native(sourceRoot)
  outputRoot = path.resolve(outputRoot)
  const inventory = skillInventory(sourceRoot, { includeDir: name => name.startsWith('nxt-') })
  if (inventory.invalid.length || inventory.duplicates.length || JSON.stringify(inventory.skills.map(s => s.name).sort()) !== JSON.stringify(skillNames)) throw new Error('Expected exactly five valid Nextstep skills')
  const packages = {}, sources = {}
  for (const name of skillNames) {
    const files = {}, visited = new Map()
    function collect(file, destination) {
      contained(sourceRoot, file)
      if (visited.has(file)) return
      visited.set(file, destination)
      const bytes = fs.readFileSync(file), text = bytes.toString('utf8')
      sources[path.relative(sourceRoot, file).split(path.sep).join('/')] = hash(bytes)
      if (/(?:[A-Za-z]:[\\/]|nextstep-sam|OneDrive|\/Users\/|\/home\/)/i.test(text)) throw new Error(`Personal path or instance in ${file}`)
      const rewritten = text.replace(/(!?\[[^\]]*\]\()([^\s)]+)(\))/g, (match, before, target, after) => {
        if (/^(?:https?:|mailto:|#)/.test(target)) return match
        const [relative, anchor] = target.split('#'), linked = path.resolve(path.dirname(file), decodeURIComponent(relative))
        const referenceRoot = path.join(sourceRoot, 'references')
        if (!linked.startsWith(`${referenceRoot}${path.sep}`)) throw new Error(`Unsupported local dependency: ${target}`)
        const packaged = `references/${path.relative(referenceRoot, linked).split(path.sep).join('/')}`
        collect(linked, packaged)
        const rewrittenPath = path.posix.relative(path.posix.dirname(destination), packaged)
        return `${before}${rewrittenPath}${anchor ? `#${anchor}` : ''}${after}`
      })
      files[destination] = rewritten.replace(/\r\n/g, '\n')
    }
    collect(path.join(sourceRoot, name, 'SKILL.md'), 'SKILL.md')
    packages[name] = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
  }
  const payloads = Object.fromEntries(skillNames.map(name => [name, Object.fromEntries(Object.entries(packages[name]).map(([file, bytes]) => [file, hash(bytes)]))]))
  const manifest = { schemaVersion: 1, sourceHashes: Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))), packages: payloads }
  manifest.digest = hash(JSON.stringify(manifest))
  fs.mkdirSync(outputRoot, { recursive: true })
  if (fs.lstatSync(outputRoot).isSymbolicLink()) throw new Error('Distribution root must not be a link')
  const current = path.join(outputRoot, 'current'), prior = path.join(current, 'manifest.json')
  if (fs.existsSync(prior) && JSON.parse(fs.readFileSync(prior)).digest === manifest.digest && skillNames.every(name => JSON.stringify(fileHashes(path.join(current, name))) === JSON.stringify(payloads[name]))) return { changed: false, current, manifest }
  const stage = path.join(outputRoot, `stage-${crypto.randomUUID()}`)
  fs.mkdirSync(stage)
  for (const [name, files] of Object.entries(packages)) for (const [relative, text] of Object.entries(files)) {
    const file = path.join(stage, name, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text)
  }
  fs.writeFileSync(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  let previous = null
  if (fs.existsSync(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Current distribution must not be a link')
    previous = path.join(outputRoot, `previous-${crypto.randomUUID()}`)
    fs.renameSync(current, previous)
  }
  try { fs.renameSync(stage, current) } catch (error) { if (previous) fs.renameSync(previous, current); throw error }
  return { changed: true, current, previous, manifest }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(packageSkills(), null, 2)) } catch (error) { console.error(error.message); process.exitCode = 1 }
}
