import { Navigate } from 'react-router-dom'

// Direct-link entry: `/ask-basiret` bookmarks, sidebar links, etc. land here.
// We forward to the home page with a query flag the FAB picks up and uses to
// auto-open the chat panel (then strips the flag from history). Doing it via
// query param avoids cross-render context coordination — the redirect happens
// before any AppLayout mount/unmount races.
export default function AskBasiretRedirect() {
  return <Navigate to="/dashboard?ask=open" replace />
}
