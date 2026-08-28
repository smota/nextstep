import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

function valueOf(raw) {
  const value = raw.trim()
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) return value.slice(1, -1)
  return value
}

export function parseLocalEnv(source) {
  const values = {}
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator).trim().replace(/^export\s+/, '')
    if (KEY.test(key)) values[key] = valueOf(trimmed.slice(separator + 1))
  }
  return values
}

export function loadLocalEnv({ filePath = path.join(APP_ROOT, '.env'), env = process.env } = {}) {
  let values
  try { values = parseLocalEnv(fs.readFileSync(filePath, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
  const loaded = {}
  for (const [key, value] of Object.entries(values)) {
    if (env[key] === undefined) {
      env[key] = value
      loaded[key] = value
    }
  }
  return loaded
}
