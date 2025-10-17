
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { DateTime, Interval } from 'luxon'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { toast } from '../hooks/use-toast'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { springMd } from '../lib/anim'
import { Toaster } from './ui/toaster'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Skeleton } from './ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog'
import { ScrollArea } from './ui/scroll-area'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react'

const DATETIME_LOCAL_FORMAT = "yyyy-LL-dd'T'HH:mm"
const API_LOCAL_FORMAT = 'yyyy-LL-dd HH:mm'
const DISPLAY_RANGE_FORMAT = 'MM/dd HH:mm'
const DURATION_OPTIONS = [30, 45, 60, 90]
const PRESETS = ['today', 'tomorrow', 'weekdays'] as const
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5]
const DEFAULT_WEEKLY_OCCURRENCES = 4

type CalendarMode = 'day' | 'week' | 'month'

type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no-show' | 'draft'

interface Booking {
  id: string
  startUTC: string
  endUTC?: string
  status: BookingStatus
  clientName?: string
  durationMinutes?: number
  therapistCode?: string
}

interface AvailabilitySlot {
  id: string
  startUTC: string
  endUTC: string
  timezone: string
  therapistCode?: string
  booked?: boolean
  repeat?: 'weekly' | null
  weekdays?: number[]
  source?: 'api' | 'supabase' | 'local'
  optimistic?: boolean
}

interface TherapistScheduleProps {
  session: Session
  refreshKey?: number
}

interface FormDraft {
  timezone: string
  start: string
  end: string
  duration: number
  repeat: 'none' | 'weekly'
  weekdays: number[]
  autoEnd: boolean
}

interface MergeDialogState {
  candidate: AvailabilitySlot
  conflicts: AvailabilitySlot[]
}

const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch (error) {
    console.warn('Failed to detect timezone', error)
    return 'UTC'
  }
}

const formatLocalInput = (dt: DateTime) => dt.toFormat(DATETIME_LOCAL_FORMAT)

const toDisplayRange = (startUTC: string, endUTC: string, tz: string) => {
  const start = DateTime.fromISO(startUTC, { zone: 'utc' }).setZone(tz)
  const end = DateTime.fromISO(endUTC, { zone: 'utc' }).setZone(tz)
  if (!start.isValid || !end.isValid) return ''
  const sameDay = start.hasSame(end, 'day')
  const startLabel = start.toFormat(DISPLAY_RANGE_FORMAT)
  const endLabel = end.toFormat(sameDay ? 'HH:mm' : DISPLAY_RANGE_FORMAT)
  return `${startLabel} – ${endLabel}`
}

const toApiLocal = (dt: DateTime) => dt.toFormat(API_LOCAL_FORMAT)

const buildFormDraft = (timezone: string): FormDraft => {
  const now = DateTime.now().setZone(timezone)
  const start = now.plus({ minutes: now.minute > 0 ? 60 - now.minute : 0 }).set({ second: 0, millisecond: 0 })
  const end = start.plus({ minutes: 60 })
  return {
    timezone,
    start: formatLocalInput(start),
    end: formatLocalInput(end),
    duration: 60,
    repeat: 'none',
    weekdays: [start.weekday],
    autoEnd: true,
  }
}

const intervalFromSlot = (slot: AvailabilitySlot) => {
  const start = DateTime.fromISO(slot.startUTC, { zone: 'utc' })
  const end = DateTime.fromISO(slot.endUTC, { zone: 'utc' })
  if (!start.isValid || !end.isValid) return null
  return Interval.fromDateTimes(start, end)
}

const availabilitySort = (a: AvailabilitySlot, b: AvailabilitySlot) =>
  DateTime.fromISO(a.startUTC).toMillis() - DateTime.fromISO(b.startUTC).toMillis()

const getTimezoneOptions = (): string[] => {
  try {
    const intlAny = Intl as any
    if (typeof intlAny.supportedValuesOf === 'function') {
      return intlAny.supportedValuesOf('timeZone')
    }
  } catch (error) {
    console.warn('Intl.supportedValuesOf not available', error)
  }
  return [
    'UTC',
    'America/Los_Angeles',
    'America/New_York',
    'Europe/London',
    'Europe/Paris',
    'Asia/Shanghai',
  ]
}

export default function TherapistSchedule({ session, refreshKey }: TherapistScheduleProps) {
  const { t, i18n } = useTranslation()
  const [timezone, setTimezone] = useState(session.user.user_metadata?.timezone || getBrowserTimezone())
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [formDraft, setFormDraft] = useState<FormDraft>(() => buildFormDraft(session.user.user_metadata?.timezone || getBrowserTimezone()))
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingAvailability, setLoadingAvailability] = useState(true)
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [savingAvailability, setSavingAvailability] = useState(false)
  const [mergeDialog, setMergeDialog] = useState<MergeDialogState | null>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [bookingsError, setBookingsError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [rescheduleDialog, setRescheduleDialog] = useState<{ booking: Booking; availableSlots: AvailabilitySlot[] } | null>(null)
  const [cancelDialog, setCancelDialog] = useState<Booking | null>(null)
  const [loadingReschedule, setLoadingReschedule] = useState(false)
  const [editDialog, setEditDialog] = useState<{ slot: AvailabilitySlot; cellStart: DateTime; cellEnd: DateTime } | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ slot: AvailabilitySlot; cellStart: DateTime; cellEnd: DateTime } | null>(null)

  const lang = i18n.language === 'zh' ? 'zh-CN' : i18n.language
  const timezoneOptions = useMemo(() => getTimezoneOptions(), [])
  const weekStart = useMemo(() => DateTime.now().setZone(timezone).startOf('week').plus({ weeks: weekOffset }), [timezone, weekOffset])
  const weekEnd = useMemo(() => weekStart.plus({ weeks: 1 }), [weekStart])

  const summaryWeekHours = useMemo(() => {
    const filtered = availability.filter((slot) => {
      const interval = intervalFromSlot(slot)
      if (!interval || !interval.start || !interval.end) return false
      return interval.start >= weekStart.startOf('day') && interval.end <= weekEnd.endOf('day')
    })
    const totalMinutes = filtered.reduce((acc, slot) => {
      const interval = intervalFromSlot(slot)
      return interval ? acc + interval.length('minutes') : acc
    }, 0)
    return Math.round((totalMinutes / 60) * 10) / 10
  }, [availability, weekStart, weekEnd])

  const nextBooking = useMemo(() => {
    const now = DateTime.now().toUTC()
    return bookings
      .map((booking) => ({
        ...booking,
        start: DateTime.fromISO(booking.startUTC, { zone: 'utc' }).setZone(timezone),
      }))
      .filter((booking) => booking.start > now.setZone(timezone))
      .sort((a, b) => a.start.toMillis() - b.start.toMillis())[0]
  }, [bookings, timezone])

  useEffect(() => {
    setFormDraft(buildFormDraft(timezone))
  }, [timezone])

