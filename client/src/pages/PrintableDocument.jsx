import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client.js'
import Markdown from '../components/Markdown.jsx'
import { LoadingState, ErrorState } from '../components/AsyncState.jsx'
export default function PrintableDocument(){const {slug,artifact}=useParams(),[params]=useSearchParams(),scope=params.get('scope')==='archive'?'archive':'active',version=params.get('version')||undefined,[doc,setDoc]=useState(),[error,setError]=useState('');useEffect(()=>{api.getDocument(scope,slug,artifact,version).then(setDoc).catch(e=>setError(e.message))},[scope,slug,artifact,version]);if(error)return <ErrorState message={error}/>;if(!doc)return <LoadingState label="Preparing document…"/>;return <div className="print-page"><div className="print-toolbar"><Link to={`/opportunities/${slug}?scope=${scope}`}>← Workspace</Link><button onClick={()=>window.print()}>Print</button></div><Markdown content={doc.content}/><p className="print-note">Secondary fallback: use the browser print dialog.</p></div>}
