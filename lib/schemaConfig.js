const SCHEMA_MODE = (process.env.SCHEMA_MODE || 'legacy').toLowerCase()
export const isLegacy = SCHEMA_MODE !== 'new'

export const tables = isLegacy
  ? { availability: 'public.availability', bookings: 'public.bookings' }
  : { availability: 'public.therapist_availability', bookings: 'public.bookings' }

export const fields = isLegacy
  ? { therapist: 'therapist_id', start: 'start_time', end: 'end_time', statusCol: 'is_booked' }
  : { therapist: 'therapist_code', start: 'start', end: 'end', statusCol: 'status' }

export const isOpenPredicate = (row) =>
  isLegacy ? (row.is_booked === false) : (row.status === 'open')

export const setBookedUpdate = (qb) =>
  isLegacy ? qb.update({ is_booked: true }) : qb.update({ status: 'booked' })
