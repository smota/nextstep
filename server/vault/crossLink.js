// Builds the applications<->companies<->people reference graph so the
// intelligence browser can show "referenced by" for each company/person.
export function buildCrossLinks({ applications, companies, people }) {
  const companyBySlug = new Map(companies.map((c) => [c.slug, c]))
  const personBySlug = new Map(people.map((p) => [p.slug, p]))

  for (const company of companies) company.referencedByApplications = []
  for (const person of people) person.referencedByApplications = []

  for (const app of applications) {
    const scope=app.storageScope==='archive'?'archive':'active'
    const reference={slug:app.slug,scope,label:app.role||app.slug,href:/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(app.slug)?`/opportunities/${app.slug}?scope=${scope}`:null}
    const companySlug = app.companyProfile?.slug
    if (app.companyProfile) app.companyProfile.resolved = false
    if (companySlug && companyBySlug.has(companySlug)) {
      app.companyProfile.resolved = true
      companyBySlug.get(companySlug).referencedByApplications.push(reference)
    }

    for (const personRef of app.people) {
      if (personRef.slug && personBySlug.has(personRef.slug)) {
        personBySlug.get(personRef.slug).referencedByApplications.push(reference)
      }
    }
  }
}
