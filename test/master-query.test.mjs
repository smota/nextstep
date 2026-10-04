import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogMaster, queryMaster } from '../src/master-query.mjs'

test('normalized match offsets still excerpt the original source', () => {
  const content = '\ufb03'.repeat(100) + ' ' + '\uff34\uff21\uff32\uff27\uff25\uff34' + ' ' + 'end '.repeat(100)
  const result = queryMaster([{ path: 'Master/guide.md', sha256: 'hash', sizeBytes: 999, content }], { query: 'target', maxChars: 30 })
  assert.ok(result.results[0].excerpt.includes('\uff34\uff21\uff32\uff27\uff25\uff34'))
  assert.ok(content.includes(result.results[0].excerpt))
})

test('catalogMaster and queryMaster validate options and inputs with USAGE code', () => {
  // Non-array documents
  assert.throws(() => catalogMaster(null), { code: 'USAGE' })
  assert.throws(() => catalogMaster(undefined), { code: 'USAGE' })
  assert.throws(() => catalogMaster('not-array'), { code: 'USAGE' })
  assert.throws(() => catalogMaster({}), { code: 'USAGE' })

  assert.throws(() => queryMaster(null, { query: 'test' }), { code: 'USAGE' })
  assert.throws(() => queryMaster(undefined, { query: 'test' }), { code: 'USAGE' })
  assert.throws(() => queryMaster('not-array', { query: 'test' }), { code: 'USAGE' })

  // Missing or invalid query
  assert.throws(() => queryMaster([], {}), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: null }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 123 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: true }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: '' }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: '   ' }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: '\t\n ' }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'a'.repeat(201) }), { code: 'USAGE' })

  // Valid query boundary: exactly 200 chars
  const query200 = 'q'.repeat(200)
  assert.doesNotThrow(() => queryMaster([], { query: query200 }))

  // Invalid limit
  assert.throws(() => queryMaster([], { query: 'test', limit: 0 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', limit: -1 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', limit: 51 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', limit: 5.5 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', limit: '10' }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', limit: null }), { code: 'USAGE' })

  // Boundary limits: 1 and 50 are allowed
  assert.doesNotThrow(() => queryMaster([], { query: 'test', limit: 1 }))
  assert.doesNotThrow(() => queryMaster([], { query: 'test', limit: 50 }))

  // Invalid maxChars
  assert.throws(() => queryMaster([], { query: 'test', maxChars: 0 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', maxChars: -1 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', maxChars: 8001 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', maxChars: 100.5 }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', maxChars: '2000' }), { code: 'USAGE' })
  assert.throws(() => queryMaster([], { query: 'test', maxChars: null }), { code: 'USAGE' })

  // Boundary maxChars: 1 and 8000 are allowed
  assert.doesNotThrow(() => queryMaster([], { query: 'test', maxChars: 1 }))
  assert.doesNotThrow(() => queryMaster([], { query: 'test', maxChars: 8000 }))
})

test('Unicode case and NFKC normalization matching', () => {
  const docs = [
    {
      path: 'Master/Guides/Unicode.md',
      sha256: 'hash-unicode',
      sizeBytes: 250,
      content: 'This document discusses CAFÉ culture, ελληνικα terms, and fullwidth ＦＵＬＬ text along with ligatures like ﬁle and decomposed e\u0301.'
    }
  ]

  // Accented characters case-insensitive
  const res1 = queryMaster(docs, { query: 'café' })
  assert.equal(res1.totalMatches, 1)

  // Uppercase accented query
  const res2 = queryMaster(docs, { query: 'CAFÉ' })
  assert.equal(res2.totalMatches, 1)

  // Greek characters case-insensitive
  const res3 = queryMaster(docs, { query: 'ΕΛΛΗΝΙΚΑ' })
  assert.equal(res3.totalMatches, 1)

  // Full-width characters normalized to ASCII
  const res4 = queryMaster(docs, { query: 'full' })
  assert.equal(res4.totalMatches, 1)

  // Full-width query matching ASCII
  const res5 = queryMaster(docs, { query: 'ＦＵＬＬ' })
  assert.equal(res5.totalMatches, 1)

  // Ligature matching
  const res6 = queryMaster(docs, { query: 'file' })
  assert.equal(res6.totalMatches, 1)

  // Decomposed character matching precomposed in query
  const res7 = queryMaster(docs, { query: '\u00e9' })
  assert.equal(res7.totalMatches, 1)
})

