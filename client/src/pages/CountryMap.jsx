import { buildCountryMapModel, isKeyboardActivation, isMarkerSelected, markerAccessibleLabel } from './countryMapModel.js'

const LAND=[
'M92 117 132 76 216 61 287 91 307 132 277 156 255 200 198 216 151 185 105 171Z',
'M267 232 315 245 347 286 337 347 305 400 280 345 270 289Z',
'M432 116 467 91 531 94 552 124 527 145 491 140 468 159 437 147Z',
'M476 166 535 158 576 199 565 258 593 294 563 375 517 363 489 310 472 245Z',
'M548 117 641 79 744 82 837 126 852 184 798 218 740 205 706 252 647 251 609 211 560 189Z',
'M730 305 783 286 849 317 835 370 768 382 731 349Z',
'M861 345 875 337 884 352 870 362Z'
]
export default function CountryMap({rows,onPick,selected}){
 const model=buildCountryMapModel(rows), unmapped=model.filter(x=>!x.centroid)
 const activate=(event,row)=>{if(event.type==='click'||isKeyboardActivation(event)){event.preventDefault();onPick(row.country,row.applications)}}
 return <div className="country-map-wrap"><svg className="country-map" viewBox="0 0 920 430" role="img" aria-labelledby="country-map-title country-map-desc"><title id="country-map-title">Applications by country</title><desc id="country-map-desc">Interactive world map. The country table below is the authoritative accessible list.</desc><g className="map-land" aria-hidden="true">{LAND.map((d,i)=><path d={d} key={i}/>)}</g>{model.filter(x=>x.centroid).map(row=>{const [x,y]=row.centroid,active=isMarkerSelected(selected,row.country),circumference=2*Math.PI*row.radius;return <g key={row.key} className={`map-marker${active?' is-selected':''}`} role="button" tabIndex="0" aria-pressed={active} aria-label={markerAccessibleLabel(row.country,row.count)} onClick={e=>activate(e,row)} onKeyDown={e=>activate(e,row)}><circle className="map-hit" cx={x} cy={y} r="22"/><circle className="map-total" cx={x} cy={y} r={row.radius}/>{row.closedRatio>0&&<circle className="map-closed" aria-hidden="true" cx={x} cy={y} r={row.radius} fill="none" strokeDasharray={`${row.closedRatio*circumference} ${circumference}`} transform={`rotate(-90 ${x} ${y})`}/>}<text x={x} y={y+4} textAnchor="middle" aria-hidden="true">{row.count}</text></g>})}</svg>{unmapped.length>0&&<p className="map-unmapped"><strong>Not mapped:</strong> {unmapped.map(x=>x.country).join(', ')}. Included in the table below.</p>}<div className="map-legend" aria-hidden="true"><span><i/> Active / total</span><span><i className="closed"/> Proportional closed share</span></div></div>
}
