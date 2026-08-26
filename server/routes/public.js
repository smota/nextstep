const ABSOLUTE_PATH = /(?:[A-Za-z]:[\\/]|\/(?:home|Users|tmp|var|opt|private|mnt|workspace)\/)[^\s|]*/gi

export function safeClientMessage(value, fallback = 'Request could not be completed') {
  return String(value || fallback).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(ABSOLUTE_PATH, '[redacted-path]').slice(0, 500)
}

export function sendPublicError(res, error) {
  const status = Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500
  const message = status >= 500 ? 'Request failed safely' : safeClientMessage(error?.message)
  return res.status(status).json({ error: message })
}

export async function publicRoute(handler, req, res) {
  try { await handler(req, res) } catch (error) { sendPublicError(res, error) }
}

export function apiErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)
  return sendPublicError(res, error)
}