test('literal regex characters are treated as plain text without regex evaluation', () => {
  const docs = [
    {
      path: 'Master/Tech/C++.md',
      sha256: 'hash-cpp',
      sizeBytes: 150,
      content: 'Guide to C++ programming and pointers [Draft] (v1.0) with cost: $100 and pattern foo.bar with ^start and end$.'
    },
    {
      path: 'Master/Tech/Other.md',
      sha256: 'hash-other',
      sizeBytes: 120,
      content: 'Another file mentioning foo-bar and C# but not the plus plus symbol.'
    }
  ]

  // Metacharacter + (would fail or mean repetition in regex)
  const resPlus = queryMaster(docs, { query: 'C++' })
  assert.equal(resPlus.totalMatches, 1)
  assert.equal(resPlus.results[0].path, 'Master/Tech/C++.md')

  // Metacharacters [ ] (character class in regex)
  const resBrackets = queryMaster(docs, { query: '[Draft]' })
  assert.equal(resBrackets.totalMatches, 1)
  assert.equal(resBrackets.results[0].path, 'Master/Tech/C++.md')

  // Metacharacters ( ) (grouping in regex)
  const resParens = queryMaster(docs, { query: '(v1.0)' })
  assert.equal(resParens.totalMatches, 1)

  // Metacharacters $ and ^ (anchors in regex)
  const resAnchors = queryMaster(docs, { query: '$100 ^start end$' })
  assert.equal(resAnchors.totalMatches, 1)

  // Literal dot must NOT match hyphen: foo.bar matches only foo.bar, not foo-bar
  const resDot = queryMaster(docs, { query: 'foo.bar' })
  assert.equal(resDot.totalMatches, 1)
  assert.equal(resDot.results[0].path, 'Master/Tech/C++.md')
})

test('multi-term content and path matching across whitespace tokens', () => {
  const docs = [
    {
      path: 'Master/Engineering/Staff-Architect.md',
      sha256: 'hash-arch',
      sizeBytes: 300,
      content: '# Staff Architecture\n\nLeadership principles, distributed systems design, and mentorship strategies.'
    },
    {
      path: 'Master/Engineering/Junior-Developer.md',
      sha256: 'hash-junior',
      sizeBytes: 200,
      content: '# Junior Onboarding\n\nBasic coding standards, version control workflows, and unit testing.'
    }
  ]

  // Token 1 in path ("Staff-Architect" -> "staff"), Token 2 in content ("distributed")
  const resMulti = queryMaster(docs, { query: 'Staff distributed' })
  assert.equal(resMulti.totalMatches, 1)
  assert.equal(resMulti.results[0].path, 'Master/Engineering/Staff-Architect.md')

  // Multiple tokens with whitespace: "Master   Engineering   mentorship"
  const resSpaces = queryMaster(docs, { query: '  Master   Engineering   mentorship  ' })
  assert.equal(resSpaces.totalMatches, 1)
  assert.equal(resSpaces.results[0].path, 'Master/Engineering/Staff-Architect.md')

  // Tokens spanning path and content
  const resPathAndContent = queryMaster(docs, { query: 'Architect systems' })
  assert.equal(resPathAndContent.totalMatches, 1)

  // Missing term prevents match (AND semantics)
  const resMissing = queryMaster(docs, { query: 'Staff distributed nonexistentterm' })
  assert.equal(resMissing.totalMatches, 0)
  assert.equal(resMissing.results.length, 0)
})