const fetchAvailability = useCallback(async () => {
  setLoadingAvailability(true)
  setAvailabilityError(null)
  try {
    const response = await fetch('/api/availability/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        therapist_code: session.user.user_metadata?.therapist_code ?? 'FAGHT34X',
        user_id: session.user.id,
        lang,
        tz: timezone,
      }),
    })

    if (!response.ok) {
      throw new Error('Request failed')
    }

    const json = await response.json()
    const slots: AvailabilitySlot[] = (json?.data ?? []).map((item: any) => ({
      id: item.availabilityId || item.id || crypto.randomUUID(),
      startUTC: item.startUTC || item.start_utc || item.start,
      endUTC: item.endUTC || item.end_utc || item.end,
      timezone: item.tz_used || timezone,
      therapistCode: item.therapistCode || item.therapist_code,
      booked: item.booked || item.status === 'booked',
      repeat: item.repeat === 'weekly' ? 'weekly' : null,
      weekdays: item.weekday_mask || item.weekdays || [],
      source: item.source || 'api',
    }))
    setAvailability(slots.sort(availabilitySort))
  } catch (error) {
    console.error('Availability API failed, fallback to Supabase', error)
    try {
      const { data, error: supabaseError } = await supabase
        .from('availability')
        .select('*')
        .eq('therapist_id', session.user.id)
        .order('start_time', { ascending: true })

      if (supabaseError) {
        throw supabaseError
      }

      const slots: AvailabilitySlot[] = (data ?? []).map((item: any) => ({
        id: String(item.id),
        startUTC: item.start_time,
        endUTC: item.end_time,
        timezone,
        repeat: null,
        weekdays: [],
        source: 'supabase',
      }))
      setAvailability(slots.sort(availabilitySort))
    } catch (fallbackError) {
      console.error('Failed to fetch availability', fallbackError)
      setAvailabilityError(t('sched_error_fetch_availability'))
      setAvailability([])
    }
  } finally {
    setLoadingAvailability(false)
  }
}, [session, timezone, lang, t])

const fetchBookings = useCallback(async () => {
  setLoadingBookings(true)
  setBookingsError(null)
  const rangeStart = weekStart.minus({ weeks: 2 })
  const rangeEnd = weekEnd.plus({ weeks: 8 })
  try {
    const therapistCode = session.user.user_metadata?.therapist_code ?? 'FAGHT34X'
    
    const { data, error: supabaseError } = await supabase
      .from('bookings')
      .select('id,therapist_code,start_utc,end_utc,duration_mins,status,user_id')
      .eq('therapist_code', therapistCode)
      .gte('start_utc', rangeStart.toISO())
      .lte('start_utc', rangeEnd.toISO())
      .order('start_utc', { ascending: true })

    if (supabaseError) {
      throw supabaseError
    }

    const userIds = [...new Set((data ?? []).map(b => b.user_id))].filter(Boolean)
    let clientNames: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id,name')
        .in('user_id', userIds)
      clientNames = Object.fromEntries((profiles || []).map(p => [p.user_id, p.name]))
    }

    const list: Booking[] = (data ?? []).map((item: any) => ({
      id: String(item.id),
      startUTC: item.start_utc,
      endUTC: item.end_utc,
      status: (item.status || 'confirmed') as BookingStatus,
      clientName: clientNames[item.user_id] || 'Client',
      durationMinutes: item.duration_mins,
      therapistCode: item.therapist_code,
    }))

    setBookings(list.sort((a, b) => DateTime.fromISO(a.startUTC).toMillis() - DateTime.fromISO(b.startUTC).toMillis()))
  } catch (error) {
    console.error('Failed to fetch bookings', error)
    setBookingsError(t('sched_error_fetch_bookings'))
    setBookings([])
  } finally {
    setLoadingBookings(false)
  }
}, [session, timezone, lang, t, weekStart, weekEnd])

useEffect(() => {
  fetchAvailability()
  fetchBookings()
}, [fetchAvailability, fetchBookings, refreshKey])

const upcomingBookings = useMemo(() => {
  const now = DateTime.now().toUTC()
  return bookings
    .filter((booking) => DateTime.fromISO(booking.startUTC, { zone: 'utc' }) > now)
    .slice(0, 3)
}, [bookings])

const enrichedAvailability = useMemo(() => {
  return availability.map((slot) => {
    const slotStart = DateTime.fromISO(slot.startUTC, { zone: 'utc' })
    const slotEnd = DateTime.fromISO(slot.endUTC, { zone: 'utc' })
    
    const hasBooking = bookings.some((booking) => {
      const bookingStart = DateTime.fromISO(booking.startUTC, { zone: 'utc' })
      const bookingEnd = DateTime.fromISO(booking.endUTC || booking.startUTC, { zone: 'utc' })
      
      return bookingStart < slotEnd && bookingEnd > slotStart
    })
    
    return { ...slot, booked: slot.booked || hasBooking }
  })
}, [availability, bookings])

const allTimeCommitments = useMemo(() => {
  const commitments = [...enrichedAvailability]
  
  bookings.forEach((booking) => {
    const bookingStart = DateTime.fromISO(booking.startUTC, { zone: 'utc' })
    const bookingEnd = booking.endUTC 
      ? DateTime.fromISO(booking.endUTC, { zone: 'utc' })
      : bookingStart.plus({ minutes: booking.durationMinutes || 60 })
    
    const hasAvailability = availability.some((slot) => {
      const slotStart = DateTime.fromISO(slot.startUTC, { zone: 'utc' })
      const slotEnd = DateTime.fromISO(slot.endUTC, { zone: 'utc' })
      return bookingStart < slotEnd && bookingEnd > slotStart
    })
    
    if (!hasAvailability) {
      commitments.push({
        id: `booking-${booking.id}`,
        startUTC: booking.startUTC,
        endUTC: booking.endUTC || bookingStart.plus({ minutes: booking.durationMinutes || 60 }).toUTC().toISO() || '',
        timezone: timezone,
        booked: true,
        isStandaloneBooking: true,
        bookingId: booking.id,
      } as any)
    }
  })
  
  return commitments.sort((a, b) => 
    DateTime.fromISO(a.startUTC).toMillis() - DateTime.fromISO(b.startUTC).toMillis()
  )
}, [enrichedAvailability, bookings, availability, timezone])

