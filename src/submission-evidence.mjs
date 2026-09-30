const fail = message => { throw Object.assign(new Error(message), { code: 'INVALID_COMMAND' }) }
export function submissionTime(payload) {
  if (payload.timeUnknown != null && typeof payload.timeUnknown !== 'boolean') fail('timeUnknown must be boolean')
  const hasDateTime = payload.occurredAt != null, hasDate = payload.occurredOn != null, unknown = payload.timeUnknown === true
  if (Number(hasDateTime) + Number(hasDate) + Number(unknown) !== 1) fail('Supply exactly one of occurredAt, occurredOn, or timeUnknown: true')
  if (unknown) return { value: null, precision: 'unknown' }
  const value = hasDateTime ? payload.occurredAt : payload.occurredOn
  if (typeof value !== 'string') fail('Occurrence time must be a string')
  if (hasDateTime && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) fail('occurredAt must be an ISO date-time with timezone')
  if (hasDate && !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('occurredOn must be a date')
  const day = value.slice(0, 10), parsedDay = new Date(`${day}T00:00:00.000Z`)
  if (!Number.isFinite(parsedDay.valueOf()) || parsedDay.toISOString().slice(0, 10) !== day || (hasDateTime && !Number.isFinite(Date.parse(value)))) fail('Occurrence time must be a real date')
  return { value, precision: hasDateTime ? 'date_time' : 'date' }
}
export function submissionChannel(payload) {
  if (payload.channelUnknown != null && typeof payload.channelUnknown !== 'boolean') fail('channelUnknown must be boolean')
  if (payload.channelUnknown === true) {
    if (payload.channel != null) fail('An unknown channel cannot also have a value')
    return { value: null, state: 'unknown' }
  }
  if (typeof payload.channel !== 'string' || !payload.channel.trim() || payload.channel.length > 256) fail('Supply channel or channelUnknown: true')
  return { value: payload.channel, state: 'known' }
}

export function validateSubmissionBundle(interaction) {
  const b = interaction.submission_bundle
  if (b.schema_version !== 4) return
  if (!['known', 'unknown'].includes(b.channel_state) || (b.channel_state === 'known' ? typeof b.channel !== 'string' || !b.channel.trim() : b.channel !== null)) fail('Invalid submission channel knowledge')
  const time = b.event_time
  if (!time || !['unknown', 'date', 'date_time'].includes(time.precision)) fail('Invalid event time precision')
  const validated = submissionTime(time.precision === 'unknown' ? { timeUnknown: true } : time.precision === 'date' ? { occurredOn: time.value } : { occurredAt: time.value })
  if (validated.value !== time.value || interaction.occurred_at !== time.value || interaction.temporal_precision !== time.precision) fail('Submission occurrence precision differs')
  if (!['unknown', 'confirmed_none', 'confirmed'].includes(b.artifact_selection_state) || (b.artifact_selection_state === 'confirmed' ? b.items.length === 0 : b.items.length !== 0)) fail('Invalid artifact evidence state')
  if (!Number.isFinite(Date.parse(b.recorded_at)) || !b.evidence_source || !b.original_report || !Array.isArray(b.reconciliations)) fail('Submission report provenance missing')
}
