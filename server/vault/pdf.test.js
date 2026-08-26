import test from 'node:test'
import assert from 'node:assert/strict'
import { pdfDownloadName, renderApplicationPdf, safePdfText } from './pdf.js'

const representative = `---\ntitle: Private candidate notes\nsource_path: C:\\vault\\secret.md\n---\n# Jane Example\n\n**Technology Executive** | [Portfolio](https://example.com)\n\n## Experience\n\n- Led a global platform transformation across 20 markets.\n- Improved delivery reliability and governance.\n\n---\n\n## Selected outcomes\n\n1. Built the operating model.\n2. Scaled multidisciplinary teams.\n\n\\pagebreak\n\n# Covering detail\n\nCafé résumé 👋 with a safe unsupported-glyph fallback.\n`

test('renderer creates a substantive multipage PDF with built-in-font UTF-8 fallback', async () => {
  const pdf = await renderApplicationPdf({ content: representative, artifact: 'cv', slug: 'safe-role', paper: 'A4', style: 'professional' })
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.ok(pdf.length > 2500, `expected substantive output, got ${pdf.length} bytes`)
  assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 2)
  assert.equal(safePdfText('Café résumé 👋'), 'Café résumé ?')
  assert.doesNotMatch(pdf.toString('latin1'), /source_path|secret\.md|C:\\vault/i)
})

test('paper/style variants render and filenames cannot inject headers or paths', async () => {
  const pdf = await renderApplicationPdf({ content: '# Report\n\nCompact.', artifact: 'fitAnalysis', slug: 'role', paper: 'LETTER', style: 'compact' })
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
  const name = pdfDownloadName({ slug: '../../Role\r\nInjected: yes', artifact: 'cv', version: 'cv-follow-up-20260102T030405Z' })
  assert.match(name, /^[A-Za-z0-9._-]+\.pdf$/)
  assert.doesNotMatch(name, /[\\/\r\n:]/)
})

test('renderer rejects malformed options without touching a vault', () => {
  assert.throws(() => renderApplicationPdf({ content: '# Test', artifact: 'cv', slug: 'role', paper: 'LEGAL', style: 'professional' }), /Invalid PDF options/)
  assert.throws(() => renderApplicationPdf({ content: '# Test', artifact: 'cv', slug: 'role', paper: 'A4', style: 'raw-html' }), /Invalid PDF options/)
})
