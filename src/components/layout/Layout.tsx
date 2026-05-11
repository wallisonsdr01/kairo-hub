import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f5f5f7' }}>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, static on md+ */}
      <div
        className={`
          fixed md:relative inset-y-0 left-0 z-40 md:z-auto h-full
          transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar onMobileClose={() => setMobileOpen(false)} />
      </div>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar — only visible below md */}
        <div
          className="flex md:hidden items-center h-12 px-4 border-b flex-shrink-0 gap-3"
          style={{ background: 'linear-gradient(90deg, #1a1a2e 0%, #12122a 100%)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.7)' }}
            aria-label="Abrir menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            {/* Hexagon mini mark */}
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{
                width: 20, height: 20,
                background: 'linear-gradient(145deg, #e94560 0%, #c23050 100%)',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              }}
            >
              <span style={{
                color: '#fff', fontWeight: 800, fontSize: 7,
                fontFamily: "'Playfair Display', Georgia, serif",
                fontStyle: 'italic', lineHeight: 1,
              }}>K</span>
            </div>
            <span
              className="text-[13px] font-semibold tracking-tight"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                color: '#ffffff',
              }}
            >
              Kairo<span style={{ color: '#e94560', fontStyle: 'italic' }}>Hub</span>
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