const createSlotsFromForm = useCallback(
  (draft: FormDraft): AvailabilitySlot[] => {
    const baseStart = DateTime.fromISO(draft.start, { zone: draft.timezone || timezone })
    const baseEnd = DateTime.fromISO(draft.end, { zone: draft.timezone || timezone })
    if (!baseStart.isValid || !baseEnd.isValid) return []
    const interval = baseEnd.diff(baseStart, 'minutes').minutes
    if (interval <= 0) return []

    const occurrences = draft.repeat === 'weekly' ? DEFAULT_WEEKLY_OCCURRENCES : 1
    const weekdays = draft.repeat === 'weekly' ? draft.weekdays : [baseStart.weekday]
    const slots: AvailabilitySlot[] = []

    for (let weekIndex = 0; weekIndex < occurrences; weekIndex += 1) {
      const weekBase = baseStart.startOf('week').plus({ weeks: weekIndex })
      weekdays.forEach((weekday) => {
        let start = weekBase.plus({ days: weekday - 1 }).set({
          hour: baseStart.hour,
          minute: baseStart.minute,
          second: 0,
          millisecond: 0,
        })

        if (start < DateTime.now().setZone(start.zone)) {
          start = start.plus({ weeks: 1 })
        }

        const end = start.plus({ minutes: interval })
        slots.push({
          id: `temp-${start.toISO()}`,
          startUTC: start.toUTC().toISO() || '',
          endUTC: end.toUTC().toISO() || '',
          timezone: draft.timezone || timezone,
          repeat: draft.repeat === 'weekly' ? 'weekly' : null,
          weekdays: draft.repeat === 'weekly' ? draft.weekdays : [],
          optimistic: true,
        })
      })
    }

    return slots
      .filter((slot) => slot.startUTC && slot.endUTC)
      .filter((slot, index, array) => index === array.findIndex((item) => item.startUTC === slot.startUTC && item.endUTC === slot.endUTC))
      .sort(availabilitySort)
  },
  [timezone]
)

const findBookingConflict = useCallback(
  (slot: AvailabilitySlot) => {
    const interval = intervalFromSlot(slot)
    if (!interval) return null
    for (const booking of bookings) {
      const bookingInterval = Interval.fromDateTimes(
        DateTime.fromISO(booking.startUTC, { zone: 'utc' }),
        DateTime.fromISO(booking.endUTC || booking.startUTC, { zone: 'utc' })
      )
      if (bookingInterval && bookingInterval.overlaps(interval)) {
        return booking
      }
    }
    return null
  },
  [bookings]
)

const findAvailabilityConflicts = useCallback(
  (slot: AvailabilitySlot) => {
    const interval = intervalFromSlot(slot)
    if (!interval) return []
    return availability.filter((existing) => {
      if (existing.id === slot.id) return false
      const existingInterval = intervalFromSlot(existing)
      return existingInterval ? existingInterval.overlaps(interval) : false
    })
  },
  [availability]
)

const upsertAvailability = useCallback(
  async (slots: AvailabilitySlot[], successMessage?: string) => {
    if (!slots.length) return
    setSavingAvailability(true)
    const optimisticSlots = slots.map((slot) => ({ ...slot, optimistic: true }))
    setAvailability((prev) => [...prev, ...optimisticSlots].sort(availabilitySort))

    try {
      const response = await fetch('/api/availability/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          therapist_code: session.user.user_metadata?.therapist_code ?? 'FAGHT34X',
          user_id: session.user.id,
          lang,
          tz: timezone,
          time_ranges: slots.map((slot) => {
            const start = DateTime.fromISO(slot.startUTC, { zone: 'utc' }).setZone(timezone)
            const end = DateTime.fromISO(slot.endUTC, { zone: 'utc' }).setZone(timezone)
            return {
              start_local: toApiLocal(start),
              end_local: toApiLocal(end),
            }
          }),
        }),
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      const json = await response.json()
      const created: AvailabilitySlot[] = (json?.data ?? []).map((item: any) => ({
        id: item.availabilityId || item.id || crypto.randomUUID(),
        startUTC: item.startUTC || item.start_utc || item.start,
        endUTC: item.endUTC || item.end_utc || item.end,
        timezone: item.tz_used || timezone,
        repeat: item.repeat === 'weekly' ? 'weekly' : null,
        weekdays: item.weekday_mask || [],
        optimistic: false,
        source: 'api',
      }))

      setAvailability((prev) => {
        const withoutOptimistic = prev.filter(
          (slot) => !optimisticSlots.some((opt) => opt.startUTC === slot.startUTC && opt.endUTC === slot.endUTC)
        )
        return [...withoutOptimistic, ...created].sort(availabilitySort)
      })

      toast({
        title: t('sched_add_success_title'),
        description:
          successMessage ||
          t('sched_add_success_desc', {
            count: created.length,
            range: created.length ? toDisplayRange(created[0].startUTC, created[0].endUTC, timezone) : undefined,
          }),
      })
    } catch (error) {
      console.error('Failed to add availability', error)
      setAvailability((prev) => prev.filter((slot) => !optimisticSlots.some((opt) => opt.id === slot.id)))
      toast({ title: t('sched_add_failure_title'), description: t('sched_add_failure_desc') })
    } finally {
      setSavingAvailability(false)
    }
  },
  [session, timezone, lang, t]
)

