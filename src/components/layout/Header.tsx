import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { NotificationsModal } from '@/components/NotificationsModal'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  dark?: boolean
}

export function Header({ title, subtitle, action, dark = true }: HeaderProps) {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const { data: notifications = [] } = useNotifications()
  const [showNotifications, setShowNotifications] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  const rawName: string =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    ''
  const firstName      = rawName.split(' ')[0] || 'usuário'
  const avatarInitial  = (rawName || profile?.email || 'U')[0].toUpperCase()
  const unreadCount    = notifications.filter(n => !n.is_read).length

  return (
    <>
      <header className={`h-14 border-b flex items-center px-5 gap-4 sticky top-0 z-20 ${
        dark
          ? 'bg-[#1a1a2e] border-white/10'
          : 'bg-white border-gray-100'
      }`}>
        <div className="flex-1 min-w-0">
          <h1 className={`text-[13px] font-semibold leading-none ${dark ? 'text-white' : 'text-[#0f0f0f]'}`}>
            {title}
          </h1>
          {subtitle && (
            <p className={`text-[11px] mt-0.5 ${dark ? 'text-white/50' : 'text-[#a0a0a0]'}`}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {action}

          {/* Bell — notificações da agência */}
          <button
            onClick={() => setShowNotifications(true)}
            title={unreadCount > 0 ? `${unreadCount} notificação${unreadCount === 1 ? '' : 'ões'} não lida${unreadCount === 1 ? '' : 's'}` : 'Notificações'}
            className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              dark ? 'hover:bg-white/10' : 'hover:bg-[#f0f0f0]'
            }`}
          >
            <Bell className={`w-4 h-4 ${dark ? 'text-white/70' : 'text-[#737373]'}`} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center px-0.5 leading-none text-white"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <div className={`flex items-center gap-2 ml-1 pl-2 border-l ${dark ? 'border-white/15' : 'border-[#e8e8e8]'}`}>
            <div className="text-right hidden sm:block">
              <p className={`text-[11px] ${dark ? 'text-white/50' : 'text-[#a0a0a0]'}`}>{greeting},</p>
              <p className={`text-[11px] font-medium ${dark ? 'text-white' : 'text-[#0f0f0f]'}`}>{firstName}</p>
            </div>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${
              dark ? 'bg-white/15 border border-white/20' : 'bg-[#1a1a2e] border border-[#1a1a2e]'
            }`}>
              <span className="text-white">{avatarInitial}</span>
            </div>
          </div>
        </div>
      </header>

      <NotificationsModal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        onView={(notification) => {
          setShowNotifications(false)
          if (notification.link) {
            navigate(`/planner?item=${notification.link}`)
          } else {
            navigate('/planner')
          }
        }}
      />
    </>
  )
}
