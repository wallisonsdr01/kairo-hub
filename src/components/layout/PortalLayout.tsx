import { LogOut, User, Bell } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface PortalLayoutProps {
  children: React.ReactNode
  clientName?: string
  unreadCount?: number
  onBellClick?: () => void
  /** @deprecated use unreadCount */
  pendingCount?: number
}

export function PortalLayout({
  children,
  clientName,
  unreadCount = 0,
  onBellClick,
  pendingCount,
}: PortalLayoutProps) {
  const { profile, signOut } = useAuth()

  // Compatibilidade retroativa: se unreadCount não foi passado mas pendingCount foi
  const badgeCount = unreadCount || pendingCount || 0

  const rawName   = profile?.full_name || ''
  const firstName = rawName.split(' ')[0] || 'Cliente'
  const initial   = (rawName || profile?.email || 'C')[0].toUpperCase()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0e0e20' }}>
      {/* Top bar */}
      <header
        className="h-14 border-b border-white/10 flex items-center px-6 flex-shrink-0 sticky top-0 z-30"
        style={{ background: 'linear-gradient(90deg, #1a1a2e 0%, #12122a 100%)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-1">
          {/* Hexagon mark */}
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: 28, height: 28,
              background: 'linear-gradient(145deg, #e94560 0%, #c23050 100%)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }}
          >
            <span style={{
              color: '#ffffff', fontWeight: 800, fontSize: 11,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: 'italic', lineHeight: 1, userSelect: 'none',
            }}>K</span>
          </div>
          <span
            className="font-semibold text-[14px] tracking-tight"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: '#ffffff',
            }}
          >
            Kairo<span style={{ color: '#e94560', fontStyle: 'italic' }}>Hub</span>
          </span>
          {clientName && (
            <>
              <span className="text-white/30 text-xs mx-1">/</span>
              <span className="text-white/50 text-[12px]">{clientName}</span>
            </>
          )}
        </div>

        {/* Bell */}
        <button
          onClick={onBellClick}
          title={badgeCount > 0 ? `${badgeCount} notificação${badgeCount === 1 ? '' : 'ões'} não lida${badgeCount === 1 ? '' : 's'}` : 'Notificações'}
          className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors mr-1"
        >
          <Bell className="w-4 h-4 text-white/70" />
          {badgeCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center px-0.5 leading-none"
              style={{ color: '#ffffff' }}
            >
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </button>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
              {initial !== 'C' ? (
                <span className="text-[11px] font-semibold" style={{ color: '#ffffff' }}>{initial}</span>
              ) : (
                <User className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
              )}
            </div>
            <span className="text-[13px] text-white font-medium hidden sm:block">{firstName}</span>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Sair</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
