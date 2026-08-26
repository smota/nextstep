import fs from 'node:fs'
import path from 'node:path'
import { PATHS } from './paths.js'

const SETTINGS_PATH = PATHS.settingsPath

const DEFAULT_SETTINGS = {
  permissionMode: 'acceptEdits',
  maxBudgetUsd: Number(process.env.MAX_BUDGET_USD_DEFAULT) || 2.0,
  staleDays: Number(process.env.STALE_DAYS_DEFAULT) || 14,
}

export function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial }
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2))
  return next
}
