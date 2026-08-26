export const narratives=['AI Transformation Leader','Enterprise Architecture Leader','Platform Engineering / Observability Leader','Digital Delivery Governance Leader','Solution / Consulting Director','Operational Excellence / Services Transformation Leader','Life Sciences Technology Leader']
const nullable=v=>String(v||'').trim()||null
export function buildCommandPayload(kind,v,now=new Date().toISOString()){
 switch(kind){
  case'application.setPriority':return{priority:v.priority}
  case'application.setLocation':return{country:nullable(v.country),location:nullable(v.location)}
  case'application.setSource':return{url:nullable(v.url),reference:nullable(v.url)?null:nullable(v.reference)}
  case'application.recordReuseAssessment':return{reviewed:true,note:nullable(v.note),reviewed_at:now}
  case'application.selectDominantNarrative':return{narrative:v.narrative}
  case'application.recordSubmission':return{occurredAt:nullable(v.occurredAt),channel:v.channel.trim(),note:nullable(v.note),artifactVersions:{}}
  case'application.recordEmployerResponse':return{responseType:v.responseType,occurredAt:v.occurredAt,note:nullable(v.note),lifecycleTarget:nullable(v.lifecycleTarget)}
  case'application.recordInterview':return{occurredAt:v.occurredAt,interviewType:v.interviewType,outcome:nullable(v.outcome),note:nullable(v.note),lifecycleTarget:nullable(v.lifecycleTarget)}
  case'application.addNote':return{note:v.note.trim()}
  case'application.repairRecord':if(!['metadata','index'].includes(v.target))throw new Error('Choose the missing record to repair');return{target:v.target}
  default:throw new Error('Unsupported update type')
 }
}
