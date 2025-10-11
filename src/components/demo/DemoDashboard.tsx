import { useTranslation } from 'react-i18next'
import { Calendar, TrendingUp, TrendingDown, Minus, MessageCircle, ArrowRight } from 'lucide-react'
import { Card } from '../shared/Card'
import { Banner } from '../shared/Banner'
import { PrimaryButton } from '../shared/PrimaryButton'
import { SecondaryButton } from '../shared/SecondaryButton'
import { useAuthGate } from '../../contexts/AuthGateContext'
import { useBookings, useAssessments, useChatPreview } from '../../hooks/useDataSource'
import { DateTime } from 'luxon'

export function DemoDashboard() {
  const { t } = useTranslation()
  const { openRegisterDrawer } = useAuthGate()
  const { bookings } = useBookings()
  const { assessments } = useAssessments()
  const { chatPreview } = useChatPreview()

  const handleDemoAction = (source: string) => {
    openRegisterDrawer(source)
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingDown className="h-4 w-4 text-[var(--success-600)]" />
      case 'worsening':
        return <TrendingUp className="h-4 w-4 text-[var(--danger-600)]" />
      default:
        return <Minus className="h-4 w-4 text-[var(--muted)]" />
    }
  }

  const formatBookingTime = (utcISO: string) => {
    const dt = DateTime.fromISO(utcISO, { zone: 'utc' }).setZone('America/New_York')
    return dt.toFormat('MMM dd, yyyy • HH:mm')
  }

  const formatChatTime = (utcISO: string) => {
    const dt = DateTime.fromISO(utcISO, { zone: 'utc' }).setZone('America/New_York')
    return dt.toFormat('MMM dd, HH:mm')
  }

  const formatToday = () => {
    return DateTime.now().setZone('America/New_York').toFormat('EEEE, MMMM dd, yyyy')
  }

  return (
    <div className="space-y-6">
      <Banner type="info" text={t('demo.banner')} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[var(--brand-600)]" />
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {t('sched_upcoming_bookings')}
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border border-[var(--line)] rounded-lg p-4 hover:border-[var(--brand-400)] transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-[var(--text)]">{booking.therapist_name}</h3>
                      <p className="text-sm text-[var(--muted)]">
                        {formatBookingTime(booking.start_utc)}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-green-100 text-[var(--success-600)] rounded-full">
                      {t('status_confirmed')}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <SecondaryButton
                      size="sm"
                      onClick={() => handleDemoAction('reschedule-booking')}
                    >
                      {t('sched_reschedule_booking')}
                    </SecondaryButton>
                    <SecondaryButton
                      size="sm"
                      onClick={() => handleDemoAction('cancel-booking')}
                    >
                      {t('cancel')}
                    </SecondaryButton>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <PrimaryButton
                onClick={() => handleDemoAction('new-booking')}
                className="w-full"
              >
                {t('landing.tryBooking')}
              </PrimaryButton>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-[var(--accent-500)]" />
              <h2 className="text-lg font-semibold text-[var(--text)]">
                {t('features.assessments.title')}
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {assessments.map((assessment) => (
                <div
                  key={assessment.id}
                  className="border border-[var(--line)] rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-[var(--text)]">{assessment.type}</h3>
                      <p className="text-xs text-[var(--muted)]">{assessment.name}</p>
                    </div>
                    {getTrendIcon(assessment.trend)}
                  </div>
                  
                  <div className="mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-[var(--text)]">
                        {assessment.lastScore}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {assessment.lastDate}
                      </span>
                    </div>
                  </div>

                  <SecondaryButton
                    size="sm"
                    onClick={() => handleDemoAction(`start-${assessment.type.toLowerCase()}`)}
                    className="w-full"
                  >
                    {t('landing.tryAssessment')}
                  </SecondaryButton>
                </div>
              ))}
            </div>
          </Card>

          {chatPreview && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="h-5 w-5 text-[var(--success-600)]" />
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {t('features.chat.title')}
                </h2>
              </div>

              <div className="border border-[var(--line)] rounded-lg p-4 mb-4">
                <p className="text-sm text-[var(--text)] mb-2">
                  {chatPreview.lastMessage}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatChatTime(chatPreview.timestamp)}
                </p>
              </div>

              <PrimaryButton
                onClick={() => handleDemoAction('continue-chat')}
                className="w-full"
              >
                {t('landing.tryChat')} <ArrowRight className="ml-2 h-4 w-4" />
              </PrimaryButton>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-[var(--text)] mb-4">
              {t('today')}
            </h3>
            <p className="text-sm text-[var(--muted)]">
              {formatToday()}
            </p>
          </Card>

          <Card>
            <h3 className="font-semibold text-[var(--text)] mb-4">
              {t('try_features')}
            </h3>
            <div className="space-y-2">
              <SecondaryButton
                size="sm"
                onClick={() => handleDemoAction('book-session')}
                className="w-full justify-start"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {t('landing.tryBooking')}
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                onClick={() => handleDemoAction('take-assessment')}
                className="w-full justify-start"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {t('landing.tryAssessment')}
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                onClick={() => handleDemoAction('chat-ai')}
                className="w-full justify-start"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {t('landing.tryChat')}
              </SecondaryButton>
            </div>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <p className="text-sm text-[var(--text)] mb-4">
              {t('demo.actionBlocked')}
            </p>
            <PrimaryButton
              onClick={() => handleDemoAction('help')}
              className="w-full"
              size="sm"
            >
              {t('hero.ctaStart')}
            </PrimaryButton>
          </Card>
        </div>
      </div>
    </div>
  )
}
