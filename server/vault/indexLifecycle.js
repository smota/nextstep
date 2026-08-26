import { LIFECYCLE_STATUSES } from './lifecycle.js'

const allowed = new Set(LIFECYCLE_STATUSES)
const error = (label, slug, field, message) => Object.assign(new Error(`${label} row for ${slug}: ${message}`), { statusCode: 409, field })
const linesOf = raw => String(raw).split(/(?<=\n)/)

function referencesSlug(line, slug) {
  return [...line.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].some(match => { const parts=match[1].split('/').filter(Boolean);return parts.at(-1)==='index'?parts.at(-2)===slug:parts.at(-1)===slug })
}

function tableCells(line) {
  if (!/^\s*\|/.test(line)) return null
  const end = line.endsWith('\n') ? line.length - 1 : line.length
  const spans = []
  let start = line.indexOf('|') + 1
  let inWiki=false
  for (let i = start; i < end; i++) {
    if(line.slice(i,i+2)==='[['){inWiki=true;i++;continue}
    if(line.slice(i,i+2)===']]'){inWiki=false;i++;continue}
    if (!inWiki && line[i] === '|' && line[i - 1] !== '\\') { spans.push({ start, end: i, value: line.slice(start, i) }); start = i + 1 }
  }
  return spans.length ? spans : null
}
function delimiter(line) { const cells=tableCells(line);return cells?.length>0&&cells.every(cell=>/^\s*:?-{3,}:?\s*$/.test(cell.value)) }
function statusColumn(lines, rowIndex, cells, label, slug) {
  for (let i=rowIndex-1;i>=1;i--) {
    if (!delimiter(lines[i])) { if (lines[i].trim()) break; continue }
    const headers=tableCells(lines[i-1]);if(!headers||headers.length!==cells.length)throw error(label,slug,'schema','ambiguous table schema')
    const hits=headers.map((c,n)=>/^status$/i.test(c.value.trim())?n:-1).filter(n=>n>=0)
    if(hits.length!==1)throw error(label,slug,'schema','ambiguous table schema')
    return hits[0]
  }
  const hits=cells.map((c,n)=>allowed.has(c.value.trim())?n:-1).filter(n=>n>=0)
  if(hits.length!==1)throw error(label,slug,hits.length?'schema':'status','missing structural lifecycle status')
  return hits[0]
}
function structuralSlot(lines,index,label,slug) {
  const line=lines[index],cells=tableCells(line)
  if(cells){const column=statusColumn(lines,index,cells,label,slug),cell=cells[column],status=cell.value.trim();if(!allowed.has(status))throw error(label,slug,'status',`invalid structural lifecycle status: ${status||'(empty)'}`);const offset=cell.value.indexOf(status);return{status,start:cell.start+offset,end:cell.start+offset+status.length}}
  const link=/\[\[[^\]]+\]\]/g,last=[...line.matchAll(link)].find(match=>referencesSlug(match[0],slug))
  if(!last)throw error(label,slug,'reference','missing exact application reference')
  const tailStart=last.index+last[0].length,tail=line.slice(tailStart)
  const grammar=tail.match(/^\s+—\s+([^;\s—]+)(?=;|\s|$)/)
  if(!grammar)throw error(label,slug,'status','missing structural lifecycle status')
  const status=grammar[1];if(!allowed.has(status))throw error(label,slug,'status',`invalid structural lifecycle status: ${status}`)
  const start=tailStart+grammar.index+grammar[0].lastIndexOf(status);return{status,start,end:start+status.length}
}
export function findApplicationIndexRows(raw,slug){const lines=linesOf(raw);return{lines,indexes:lines.map((line,index)=>referencesSlug(line,slug)?index:-1).filter(index=>index>=0)}}
export function locateApplicationIndexRow(raw,slug,label='Application index'){
  const found=findApplicationIndexRows(raw,slug);if(found.indexes.length!==1)throw Object.assign(new Error(`${label} must contain exactly one row for ${slug}; found ${found.indexes.length}`),{statusCode:409,field:'reference'})
  const index=found.indexes[0],slot=structuralSlot(found.lines,index,label,slug);return{...found,index,line:found.lines[index],...slot}
}
export function updateApplicationIndexLifecycle(raw,slug,target,label='Application index'){
  if(!allowed.has(target))throw error(label,slug,'status',`invalid replacement lifecycle status: ${target}`)
  const found=locateApplicationIndexRow(raw,slug,label),line=found.line.slice(0,found.start)+target+found.line.slice(found.end);found.lines[found.index]=line;return found.lines.join('')
}
