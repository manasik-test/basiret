import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './en.json'
import ar from './ar.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

// Keep <html dir> and <html lang> in sync globally — runs for every route
// including public marketing pages, where the app-shell sync (Sidebar/TopBar)
// is not mounted. Guarded with `typeof document` so this module is safe to
// import in non-DOM environments (vitest collection runs before jsdom is
// fully ready in some test-file orderings).
const syncDocumentDirection = (lang: string) => {
  if (typeof document === 'undefined') return
  const isAr = lang.toLowerCase().startsWith('ar')
  document.documentElement.dir = isAr ? 'rtl' : 'ltr'
  document.documentElement.lang = isAr ? 'ar' : 'en'
}
syncDocumentDirection(i18n.language || 'en')
i18n.on('languageChanged', syncDocumentDirection)

export default i18n