const handleCreateAvailability = useCallback(async () => {
  const slots = createSlotsFromForm(formDraft)
  if (!slots.length) {
    toast({ title: t('sched_form_invalid_title'), description: t('sched_form_invalid_desc') })
    return
  }

  if (slots.some((slot) => DateTime.fromISO(slot.startUTC) <= DateTime.now().toUTC())) {
    toast({ title: t('sched_future_time'), description: t('sched_future_time_desc') })
    return
  }

  for (const slot of slots) {
    const conflictBooking = findBookingConflict(slot)
    if (conflictBooking) {
      toast({
        title: t('sched_conflict_booking_title'),
        description: t('sched_conflict_booking_desc', {
          range: toDisplayRange(
            conflictBooking.startUTC,
            conflictBooking.endUTC || conflictBooking.startUTC,
            timezone
          ),
        }),
      })
      return
    }
  }

  for (const slot of slots) {
    const overlaps = findAvailabilityConflicts(slot)
    if (overlaps.length) {
      setMergeDialog({ candidate: slot, conflicts: overlaps })
      return
    }
  }

  await upsertAvailability(slots)
}, [createSlotsFromForm, formDraft, findBookingConflict, findAvailabilityConflicts, upsertAvailability, timezone, t])

const handleDeleteAvailability = useCallback(
  async (slot: AvailabilitySlot) => {
    console.log('[DELETE] Starting delete for slot:', { id: slot.id, therapistCode: slot.therapistCode, source: slot.source })
    const previous = availability
    setAvailability((prev) => prev.filter((item) => item.id !== slot.id))

    try {
      const response = await fetch('/api/availability/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          availability_id: slot.id,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Request failed')
      }
      toast({ title: t('sched_delete_success_title'), description: t('sched_delete_success_desc') })
    } catch (error) {
      console.error('Failed to delete availability', error)
      setAvailability(previous)
      toast({ title: t('sched_delete_failure_title'), description: t('sched_delete_failure_desc') })
    }
  },
  [availability, session, timezone, lang, t]
)

const handlePreset = useCallback(
  (preset: (typeof PRESETS)[number]) => {
    const base = DateTime.now().setZone(timezone)
    if (preset === 'today') {
      const start = base.set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
      const end = base.set({ hour: 17, minute: 0, second: 0, millisecond: 0 })
      setFormDraft((prev) => ({
        ...prev,
        start: formatLocalInput(start),
        end: formatLocalInput(end),
        duration: 60,
        repeat: 'none',
        weekdays: [start.weekday],
        autoEnd: true,
      }))
    } else if (preset === 'tomorrow') {
      const tomorrow = base.plus({ days: 1 })
      const start = tomorrow.set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
      const end = tomorrow.set({ hour: 17, minute: 0, second: 0, millisecond: 0 })
      setFormDraft((prev) => ({
        ...prev,
        start: formatLocalInput(start),
        end: formatLocalInput(end),
        duration: 60,
        repeat: 'none',
        weekdays: [start.weekday],
        autoEnd: true,
      }))
    } else if (preset === 'weekdays') {
      const upcomingMonday = base.plus({ days: ((8 - base.weekday) % 7) }).set({
        hour: 8,
        minute: 0,
        second: 0,
        millisecond: 0,
      })
      const end = upcomingMonday.set({ hour: 17 })
      setFormDraft((prev) => ({
        ...prev,
        start: formatLocalInput(upcomingMonday),
        end: formatLocalInput(end),
        duration: 60,
        repeat: 'weekly',
        weekdays: DEFAULT_WEEKDAYS,
        autoEnd: true,
      }))
    }
  },
  [timezone]
)

const handleStartChange = useCallback(
  (value: string) => {
    setFormDraft((prev) => {
      const start = DateTime.fromISO(value, { zone: timezone })
      if (!start.isValid) return prev
      const updated: FormDraft = { ...prev, start: value }
      if (prev.autoEnd) {
        updated.end = formatLocalInput(start.plus({ minutes: prev.duration }))
      }
      return updated
    })
  },
  [timezone]
)

const handleEndChange = useCallback((value: string) => {
  setFormDraft((prev) => ({ ...prev, end: value, autoEnd: false }))
}, [])

const handleDurationChange = useCallback(
  (value: string) => {
    const duration = Number(value)
    if (Number.isNaN(duration)) return
    setFormDraft((prev) => {
      const start = DateTime.fromISO(prev.start, { zone: timezone })
      if (!start.isValid) return { ...prev, duration }
      const updated: FormDraft = { ...prev, duration }
      if (prev.autoEnd) {
        updated.end = formatLocalInput(start.plus({ minutes: duration }))
      }
      return updated
    })
  },
  [timezone]
)

const handleRepeatChange = useCallback((value: 'none' | 'weekly') => {
  setFormDraft((prev) => ({ ...prev, repeat: value }))
}, [])

const handleWeekdaysChange = useCallback((values: string[]) => {
  const parsed = values.map((value) => Number(value)).sort((a, b) => a - b)
  setFormDraft((prev) => ({ ...prev, weekdays: parsed }))
}, [])

const handleTimezoneChange = useCallback((value: string) => {
  setTimezone(value)
  setFormDraft((prev) => ({ ...prev, timezone: value }))
}, [])

const refreshAll = useCallback(async () => {
  setIsRefreshing(true)
  await Promise.all([fetchAvailability(), fetchBookings()])
  setIsRefreshing(false)
}, [fetchAvailability, fetchBookings])

const handleRescheduleClick = useCallback(async (booking: Booking) => {
  try {
    const response = await fetch('/api/availability/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        therapist_code: booking.therapistCode || session.user.user_metadata?.therapist_code || 'FAGHT34X',
        tz: timezone,
        lang: lang,
      }),
    })
    
    if (!response.ok) throw new Error('Failed to fetch availability')
    
    const data = await response.json()
    const slots = (data.data || []).map((s: any) => ({
      id: s.id,
      startUTC: s.startUTC,
      endUTC: s.endUTC,
      timezone: s.tz_used,
      therapistCode: s.therapist_code,
    }))
    
    setRescheduleDialog({ booking, availableSlots: slots })
  } catch (error) {
    console.error('Failed to fetch slots for reschedule', error)
    toast({ title: t('error'), description: t('sched_error_fetch_availability') })
  }
}, [session, timezone, lang, t, toast])

