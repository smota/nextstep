import fs from 'node:fs'
import path from 'node:path'

export const INDEX_VERSION = 1

function contained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function walk(root, current, records) {
  let entries = []
  try { entries = fs.readdirSync(current, { withFileTypes: true }) } catch { return }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name)
    if (!contained(root, absolute)) continue
    if (entry.isDirectory()) walk(root, absolute, records)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const stat = fs.statSync(absolute)
      records.push({ path: path.relative(root, absolute).split(path.sep).join('/'), size: stat.size, mtimeMs: Math.trunc(stat.mtimeMs) })
    }
  }
}

export function buildManifest(vaultRoot, roots) {
  const records = []
  for (const root of roots) {
    if (contained(vaultRoot, root)) walk(vaultRoot, root, records)
  }
  return records.sort((a, b) => a.path.localeCompare(b.path))
}

export function manifestsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function createDisposableIndex({ vaultRoot, cacheFile, sourceRoots, buildModel, removeFile = file => fs.rmSync(file, { force: true }) }) {
  if (!contained(vaultRoot, cacheFile)) throw new Error('Index path escapes vault root')
  let rebuildRequired = false

  function currentManifest() { return buildManifest(vaultRoot, sourceRoots) }
  function rebuild(manifest = currentManifest()) {
    const model = buildModel()
    const record = { version: INDEX_VERSION, manifest, indexedAt: new Date().toISOString(), model }
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    const temporary = `${cacheFile}.${process.pid}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(record))
    fs.renameSync(temporary, cacheFile)
    rebuildRequired = false
    return { model, state: 'rebuilt', indexedAt: record.indexedAt, manifestEntries: manifest.length }
  }
  function load({ force = false } = {}) {
    const manifest = currentManifest()
    if (!force && !rebuildRequired) {
      try {
        const record = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
        if (record.version === INDEX_VERSION && record.model && manifestsEqual(record.manifest, manifest)) {
          return { model: record.model, state: 'ready', indexedAt: record.indexedAt, manifestEntries: manifest.length }
        }
      } catch { /* A disposable index is rebuilt on absence or corruption. */ }
    }
    return rebuild(manifest)
  }
  function remove() { try { removeFile(cacheFile); rebuildRequired = false; return { state: 'deleted' } } catch { rebuildRequired = true; return { state: 'rebuild_required' } } }
  function state(){return rebuildRequired?'rebuild_required':'ready'}
  return { load, rebuild, remove, currentManifest, state }
}
