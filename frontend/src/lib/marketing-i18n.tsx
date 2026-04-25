import { useTranslation } from 'react-i18next'

/**
 * Compatibility shim for ported marketing components from the basiret-landing
 * Next.js repo. Those components were written against an inline `t(en, ar)`
 * helper from a custom React Context. We wrap our existing react-i18next so
 * inline copy ports verbatim.
 *
 * Our existing i18next setup syncs `document.documentElement.dir` on language
 * change — `dir` returned here is purely informational for components that
 * also want a local `dir={dir}` attribute.
 */
type Lang = 'en' | 'ar'

export function useI18n() {
  const { i18n } = useTranslation()
  const raw = (i18n.language ?? 'en').toLowerCase()
  const lang: Lang = raw.startsWith('ar') ? 'ar' : 'en'
  const isAr = lang === 'ar'
  const dir = isAr ? ('rtl' as const) : ('ltr' as const)

  const t = (en: string, ar: string) => (isAr ? ar : en)
  const toggle = () => {
    void i18n.changeLanguage(isAr ? 'en' : 'ar')
  }

  return { t, lang, isAr, dir, toggle }
}
