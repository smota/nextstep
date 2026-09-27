import fs from 'node:fs'
import path from 'node:path'
import { integrationLink, skillInventory } from '../../src/integration.mjs'

// Historical installed state, not a supported product installation path.
export function seedWorkspaceSkills({ productRoot, profileRoot, workspaceRoot, ...options }) {
  integrationLink({ productRoot, profileRoot, ...options })
  const file = path.join(profileRoot, 'integration-v1.json'), registry = JSON.parse(fs.readFileSync(file))
  const root = path.join(productRoot, 'skills')
  const links = [
    { id: 'skill-root:workspace', kind: 'skill-root', source: root, destination: path.join(workspaceRoot, '.agents', 'skills') },
    { id: 'support:codex:references', kind: 'skill-support', host: 'codex', name: 'references', source: path.join(root, 'references'), destination: path.join(workspaceRoot, '.codex', 'skills', 'references') },
    ...skillInventory(root).skills.map(({ name }) => ({ id: `skill:codex:${name}`, name, kind: 'skill', host: 'codex', source: path.join(root, name), destination: path.join(workspaceRoot, '.codex', 'skills', name) }))
  ]
  for (const link of links) {
    fs.mkdirSync(path.dirname(link.destination), { recursive: true })
    fs.symlinkSync(link.source, link.destination, 'junction')
    registry.managedLinks.push({ ...link, sourceRealAtLink: fs.realpathSync.native(link.source), rawLinkTarget: fs.readlinkSync(link.destination), ownerInstallationId: registry.installationId, linkType: 'junction' })
  }
  registry.workspaceRoot = workspaceRoot
  fs.writeFileSync(file, JSON.stringify(registry))
  return registry
}
