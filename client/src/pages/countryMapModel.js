const CENTROIDS = {
  belgium:[493,151], brazil:[348,306], portugal:[455,177], spain:[468,181], france:[480,166], germany:[501,151], netherlands:[493,139], luxembourg:[491,157], switzerland:[494,169], italy:[509,184], austria:[512,163], 'united kingdom':[466,139], ireland:[450,140], sweden:[510,112], norway:[493,105], denmark:[500,129], finland:[531,105], poland:[530,150], romania:[548,174], greece:[535,196], turkey:[570,199], india:[671,233], china:[725,184], japan:[817,184], singapore:[725,281], australia:[784,352], canada:[215,113], 'united states':[220,184], mexico:[190,231], argentina:[312,374], chile:[281,359], colombia:[267,273], peru:[274,307], 'south africa':[529,349], egypt:[550,226], nigeria:[489,267], kenya:[558,287], 'united arab emirates':[610,232], 'saudi arabia':[588,237], israel:[558,211], qatar:[612,239]
}
const ALIASES={usa:'united states','u.s.':'united states','united states of america':'united states',uk:'united kingdom','u.k.':'united kingdom',england:'united kingdom',brasil:'brazil',uae:'united arab emirates','the netherlands':'netherlands'}
export function normalizeCountry(value=''){const key=String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');return ALIASES[key]||key}
export function countryCentroid(country){return CENTROIDS[normalizeCountry(country)]||null}
export function markerRadius(count){return Math.max(5,Math.min(18,4+Math.sqrt(Math.max(0,Number(count)||0))*2.5))}
export function closedRatio(closed,count){const ratio=Number(closed)/Number(count);return Number.isFinite(ratio)?Math.max(0,Math.min(1,ratio)):0}
export function isMarkerSelected(selected,country){return normalizeCountry(selected)===normalizeCountry(country)}
export function markerAccessibleLabel(country,count){const safe=Math.max(0,Number(count)||0);return `${country}: ${safe} ${safe===1?'application':'applications'}. Show matching opportunities.`}
export function isKeyboardActivation(event){return event?.key==='Enter'||event?.key===' '}
export function buildCountryMapModel(rows=[]){return rows.map((row,index)=>({...row,index,key:normalizeCountry(row.country),centroid:countryCentroid(row.country),radius:markerRadius(row.count),closedRatio:closedRatio(row.closed,row.count)})).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key))}
export { CENTROIDS }
