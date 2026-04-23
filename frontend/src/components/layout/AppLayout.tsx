import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { AskBasiretProvider } from '../../contexts/AskBasiretContext'
import AskBasiretFab from '../AskBasiret'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AskBasiretProvider>
      <div className="min-h-screen">
        <Sidebar />
        <main className="md:ms-64 pt-14 md:pt-0 pb-20 md:pb-0">
          <TopBar />
          <div className="px-6 pb-6">{children}</div>
        </main>
        <AskBasiretFab />
      </div>
    </AskBasiretProvider>
  )
}