const handleRescheduleConfirm = useCallback(async (newSlotId: string) => {
  if (!rescheduleDialog) return
  
  setLoadingReschedule(true)
  try {
    const response = await fetch('/api/bookings/reschedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        booking_id: rescheduleDialog.booking.id,
        new_availability_id: newSlotId,
        user_tz: timezone,
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Reschedule failed')
    }
    
    toast({ title: t('success'), description: t('sched_reschedule_success') })
    await refreshAll()
    setRescheduleDialog(null)
  } catch (error) {
    console.error('Failed to reschedule booking', error)
    toast({ title: t('error'), description: t('sched_reschedule_failed') })
  } finally {
    setLoadingReschedule(false)
  }
}, [rescheduleDialog, session, timezone, t, toast, refreshAll])

const handleCancelClick = useCallback((booking: Booking) => {
  setCancelDialog(booking)
}, [])

const handleCancelConfirm = useCallback(async () => {
  if (!cancelDialog) return
  
  try {
    const response = await fetch('/api/bookings/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        booking_id: cancelDialog.id,
        reason: 'therapist_cancelled',
      }),
    })
    
    if (!response.ok) throw new Error('Cancel failed')
    
    toast({ title: t('success'), description: t('sched_cancel_success') })
    await refreshAll()
    setCancelDialog(null)
  } catch (error) {
    console.error('Failed to cancel booking', error)
    toast({ title: t('error'), description: t('sched_cancel_failed') })
  }
}, [cancelDialog, session, t, toast, refreshAll])

const handleEditClick = useCallback((slot: AvailabilitySlot, cellStart: DateTime, cellEnd: DateTime) => {
  setEditDialog({ slot, cellStart, cellEnd })
}, [])

const handleEditConfirm = useCallback(async (updatedSlot: { startUTC: string; endUTC: string }) => {
  if (!editDialog) return
  
  try {
    const slotStart = DateTime.fromISO(editDialog.slot.startUTC, { zone: 'utc' })
    const slotEnd = DateTime.fromISO(editDialog.slot.endUTC, { zone: 'utc' })
    const { cellStart, cellEnd } = editDialog
    
    await handleDeleteAvailability(editDialog.slot)
    
    const slotsToCreate: Array<{ id: string; startUTC: string; endUTC: string; timezone: string }> = []
    
    if (slotStart < cellStart) {
      slotsToCreate.push({
        id: `split-before-${Date.now()}`,
        startUTC: slotStart.toUTC().toISO() || '',
        endUTC: cellStart.toUTC().toISO() || '',
        timezone,
      })
    }
    
    slotsToCreate.push({
      id: `edited-${Date.now()}`,
      startUTC: updatedSlot.startUTC,
      endUTC: updatedSlot.endUTC,
      timezone,
    })
    
    if (cellEnd < slotEnd) {
      slotsToCreate.push({
        id: `split-after-${Date.now()}`,
        startUTC: cellEnd.toUTC().toISO() || '',
        endUTC: slotEnd.toUTC().toISO() || '',
        timezone,
      })
    }
    
    await upsertAvailability(slotsToCreate, t('sched_edit_success'))
    setEditDialog(null)
  } catch (error) {
    console.error('Failed to edit availability', error)
    toast({ title: t('error'), description: t('sched_edit_failed') })
  }
}, [editDialog, timezone, t, toast, handleDeleteAvailability, upsertAvailability])

const handleDeleteClick = useCallback((slot: AvailabilitySlot, cellStart: DateTime, cellEnd: DateTime) => {
  setDeleteDialog({ slot, cellStart, cellEnd })
}, [])

const handleDeleteConfirm = useCallback(async () => {
  if (!deleteDialog) return
  
  try {
    const slotStart = DateTime.fromISO(deleteDialog.slot.startUTC, { zone: 'utc' })
    const slotEnd = DateTime.fromISO(deleteDialog.slot.endUTC, { zone: 'utc' })
    const { cellStart, cellEnd } = deleteDialog
    
    await handleDeleteAvailability(deleteDialog.slot)
    
    const slotsToCreate: Array<{ id: string; startUTC: string; endUTC: string; timezone: string }> = []
    
    if (slotStart < cellStart) {
      slotsToCreate.push({
        id: `split-before-${Date.now()}`,
        startUTC: slotStart.toUTC().toISO() || '',
        endUTC: cellStart.toUTC().toISO() || '',
        timezone,
      })
    }
    
    if (cellEnd < slotEnd) {
      slotsToCreate.push({
        id: `split-after-${Date.now()}`,
        startUTC: cellEnd.toUTC().toISO() || '',
        endUTC: slotEnd.toUTC().toISO() || '',
        timezone,
      })
    }
    
    if (slotsToCreate.length > 0) {
      await upsertAvailability(slotsToCreate, t('sched_delete_success'))
    } else {
      toast({ title: t('success'), description: t('sched_delete_success') })
    }
    
    setDeleteDialog(null)
  } catch (error) {
    console.error('Failed to delete availability', error)
    toast({ title: t('error'), description: t('sched_delete_failed') })
  }
}, [deleteDialog, timezone, t, toast, handleDeleteAvailability, upsertAvailability])

const handleMergeConfirm = useCallback(async () => {
  if (!mergeDialog) return
  const mergedStart = [...mergeDialog.conflicts, mergeDialog.candidate]
    .map((slot) => DateTime.fromISO(slot.startUTC))
    .sort((a, b) => a.toMillis() - b.toMillis())[0]
  const mergedEnd = [...mergeDialog.conflicts, mergeDialog.candidate]
    .map((slot) => DateTime.fromISO(slot.endUTC))
    .sort((a, b) => b.toMillis() - a.toMillis())[0]

  if (!mergedStart || !mergedEnd) {
    setMergeDialog(null)
    return
  }

  setAvailability((prev) => prev.filter((slot) => !mergeDialog.conflicts.some((conflict) => conflict.id === slot.id)))

    try {
      for (const conflict of mergeDialog.conflicts) {
        if (conflict.source === 'supabase') {
          const { error } = await supabase.from('availability').delete().eq('id', Number(conflict.id))
          if (error) throw error
        } else {
          const response = await fetch('/api/availability/cancel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              availability_id: conflict.id,
              therapist_code: session.user.user_metadata?.therapist_code ?? 'FAGHT34X',
              user_id: session.user.id,
              tz: timezone,
              lang,
            }),
          })
          if (!response.ok) throw new Error('Request failed')
        }
      }

    await upsertAvailability([
      {
        id: `merged-${mergedStart.toISO()}`,
        startUTC: mergedStart.toUTC().toISO() || '',
        endUTC: mergedEnd.toUTC().toISO() || '',
        timezone,
        repeat: mergeDialog.candidate.repeat ?? null,
        weekdays: mergeDialog.candidate.weekdays ?? [],
      },
    ], t('sched_merge_success_desc', {
      range: toDisplayRange(mergedStart.toUTC().toISO() || '', mergedEnd.toUTC().toISO() || '', timezone),
    }))
  } catch (error) {
    console.error('Failed to merge availability', error)
    toast({ title: t('sched_merge_failure_title'), description: t('sched_merge_failure_desc') })
    await fetchAvailability()
  } finally {
    setMergeDialog(null)
  }
}, [mergeDialog, timezone, lang, session, upsertAvailability, t, fetchAvailability])

