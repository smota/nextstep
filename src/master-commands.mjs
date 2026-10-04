import { readMasterDocuments } from './master-files.mjs'
import { catalogMaster, queryMaster } from './master-query.mjs'

export function masterCatalog(paths) {
  const { documents, ...coverage } = readMasterDocuments(paths)
  return { status: 'ok', ...catalogMaster(documents), ...coverage }
}

export function masterQuery(paths, options) {
  // Validate even when the corpus is empty, before filesystem work.
  queryMaster([], options)
  const { documents, ...coverage } = readMasterDocuments(paths)
  return { status: 'ok', ...queryMaster(documents, options), ...coverage }
}