test('hash provenance and document metadata are preserved', () => {
  const docs = [
    {
      path: 'Master/Evidence/Proven.md',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      sizeBytes: 4096,
      content: '# Proven Record\n\nAuthentic evidence with verified hash.'
    }
  ]

  // In catalogMaster
  const catalog = catalogMaster(docs)
  assert.equal(catalog.count, 1)
  assert.equal(catalog.documents[0].path, 'Master/Evidence/Proven.md')
  assert.equal(catalog.documents[0].sha256, '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')
  assert.equal(catalog.documents[0].sizeBytes, 4096)
  assert.equal(catalog.documents[0].title, 'Proven Record')

  // In queryMaster
  const queryRes = queryMaster(docs, { query: 'evidence' })
  assert.equal(queryRes.totalMatches, 1)
  const result = queryRes.results[0]
  assert.equal(result.path, 'Master/Evidence/Proven.md')
  assert.equal(result.sha256, '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')
  assert.equal(result.sizeBytes, 4096)
  assert.equal(result.title, 'Proven Record')
})

test('limit and maxChars bounding and excerpt centering', () => {
  const docs = [
    { path: 'Master/A.md', sha256: 'h-a', sizeBytes: 10, content: 'Keyword in A' },
    { path: 'Master/B.md', sha256: 'h-b', sizeBytes: 10, content: 'Keyword in B' },
    { path: 'Master/C.md', sha256: 'h-c', sizeBytes: 10, content: 'Keyword in C' },
    { path: 'Master/D.md', sha256: 'h-d', sizeBytes: 10, content: 'Keyword in D' },
    { path: 'Master/E.md', sha256: 'h-e', sizeBytes: 10, content: 'Keyword in E' }
  ]

  // Limit restricts results but totalMatches reflects total
  const resLimit2 = queryMaster(docs, { query: 'Keyword', limit: 2 })
  assert.equal(resLimit2.totalMatches, 5)
  assert.equal(resLimit2.results.length, 2)
  assert.equal(resLimit2.results[0].path, 'Master/A.md')
  assert.equal(resLimit2.results[1].path, 'Master/B.md')

  // Limit 1
  const resLimit1 = queryMaster(docs, { query: 'Keyword', limit: 1 })
  assert.equal(resLimit1.totalMatches, 5)
  assert.equal(resLimit1.results.length, 1)

  // Default limit 10 returns all 5
  const resDefaultLimit = queryMaster(docs, { query: 'Keyword' })
  assert.equal(resDefaultLimit.results.length, 5)

  // Excerpt length within maxChars without truncation
  const shortDoc = [{ path: 'Master/Short.md', sha256: 'h-s', sizeBytes: 25, content: 'Brief keyword match here.' }]
  const resShort = queryMaster(shortDoc, { query: 'keyword', maxChars: 100 })
  assert.equal(resShort.results[0].truncated, false)
  assert.equal(resShort.results[0].excerpt, 'Brief keyword match here.')

  // Excerpt length bounded by maxChars with truncation and centering
  const prefix = 'Introductory padding text. '.repeat(40) // ~1080 chars
  const suffix = ' Concluding padding text.'.repeat(40) // ~1000 chars
  const target = 'TARGET_PHRASE'
  const longContent = prefix + target + suffix
  const longDoc = [{ path: 'Master/Long.md', sha256: 'h-l', sizeBytes: longContent.length, content: longContent }]

  const resLong = queryMaster(longDoc, { query: 'TARGET_PHRASE', maxChars: 200 })
  assert.equal(resLong.results[0].truncated, true)
  assert.ok(resLong.results[0].excerpt.length <= 200)
  assert.ok(resLong.results[0].excerpt.includes('TARGET_PHRASE'))

  // Boundary maxChars: 1
  const resBoundary1 = queryMaster(longDoc, { query: 'TARGET_PHRASE', maxChars: 1 })
  assert.equal(resBoundary1.results[0].excerpt.length, 1)
  assert.equal(resBoundary1.results[0].truncated, true)

  // Boundary maxChars: 8000
  const resBoundary8000 = queryMaster(longDoc, { query: 'TARGET_PHRASE', maxChars: 8000 })
  assert.equal(resBoundary8000.results[0].truncated, false)
  assert.equal(resBoundary8000.results[0].excerpt, longContent)
})

