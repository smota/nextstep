const byId = (a, b) => a.id.localeCompare(b.id)
const uniqueSorted = (values) => [...new Set(values)].sort()
const referenceSlug = value => typeof value==='string'?value:value?.slug
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function inScope(application, scope) {
  const archived = Boolean(application.archived || application.lifecycle?.logicallyArchived)
  return scope === 'all' || (scope === 'archive' ? archived : !archived)
}

function opportunitySummary(app) {
  const scope = app.storageScope === 'archive' ? 'archive' : 'active'
  return { slug: app.slug, scope, label: app.role || app.slug, role: app.role || null, company: app.company || null, href: SAFE_SLUG.test(app.slug) ? `/opportunities/${app.slug}?scope=${scope}` : null, updated: app.updated || null }
}

/** Derived, read-only evidence graph. Edges mean documented co-reference only. */
export function buildNetworkGraph({ applications, companies, people }, { scope = 'active' } = {}) {
  const apps = applications.filter((app) => inScope(app, scope)).sort((a, b) => a.slug.localeCompare(b.slug))
  const appBySlug = new Map(apps.map((app) => [app.slug, app]))
  const companyBySlug = new Map(companies.map((company) => [company.slug, company]))
  const personBySlug = new Map(people.map((person) => [person.slug, person]))
  const nodes = [], edgeEvidence = new Map(), linked = new Set()

  const addEdge = (type, source, target, app, field, sourceLabel) => {
    const key = `${type}:${source}:${target}`
    if (!edgeEvidence.has(key)) edgeEvidence.set(key, { id: key, type, source, target, evidence: new Map() })
    const opportunity = opportunitySummary(app)
    edgeEvidence.get(key).evidence.set(app.slug, { opportunity, artifact: 'metadata', artifactLabel: 'Application metadata', field, sourceLabel, href: opportunity.href, updated: app.updated || null })
    linked.add(source); linked.add(target)
  }

  for (const app of apps) {
    const id = `opportunity:${app.slug}`, summary = opportunitySummary(app)
    nodes.push({ id, type: 'opportunity', slug: app.slug, label: summary.label, href: summary.href, role: app.role, company: app.company, lifecycle: app.status, archived: Boolean(app.archived), updated: app.updated, linkedOpportunities: [summary] })
    const companySlug = app.companyProfile?.resolved && app.companyProfile.slug
    if (companySlug && companyBySlug.has(companySlug)) addEdge('company-application', `company:${companySlug}`, id, app, 'company_profile', 'Company profile link')
    for (const ref of app.people || []) if (ref.slug && personBySlug.has(ref.slug)) {
      addEdge('person-application', `person:${ref.slug}`, id, app, 'people', 'People reference')
      if (companySlug && companyBySlug.has(companySlug)) addEdge('person-company', `person:${ref.slug}`, `company:${companySlug}`, app, 'people + company_profile', 'Co-reference in application metadata')
    }
  }

  for (const company of companies) {
    const opportunities = uniqueSorted((company.referencedByApplications || []).map(referenceSlug).filter((slug) => appBySlug.has(slug))).map(slug=>opportunitySummary(appBySlug.get(slug)))
    nodes.push({ id:`company:${company.slug}`, type:'company', slug:company.slug, label:company.name, href:null, role:null, company:company.name, lifecycle:opportunities.length?'connected':'unconnected', archived:opportunities.length>0&&opportunities.every(o=>appBySlug.get(o.slug).archived), updated:company.updated, linkedOpportunities:opportunities, likelyPriorities:company.risksRedFlags, communicationAngle:company.talkingPoints })
  }
  for (const person of people) {
    const opportunities = uniqueSorted((person.referencedByApplications || []).map(referenceSlug).filter((slug) => appBySlug.has(slug))).map(slug=>opportunitySummary(appBySlug.get(slug)))
    nodes.push({ id:`person:${person.slug}`, type:'person', slug:person.slug, label:person.name, href:null, role:person.role, company:person.company, lifecycle:opportunities.length?'connected':'unconnected', archived:opportunities.length>0&&opportunities.every(o=>appBySlug.get(o.slug).archived), updated:person.updated, linkedOpportunities:opportunities, likelyPriorities:person.likelyPriorities, communicationAngle:person.communicationAngle })
  }

  const edges=[...edgeEvidence.values()].map(edge=>{const evidence=[...edge.evidence.values()].sort((a,b)=>a.opportunity.slug.localeCompare(b.opportunity.slug));return {...edge,evidence,opportunities:evidence.map(x=>x.opportunity.slug),weight:evidence.length}}).sort(byId)
  const unconnectedActiveOpportunities=apps.filter(app=>!app.archived&&!linked.has(`opportunity:${app.slug}`)).map(app=>opportunitySummary(app))
  return { semantics:{edgeMeaning:'Documented application references only',weightMeaning:'Distinct linked opportunity count; not personal closeness',inferredRelationships:false},scope,nodes:nodes.sort(byId),edges,unconnectedActiveOpportunities }
}
