import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

// TopBar previously held a duplicate page title, a mock-state date range
// dropdown, and a language toggle. Per user request all three were removed:
// page titles live in each page's own header, date ranges are page-scoped
// segmented controls, and the language toggle moved to Settings → Profile.
// We keep this component as a no-op host for the dir-sync effect so the
// language preference set in Settings (or restored from localStorage by
// i18next) propagates `<html dir>` consistently on every navigation.
export default function TopBar() {
  const { i18n } = useTranslation()
  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = i18n.language
  }, [i18n.language])
  return null
}