test('catalogMaster omits body content and extracts titles accurately', () => {
  const docs = [
    {
      path: 'Master/Guides/Frontmatter.md',
      sha256: 'h-fm',
      sizeBytes: 150,
      content: '---\ntitle: Frontmatter Custom Title\ncategory: guide\n---\n# Unused Heading\n\nBody content.'
    },
    {
      path: 'Master/Guides/H1Heading.md',
      sha256: 'h-h1',
      sizeBytes: 120,
      content: '# Leading Heading\n\nBody content of H1 guide.'
    },
    {
      path: 'Master/Guides/H2Heading.md',
      sha256: 'h-h2',
      sizeBytes: 110,
      content: '## Secondary Section\n\nBody with no H1.'
    },
    {
      path: 'Master/Guides/Fallback-Naming.md',
      sha256: 'h-fb',
      sizeBytes: 50,
      content: 'No markdown headings at all in this document.'
    },
    {
      path: 'Master/Guides/Pretitled.md',
      sha256: 'h-pt',
      sizeBytes: 80,
      title: 'Explicit Title Provided',
      content: 'Ignored content.'
    }
  ]

  const catalog = catalogMaster(docs)
  assert.equal(catalog.schemaVersion, 1)
  assert.equal(catalog.count, 5)

  for (const doc of catalog.documents) {
    assert.equal(doc.content, undefined)
    assert.equal('content' in doc, false)
    assert.ok(typeof doc.path === 'string')
    assert.ok(typeof doc.sha256 === 'string')
    assert.ok(typeof doc.sizeBytes === 'number')
    assert.ok(typeof doc.title === 'string')
  }

  const titles = Object.fromEntries(catalog.documents.map(d => [d.path, d.title]))
  assert.equal(titles['Master/Guides/Frontmatter.md'], 'Frontmatter Custom Title')
  assert.equal(titles['Master/Guides/H1Heading.md'], 'Leading Heading')
  assert.equal(titles['Master/Guides/H2Heading.md'], 'Secondary Section')
  assert.equal(titles['Master/Guides/Fallback-Naming.md'], 'Fallback-Naming')
  assert.equal(titles['Master/Guides/Pretitled.md'], 'Explicit Title Provided')
})

test('deterministic path ordering regardless of input sequence', () => {
  const docA = { path: 'Master/01-Alpha.md', sha256: 'h-1', sizeBytes: 10, content: 'Common term alpha' }
  const docB = { path: 'Master/02-Beta.md', sha256: 'h-2', sizeBytes: 10, content: 'Common term beta' }
  const docC = { path: 'Master/03-Gamma.md', sha256: 'h-3', sizeBytes: 10, content: 'Common term gamma' }

  // Scrambled input order 1: C, A, B
  const catalog1 = catalogMaster([docC, docA, docB])
  assert.deepEqual(catalog1.documents.map(d => d.path), [
    'Master/01-Alpha.md',
    'Master/02-Beta.md',
    'Master/03-Gamma.md'
  ])

  // Scrambled input order 2: B, C, A
  const catalog2 = catalogMaster([docB, docC, docA])
  assert.deepEqual(catalog2.documents.map(d => d.path), [
    'Master/01-Alpha.md',
    'Master/02-Beta.md',
    'Master/03-Gamma.md'
  ])

  // Reverse input order in queryMaster
  const queryRes = queryMaster([docC, docB, docA], { query: 'Common term' })
  assert.deepEqual(queryRes.results.map(r => r.path), [
    'Master/01-Alpha.md',
    'Master/02-Beta.md',
    'Master/03-Gamma.md'
  ])
})
