import PDFDocument from 'pdfkit'
import matter from 'gray-matter'

export const PDF_PAPERS = new Set(['A4', 'LETTER'])
export const PDF_STYLES = new Set(['professional', 'compact'])

const THEMES = {
  professional: { margin: 54, body: 10, lineGap: 2.5, paragraphGap: 7, heading: [21, 14, 11.5], color: '#172033', accent: '#315b7d' },
  compact: { margin: 42, body: 9, lineGap: 1.5, paragraphGap: 4, heading: [18, 12.5, 10.5], color: '#172033', accent: '#315b7d' },
}
const LABELS = { cv: 'CV', coverLetter: 'Cover Letter', fitAnalysis: 'Fit Analysis', interviewPrep: 'Interview Preparation', jobDescription: 'Job Description', companyProfile: 'Company Profile', peopleNotes: 'People Notes', submissionNotes: 'Submission Notes', index: 'Application Overview' }

// PDFKit's built-in Helvetica fonts use WinAnsi. Preserve common punctuation and
// Latin text, and replace unsupported glyphs rather than loading/networking fonts.
export function safePdfText(value) {
  return String(value ?? '').normalize('NFC').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2013/g, '-').replace(/\u2014/g, '--').replace(/\u2026/g, '...').replace(/[^\x09\x0A\x0D\x20-\xFF]/gu, '?')
}

function inline(doc, text, options = {}) {
  const source = safePdfText(text), regex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g
  let at = 0, match, first = true
  const write = (value, attrs = {}) => { if (!value) return; doc.font(attrs.bold ? 'Helvetica-Bold' : attrs.italic ? 'Helvetica-Oblique' : 'Helvetica').fillColor(attrs.link ? '#245b88' : options.color || '#172033').text(value, { ...options, continued: true, link: attrs.link, underline: Boolean(attrs.link), indent: first ? options.indent : 0 }); first = false }
  while ((match = regex.exec(source))) { write(source.slice(at, match.index)); if (match[2]) write(match[2], { link: match[3] }); else if (match[4] || match[5]) write(match[4] || match[5], { bold: true }); else write(match[6] || match[7], { italic: true }); at = regex.lastIndex }
  write(source.slice(at)); doc.text('', { continued: false })
}

function addPageNumbers(doc, theme) {
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    doc.font('Helvetica').fontSize(8).fillColor('#667085').text(`${i + 1} / ${range.count}`, theme.margin, doc.page.height - 30, { width: doc.page.width - theme.margin * 2, align: 'right', lineBreak: false })
  }
}

export function renderApplicationPdf({ content, artifact, slug, version, paper = 'A4', style = 'professional' }) {
  const theme = THEMES[style]
  if (!theme || !PDF_PAPERS.has(paper)) throw new TypeError('Invalid PDF options')
  const parsed = matter(String(content ?? ''))
  // Metadata is deliberately derived only from the allowlisted route identity;
  // frontmatter may contain private workflow fields that must not be published.
  const title = safePdfText(LABELS[artifact] || 'Application Document')
  const subject = `${title} - ${safePdfText(slug)}`
  const doc = new PDFDocument({ size: paper, margins: { top: theme.margin, right: theme.margin, bottom: theme.margin, left: theme.margin }, bufferPages: true, info: { Title: title, Subject: subject, Creator: 'Nextstep' }, autoFirstPage: true })
  const chunks = []
  doc.on('data', chunk => chunks.push(chunk))
  const complete = new Promise((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  doc.fillColor(theme.color).font('Helvetica').fontSize(theme.body).lineGap(theme.lineGap)
  const lines = parsed.content.replace(/\r\n?/g, '\n').split('\n'); let paragraph = []
  const flush = () => { if (!paragraph.length) return; inline(doc, paragraph.join(' ').trim(), { width: doc.page.width - theme.margin * 2, color: theme.color }); doc.moveDown(theme.paragraphGap / theme.body); paragraph = [] }
  for (const raw of lines) {
    const line = raw.trimEnd(), trimmed = line.trim()
    if (!trimmed) { flush(); continue }
    if (/^(?:\f|\\pagebreak|<!--\s*pagebreak\s*-->)$/i.test(trimmed)) { flush(); doc.addPage(); continue }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) { flush(); const level = heading[1].length; doc.moveDown(level === 1 ? .25 : .1).font('Helvetica-Bold').fontSize(theme.heading[level - 1]).fillColor(level === 1 ? theme.accent : theme.color); inline(doc, heading[2], { color: level === 1 ? theme.accent : theme.color }); doc.moveDown(level === 1 ? .3 : .15).fontSize(theme.body); continue }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flush(); const y = doc.y + 2; doc.strokeColor('#aab4c0').lineWidth(.6).moveTo(theme.margin, y).lineTo(doc.page.width - theme.margin, y).stroke(); doc.moveDown(.8); continue }
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/), ordered = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
    if (bullet || ordered) { flush(); const marker = bullet ? '\u2022' : `${ordered[1]}.`; inline(doc, `${marker}  ${bullet ? bullet[1] : ordered[2]}`, { indent: 12, width: doc.page.width - theme.margin * 2 - 12, color: theme.color }); doc.moveDown(.12); continue }
    paragraph.push(trimmed)
  }
  flush()
  addPageNumbers(doc, theme)
  doc.end()
  return complete
}

export function pdfDownloadName({ slug, artifact, version }) {
  const parts = [slug, artifact, version].filter(Boolean).join('-').normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 120)
  return `${parts || 'application-document'}.pdf`
}