const handleMergeCancel = useCallback(() => setMergeDialog(null), [])

const calendarDays = useMemo(() => {
  if (calendarMode === 'day') return [weekStart]
  if (calendarMode === 'month') {
    const monthStart = weekStart.startOf('month')
    return Array.from({ length: monthStart.daysInMonth ?? 30 }, (_, index) => monthStart.plus({ days: index }))
  }
  return Array.from({ length: 7 }, (_, index) => weekStart.plus({ days: index }))
}, [calendarMode, weekStart])

  const calendarEvents = useMemo(() => {
    return {
      availability: availability.map((slot) => ({ slot, interval: intervalFromSlot(slot) })),
      bookings: bookings.map((booking) => ({
        booking,
        interval: Interval.fromDateTimes(
          DateTime.fromISO(booking.startUTC, { zone: 'utc' }),
          DateTime.fromISO(booking.endUTC || booking.startUTC, { zone: 'utc' })
        ),
      })),
    }
  }, [availability, bookings])

  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setWeekOffset((offset) => offset - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setWeekOffset((offset) => offset + 1)
    } else if (event.key.toLowerCase() === 'n') {
      event.preventDefault()
      setWeekOffset(0)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardNavigation)
    return () => window.removeEventListener('keydown', handleKeyboardNavigation)
  }, [handleKeyboardNavigation])

