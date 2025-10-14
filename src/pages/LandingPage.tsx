import { useTranslation } from 'react-i18next'
import { Calendar, ClipboardList, MessageCircle, ArrowRight } from 'lucide-react'
import { PrimaryButton } from '../components/shared/PrimaryButton'
import { SecondaryButton } from '../components/shared/SecondaryButton'
import { Card } from '../components/shared/Card'
import { DemoDashboard } from '../components/demo/DemoDashboard'
import { useGateStore } from '../lib/useAuthGate'

export function LandingPage() {
  const { t } = useTranslation()
  const { setOpen } = useGateStore()

  const scrollToDemoSection = () => {
    const demoSection = document.getElementById('demo-section')
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleAuthClick = () => {
    setOpen(true)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="bg-[var(--card)] border-b border-[var(--line)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src="/logo-blue-blob.jpg" alt="Huggys logo" className="h-10 w-10 rounded-full shadow-sm" />
              <h1 className="text-xl font-semibold text-[var(--text)]">Huggys.ai</h1>
            </div>
            <div className="flex items-center gap-4">
              <SecondaryButton onClick={handleAuthClick} size="sm">
                {t('auth_login')}
              </SecondaryButton>
              <PrimaryButton onClick={handleAuthClick} size="sm">
                {t('hero.ctaStart')}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl font-bold text-[var(--text)] mb-6">
              {t('hero.title')}
            </h1>
            <p className="text-xl text-[var(--muted)] mb-10 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <PrimaryButton onClick={handleAuthClick} className="text-lg px-8 py-3">
                {t('hero.ctaStart')} <ArrowRight className="ml-2 h-5 w-5" />
              </PrimaryButton>
              <SecondaryButton onClick={scrollToDemoSection} className="text-lg px-8 py-3">
                {t('hero.ctaDemo')}
              </SecondaryButton>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[var(--bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-100 p-4 rounded-full">
                  <Calendar className="h-8 w-8 text-[var(--brand-600)]" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-[var(--text)] mb-3">
                {t('features.booking.title')}
              </h3>
              <p className="text-[var(--muted)]">
                {t('features.booking.desc')}
              </p>
            </Card>

            <Card className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-purple-100 p-4 rounded-full">
                  <ClipboardList className="h-8 w-8 text-[var(--accent-500)]" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-[var(--text)] mb-3">
                {t('features.assessments.title')}
              </h3>
              <p className="text-[var(--muted)]">
                {t('features.assessments.desc')}
              </p>
            </Card>

            <Card className="p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-green-100 p-4 rounded-full">
                  <MessageCircle className="h-8 w-8 text-[var(--success-600)]" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-[var(--text)] mb-3">
                {t('features.chat.title')}
              </h3>
              <p className="text-[var(--muted)]">
                {t('features.chat.desc')}
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section id="demo-section" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[var(--text)] mb-4">
              {t('landing.demoTitle')}
            </h2>
            <p className="text-[var(--muted)] text-lg">
              {t('landing.demoSubtitle')}
            </p>
          </div>
          <DemoDashboard />
        </div>
      </section>

      <footer className="bg-[var(--card)] border-t border-[var(--line)] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <img src="/logo-blue-blob.jpg" alt="Huggys logo" className="h-8 w-8 rounded-full shadow-sm" />
                <h2 className="text-lg font-semibold text-[var(--text)]">Huggys.ai</h2>
              </div>
            </div>
            
            <div className="border-t border-[var(--line)] pt-6">
              <p className="text-xs text-[var(--danger-600)] mb-2 font-semibold">
                {t('crisis_notice')}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {t('crisis_help')}
              </p>
            </div>
            
            <div className="mt-6 text-xs text-[var(--muted)]">
              © 2025 Huggys.ai
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
