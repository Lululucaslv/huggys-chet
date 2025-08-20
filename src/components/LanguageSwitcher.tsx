import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'zh', label: '中文' }
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.resolvedLanguage || i18n.language || 'en'

  return (
    <div className="flex items-center gap-2">
      {languages.map(l => (
        <button
          key={l.code}
          onClick={() => i18n.changeLanguage(l.code)}
          className={`px-2 py-1 rounded text-sm ${current === l.code ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-800'}`}
          aria-pressed={current === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
