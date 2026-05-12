/**
 * Vitest setup — runs once before each test file.
 *
 * Adds the Testing Library jest-dom matchers (`toBeInTheDocument`, etc.)
 * and resets i18next + react-i18next side effects between tests so each
 * test sees a clean language state.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

import i18n from './i18n'

beforeEach(() => {
  // Reset language to English between tests so test assertions are stable
  // regardless of the order they run in.
  i18n.changeLanguage('en')
  if (typeof document !== 'undefined') {
    document.documentElement.dir = 'ltr'
    document.documentElement.lang = 'en'
  }
  // jsdom doesn't implement window.scrollTo; the wizard calls it on every
  // step transition for legitimate UX. Stub it so tests don't spew stderr.
  if (typeof window !== 'undefined') {
    window.scrollTo = (() => {}) as typeof window.scrollTo
  }
  // jsdom also doesn't implement Element.prototype.scrollIntoView — the
  // image step uses it to scroll the result card into view on success.
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function () {} as never
  }
})

afterEach(() => {
  cleanup()
})