return (
  <div className="min-h-screen bg-[#F7F7F9]">
    <Toaster />
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-6 md:px-6">
        <motion.section 
          className="rounded-2xl border border-[#E5E7EB] bg-white/80 backdrop-blur-md shadow-md"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springMd}
        >
          <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('sched_summary_timezone')}</p>
                <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                  <Globe className="h-4 w-4 text-cyan-600 transition-colors hover:text-cyan-700" />
                  <Select value={timezone} onValueChange={handleTimezoneChange}>
                    <SelectTrigger className="w-[220px] rounded-full border-[#E5E7EB]">
                      <SelectValue placeholder={t('sched_timezone_placeholder')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {timezoneOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">{t('sched_timezone_hint')}</p>
              </div>
              <div className="h-12 w-px bg-[#E5E7EB]" aria-hidden />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('sched_summary_week_hours')}</p>
                <p className="text-lg font-semibold text-[#0F172A]">{summaryWeekHours.toFixed(1)} {t('sched_hours')}</p>
              </div>
              <div className="h-12 w-px bg-[#E5E7EB]" aria-hidden />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('sched_summary_next_booking')}</p>
                {nextBooking ? (
                  <p className="text-sm font-medium text-[#0F172A]">
                    {toDisplayRange(nextBooking.startUTC, nextBooking.endUTC || nextBooking.startUTC, timezone)}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('sched_summary_no_next')}</p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={isRefreshing}>
              {isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" />}
              {t('sched_refresh')}
            </Button>
          </div>
        </motion.section>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springMd, delay: 0.1 }}
            >
            <Card className="rounded-2xl border border-[#E5E7EB] bg-white/80 backdrop-blur-md shadow-md">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-[18px] font-semibold leading-6 text-[#0F172A]">
                      {t('sched_upcoming_bookings')}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {t('sched_upcoming_desc')}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">
                    {t('sched_view_all')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBookings ? (
                  <div className="space-y-4">
                    {[0, 1, 2].map((key) => (
                      <div key={key} className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : bookingsError ? (
                  <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{bookingsError}</div>
                ) : upcomingBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F7F7F9] py-12 text-center">
                    <CalendarIcon className="h-10 w-10 text-cyan-500" />
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{t('sched_no_upcoming_title')}</p>
                      <p className="text-sm text-muted-foreground">{t('sched_no_upcoming_desc')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => {
                      const localStart = DateTime.fromISO(booking.startUTC, { zone: 'utc' }).setZone(timezone)
                      const localEnd = booking.endUTC
                        ? DateTime.fromISO(booking.endUTC, { zone: 'utc' }).setZone(timezone)
                        : localStart.plus({ minutes: booking.durationMinutes ?? 60 })
                      return (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-white/70 backdrop-blur-sm px-4 py-3 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#0F172A]">
                                {booking.clientName || t('client_fallback')}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {localStart.toFormat('MMM dd, HH:mm')} – {localEnd.toFormat('HH:mm')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="rounded-full bg-blue-50 text-xs uppercase tracking-wide text-primary">
                              {t(`status_${booking.status}`)}
                            </Badge>
                            {booking.status === 'confirmed' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-full"
                                  onClick={() => handleRescheduleClick(booking)}
                                >
                                  {t('sched_reschedule_booking')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-full text-rose-600 hover:text-rose-700"
                                  onClick={() => handleCancelClick(booking)}
                                >
                                  {t('sched_cancel_booking')}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#E5E7EB] bg-white/80 backdrop-blur-md shadow-md">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-[18px] font-semibold leading-6 text-[#0F172A]">
                      {t('sched_calendar_title')}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {t('sched_calendar_desc')}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={calendarMode} onValueChange={(value) => setCalendarMode(value as CalendarMode)}>
                      <TabsList className="grid grid-cols-3 rounded-full bg-[#F7F7F9] p-1">
                        <TabsTrigger value="day" className="rounded-full text-sm font-medium">
                          {t('sched_calendar_day')}
                        </TabsTrigger>
                        <TabsTrigger value="week" className="rounded-full text-sm font-medium">
                          {t('sched_calendar_week')}
                        </TabsTrigger>
                        <TabsTrigger value="month" className="rounded-full text-sm font-medium">
                          {t('sched_calendar_month')}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-2 py-1 shadow-sm">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setWeekOffset((offset) => offset - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="px-2 text-sm font-semibold text-[#0F172A]">
                        {weekStart.toFormat('MMM dd')} – {weekEnd.minus({ days: 1 }).toFormat('MMM dd')}
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setWeekOffset((offset) => offset + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="ml-1 rounded-full px-3" onClick={() => setWeekOffset(0)}>
                        {t('sched_calendar_this_week')}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAvailability && loadingBookings ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((index) => (
                      <Skeleton key={index} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB]">
                    <div className="grid" style={{ gridTemplateColumns: `100px repeat(${calendarDays.length}, minmax(120px, 1fr))` }}>
                      <div className="bg-[#F7F7F9] p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('sched_calendar_time')}
                      </div>
                      {calendarDays.map((day) => (
                        <div key={day.toISODate()} className="bg-[#F7F7F9] p-3 text-center">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{day.toFormat('ccc')}</p>
                          <p className="text-sm font-semibold text-[#0F172A]">{day.toFormat('MM/dd')}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: `100px repeat(${calendarDays.length}, minmax(120px, 1fr))` }}>
                      {Array.from({ length: 12 }, (_, index) => 8 + index).map((hour) => (
                        <Fragment key={`row-${hour}`}>
                          <div className="border-t border-[#E5E7EB] bg-white p-3 text-xs font-medium text-muted-foreground">
                            {hour.toString().padStart(2, '0')}:00
                          </div>
                          {calendarDays.map((day) => {
                            const cellKey = `${day.toISODate()}-${hour}`
                            const cellStart = day.set({ hour, minute: 0, second: 0, millisecond: 0 }).toUTC()
                            const cellEnd = cellStart.plus({ hours: 1 })
                            const cellInterval = Interval.fromDateTimes(cellStart, cellEnd)

                            const availabilityInCell = calendarEvents.availability.filter((event) =>
                              event.interval ? event.interval.overlaps(cellInterval) : false
                            )
                            const bookingsInCell = calendarEvents.bookings.filter((event) =>
                              event.interval ? event.interval.overlaps(cellInterval) : false
                            )

                            return (
                              <div
                                key={`${cellKey}`}
                                className={cn(
                                  'relative border-t border-[#E5E7EB] bg-white p-2',
                                  availabilityInCell.length > 0 && 'bg-primary/5'
                                )}
                              >
                                <div className="flex flex-col gap-1">
                                  {availabilityInCell.map(({ slot }) => (
                                    <div
                                      key={`${slot.id}-${cellKey}`}
                                      className="group relative flex flex-col items-start gap-1 rounded-lg border border-primary/40 bg-white/70 px-2 py-1.5 text-xs text-primary shadow-sm hover:shadow-md transition-shadow"
                                    >
                                      <div className="flex w-full items-center justify-between gap-1">
                                        <span className="font-medium">{t('sched_calendar_available')}</span>
                                        {!slot.booked && (
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 rounded-full hover:bg-primary/10"
                                              onClick={() => handleEditClick(slot, cellStart, cellEnd)}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 rounded-full hover:bg-rose-100 hover:text-rose-600"
                                              onClick={() => handleDeleteClick(slot, cellStart, cellEnd)}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                      <Badge variant="outline" className="border-primary/40 text-[10px]">
                                        {DateTime.fromISO(slot.startUTC, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm')}–
                                        {DateTime.fromISO(slot.endUTC, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm')}
                                      </Badge>
                                    </div>
                                  ))}
                                  {bookingsInCell.map(({ booking }) => (
                                    <div
                                      key={`${booking.id}-${cellKey}`}
                                      className="flex flex-col items-start gap-1 rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/5 px-2 py-1.5 text-xs text-[#DC2626]"
                                    >
                                      <span className="font-medium">{t('sched_calendar_booked')}</span>
                                      <Badge variant="outline" className="border-[#DC2626]/40 text-[10px] text-[#DC2626]">
                                        {DateTime.fromISO(booking.startUTC, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm')}–
                                        {DateTime.fromISO(booking.endUTC || booking.startUTC, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm')}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </motion.div>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-4">
            <motion.div
              className="sticky top-6 flex flex-col gap-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springMd, delay: 0.15 }}
            >
              <Card className="rounded-2xl border border-[#E5E7EB] bg-white/90 backdrop-blur-lg shadow-lg">
                <CardHeader>
                  <CardTitle className="text-[18px] font-semibold leading-6 text-[#0F172A]">
                    {t('sched_add_availability_panel_title')}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {t('sched_add_availability_panel_desc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('sched_presets')}
                    </Label>
                    <div className="grid grid-cols-1 gap-2">
                      {PRESETS.map((preset) => (
                        <Button
                          key={preset}
                          variant="outline"
                          className="justify-start rounded-xl border-[#E5E7EB] bg-white text-sm"
                          onClick={() => handlePreset(preset)}
                        >
                          {t(`sched_preset_${preset}`)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="start" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('sched_start_time_label')}
                      </Label>
                      <Input
                        id="start"
                        type="datetime-local"
                        value={formDraft.start}
                        onChange={(event) => handleStartChange(event.target.value)}
                        className="rounded-xl border-[#E5E7EB] focus:outline-none focus:ring-2 ring-sky-300 ring-offset-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('duration')}
                      </Label>
                      <Select value={String(formDraft.duration)} onValueChange={handleDurationChange}>
                        <SelectTrigger id="duration" className="rounded-xl border-[#E5E7EB]">
                          <SelectValue placeholder={t('sched_duration_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((duration) => (
                            <SelectItem key={duration} value={String(duration)}>
                              {t('sched_duration_option', { minutes: duration })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('sched_end_time_label')}
                      </Label>
                      <Input
                        id="end"
                        type="datetime-local"
                        value={formDraft.end}
                        onChange={(event) => handleEndChange(event.target.value)}
                        className="rounded-xl border-[#E5E7EB] focus:outline-none focus:ring-2 ring-sky-300 ring-offset-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('sched_repeat_label')}
                      </Label>
                      <Select value={formDraft.repeat} onValueChange={(value) => handleRepeatChange(value as 'none' | 'weekly')}>
                        <SelectTrigger className="rounded-xl border-[#E5E7EB]">
                          <SelectValue placeholder={t('sched_repeat_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('sched_repeat_none')}</SelectItem>
                          <SelectItem value="weekly">{t('sched_repeat_weekly')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {formDraft.repeat === 'weekly' && (
                        <div className="space-y-3 rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F7F7F9] p-3">
                          <p className="text-xs text-muted-foreground">{t('sched_repeat_weekly_hint')}</p>
                          <ToggleGroup type="multiple" value={formDraft.weekdays.map(String)} onValueChange={handleWeekdaysChange} className="grid grid-cols-4 gap-2">
                            {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                              <ToggleGroupItem key={weekday} value={String(weekday)} className="rounded-xl border-[#E5E7EB] bg-white text-xs">
                                {DateTime.now().set({ weekday: weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 }).toFormat('ccc')}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <Button
                      className="flex-1 rounded-xl bg-blue-600 text-white shadow-md hover:bg-blue-700"
                      onClick={handleCreateAvailability}
                      disabled={savingAvailability}
                    >
                      {savingAvailability && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Plus className="mr-2 h-4 w-4 text-white" />
                      {t('sched_add_time_slot')}
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-xl border-[#E5E7EB]" disabled>
                      <RefreshCw className="mr-2 h-4 w-4 text-emerald-600" />
                      {t('sched_bulk_add')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-[#E5E7EB] bg-white/80 backdrop-blur-md shadow-md">
                <CardHeader>
                  <CardTitle className="text-[18px] font-semibold leading-6 text-[#0F172A]">
                    {t('sched_my_availability')}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {t('sched_my_availability_desc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAvailability ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((index) => (
                        <Skeleton key={index} className="h-16 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : availabilityError ? (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{availabilityError}</div>
                  ) : allTimeCommitments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F7F7F9] py-12 text-center">
                      <Clock className="h-10 w-10 text-cyan-500" />
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{t('sched_no_availability_title')}</p>
                        <p className="text-sm text-muted-foreground">{t('sched_no_availability_desc')}</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[420px] pr-3">
                      <div className="space-y-3">
                        {allTimeCommitments.map((slot) => (
                          <div key={slot.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white/70 backdrop-blur-sm px-4 py-3 shadow-sm">
                            <div>
                              <p className="text-sm font-semibold text-[#0F172A]">
                                {toDisplayRange(slot.startUTC, slot.endUTC, timezone)}
                              </p>
                              {slot.repeat === 'weekly' && (
                                <p className="text-xs text-primary">
                                  {t('sched_repeat_weekly_badge', {
                                    days: (slot.weekdays ?? []).map((day) => DateTime.now().set({ weekday: day as 1 | 2 | 3 | 4 | 5 | 6 | 7 }).toFormat('ccc')).join(', '),
                                  })}
                                </p>
                              )}
                            </div>
                            {slot.booked ? (
                              <div className="flex items-center gap-2 px-3 py-1">
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  {(slot as any).isStandaloneBooking ? t('sched_booking_without_availability') : '已预约'}
                                </span>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                onClick={() => handleDeleteAvailability(slot)}
                                aria-label={t('sched_delete_slot') || 'Delete slot'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </main>

      <AlertDialog open={!!mergeDialog} onOpenChange={(open) => (!open ? handleMergeCancel() : null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sched_merge_dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {mergeDialog && (
                <span>
                  {t('sched_merge_dialog_desc', {
                    range: toDisplayRange(mergeDialog.candidate.startUTC, mergeDialog.candidate.endUTC, timezone),
                  })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleMergeCancel}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleMergeConfirm}>{t('sched_merge_confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rescheduleDialog} onOpenChange={(open) => (!open ? setRescheduleDialog(null) : null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sched_reschedule_dialog_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sched_reschedule_dialog_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rescheduleDialog && (
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {rescheduleDialog.availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('sched_no_availability_slots')}</p>
                ) : (
                  rescheduleDialog.availableSlots.map((slot) => (
                    <Button
                      key={slot.id}
                      variant="outline"
                      className="w-full justify-start text-left"
                      onClick={() => handleRescheduleConfirm(slot.id)}
                      disabled={loadingReschedule}
                    >
                      {toDisplayRange(slot.startUTC, slot.endUTC, timezone)}
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRescheduleDialog(null)}>{t('cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelDialog} onOpenChange={(open) => (!open ? setCancelDialog(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sched_cancel_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sched_cancel_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelDialog(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-rose-600 hover:bg-rose-700">
              {t('sched_cancel_booking')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!editDialog} onOpenChange={(open) => (!open ? setEditDialog(null) : null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sched_edit_availability_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sched_edit_availability_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {t('sched_editing_hour')}: {editDialog.cellStart.setZone(timezone).toFormat('HH:mm')} – {editDialog.cellEnd.setZone(timezone).toFormat('HH:mm')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-start">{t('sched_start_time_label')}</Label>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  defaultValue={editDialog.cellStart.setZone(timezone).toFormat("yyyy-MM-dd'T'HH:mm")}
                  className="focus:outline-none focus:ring-2 ring-sky-300 ring-offset-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end">{t('sched_end_time_label')}</Label>
                <Input
                  id="edit-end"
                  type="datetime-local"
                  defaultValue={editDialog.cellEnd.setZone(timezone).toFormat("yyyy-MM-dd'T'HH:mm")}
                  className="focus:outline-none focus:ring-2 ring-sky-300 ring-offset-1"
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEditDialog(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (!editDialog) return
                const startInput = document.getElementById('edit-start') as HTMLInputElement
                const endInput = document.getElementById('edit-end') as HTMLInputElement
                if (startInput && endInput) {
                  const startUTC = DateTime.fromISO(startInput.value, { zone: timezone }).toUTC().toISO() || ''
                  const endUTC = DateTime.fromISO(endInput.value, { zone: timezone }).toUTC().toISO() || ''
                  handleEditConfirm({ startUTC, endUTC })
                }
              }}
            >
              {t('sched_save_changes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => (!open ? setDeleteDialog(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sched_delete_availability_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && t('sched_delete_availability_desc', {
                range: `${deleteDialog.cellStart.setZone(timezone).toFormat('MM/dd HH:mm')} – ${deleteDialog.cellEnd.setZone(timezone).toFormat('HH:mm')}`
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialog(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-rose-600 hover:bg-rose-700">
              {t('sched_delete_slot')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
