import fs from 'node:fs'

export function listSubdirectories(dirPath) {
  let entries
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

export function listMarkdownFiles(dirPath, { exclude = ['index.md'] } = {}) {
  let entries
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md') && !exclude.includes(e.name))
    .map((e) => e.name)
    .sort()
}

export function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

export function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory()
  } catch {
    return false
  }
}
