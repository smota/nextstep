import React from 'react'

function inline(text) {
  const parts=[], pattern=/(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g; let last=0, match
  while ((match=pattern.exec(text))) { if(match.index>last)parts.push(text.slice(last,match.index)); if(match[2])parts.push(<a key={match.index} href={match[3]} target="_blank" rel="noreferrer">{match[2]}</a>); else if(match[4])parts.push(<strong key={match.index}>{match[4]}</strong>); else parts.push(<em key={match.index}>{match[5]}</em>); last=pattern.lastIndex }
  if(last<text.length)parts.push(text.slice(last)); return parts
}
export default function Markdown({content}) {
  const lines=content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').split(/\r?\n/), nodes=[]; let list=[]
  const flush=()=>{if(list.length){nodes.push(<ul key={`l${nodes.length}`}>{list.map((x,i)=><li key={i}>{inline(x)}</li>)}</ul>);list=[]}}
  lines.forEach((line,i)=>{const item=line.match(/^[-*]\s+(.+)/);if(item){list.push(item[1]);return}flush();const h=line.match(/^(#{1,3})\s+(.+)/);if(h){nodes.push(React.createElement(`h${h[1].length}`,{key:i},inline(h[2])))}else if(line.trim())nodes.push(<p key={i}>{inline(line)}</p>)});flush(); return <article className="markdown-document">{nodes}</article>
}
