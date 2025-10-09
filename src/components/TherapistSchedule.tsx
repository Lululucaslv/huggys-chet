
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { DateTime, Interval } from 'luxon'
import { useTranslation } from 'react-i18next'
import { toast } from '../hooks/use-toast'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
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
    const response = await fetch('/api/bookings/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_id: session.user.id,
        therapist_code: session.user.user_metadata?.therapist_code ?? 'FAGHT34X',
        tz: timezone,
        lang,
        date_from: rangeStart.startOf('day').toFormat(API_LOCAL_FORMAT),
        date_to: rangeEnd.endOf('day').toFormat(API_LOCAL_FORMAT),
      }),
    })

    if (!response.ok) {
      throw new Error('Request failed')
    }

    const json = await response.json()
    const list: Booking[] = (json?.data ?? []).map((item: any) => ({
      id: item.bookingId || item.id || crypto.randomUUID(),
      startUTC: item.startUTC || item.start_utc || item.start,
      endUTC: item.endUTC || item.end_utc || item.end,
      status: (item.status || 'confirmed') as BookingStatus,
      clientName: item.client_name || item.client?.name,
      durationMinutes: item.duration_minutes || item.duration,
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
    const previous = availability
    setAvailability((prev) => prev.filter((item) => item.id !== slot.id))

    try {
      if (slot.source === 'supabase') {
        const { error } = await supabase
          .from('therapist_availability')
          .delete()
          .eq('id', slot.id)
          .eq('therapist_code', slot.therapistCode ?? session.user.user_metadata?.therapist_code ?? 'FAGHT34X')
        if (error) throw error
      } else {
        const response = await fetch('/api/availability/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            availability_id: slot.id,
            therapist_code: slot.therapistCode ?? session.user.user_metadata?.therapist_code ?? 'FAGHT34X',
            user_id: session.user.id,
            tz: timezone,
            lang,
          }),
        })
        if (!response.ok) throw new Error('Request failed')
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
        <section className="rounded-2xl border border-[#E5E7EB] bg-white/80 backdrop-blur-md shadow-md">
          <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('sched_summary_timezone')}</p>
                <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                  <Globe className="h-4 w-4" />
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
              {isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('sched_refresh')}
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-8">
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
                    <CalendarIcon className="h-10 w-10 text-primary" />
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
                          <Badge variant="secondary" className="rounded-full bg-blue-50 text-xs uppercase tracking-wide text-primary">
                            {t(`status_${booking.status}`)}
                          </Badge>
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
                  <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
                    <div className="grid" style={{ gridTemplateColumns: `100px repeat(${calendarDays.length}, minmax(0, 1fr))` }}>
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
                    <div className="grid" style={{ gridTemplateColumns: `100px repeat(${calendarDays.length}, minmax(0, 1fr))` }}>
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
                                      className="flex flex-col items-start gap-1 rounded-lg border border-primary/40 bg-white/70 px-2 py-1.5 text-xs text-primary shadow-sm"
                                    >
                                      <span className="font-medium">{t('sched_calendar_available')}</span>
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
          </div>

          <div className="flex flex-col gap-6 lg:col-span-4">
            <div className="sticky top-6 flex flex-col gap-6">
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
                        className="rounded-xl border-[#E5E7EB]"
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
                        className="rounded-xl border-[#E5E7EB]"
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
                      <Plus className="mr-2 h-4 w-4" />
                      {t('sched_add_time_slot')}
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-xl border-[#E5E7EB]" disabled>
                      <RefreshCw className="mr-2 h-4 w-4" />
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
                  ) : enrichedAvailability.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F7F7F9] py-12 text-center">
                      <Clock className="h-10 w-10 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A]">{t('sched_no_availability_title')}</p>
                        <p className="text-sm text-muted-foreground">{t('sched_no_availability_desc')}</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[420px] pr-3">
                      <div className="space-y-3">
                        {enrichedAvailability.map((slot) => (
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
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">已预约</span>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full text-[#0F172A]/70"
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
            </div>
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
    </div>
  )
}
