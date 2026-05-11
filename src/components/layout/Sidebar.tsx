import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Sparkles, Calendar, CheckSquare, BookOpen,
  LogOut, ChevronLeft, ChevronRight, History, Wallet, NotebookPen,
} from 'lucide-react'
import { cn } from '@/utils/formatters'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { href: '/',          icon: LayoutDashboard, label: 'Dashboard'       },
  { href: '/clients',   icon: Users,            label: 'Clientes'        },
  { href: '/content',   icon: Sparkles,         label: 'Gerar Conteúdo'  },
  { href: '/history',   icon: History,          label: 'Histórico'       },
  { href: '/planner',   icon: Calendar,         label: 'Planejamento'    },
  { href: '/tasks',     icon: CheckSquare,      label: 'Tarefas'         },
  { href: '/notes',     icon: NotebookPen,      label: 'Notas'           },
  { href: '/library',   icon: BookOpen,         label: 'Biblioteca'      },
  { href: '/financial', icon: Wallet,           label: 'Financeiro'      },
]

// ── Kairo Hub logo mark ───────────────────────────────────────────────────────

function HexMark({ size = 28 }: { size?: number }) {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, #1a1a2e 0%, #252550 100%)',
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
      }}
    >
      <span style={{
        color: '#ffffff',
        fontWeight: 800,
        fontSize: size * 0.38,
        letterSpacing: '-0.03em',
        fontFamily: "'Playfair Display', Georgia, serif",
        fontStyle: 'italic',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        K
      </span>
    </div>
  )
}

function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-0">
      <HexMark size={28} />

      {!collapsed && (
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          className="leading-none min-w-0"
        >
          <span
            className="block text-[14px] tracking-tight whitespace-nowrap"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 700,
              color: '#1a1a2e',
            }}
          >
            Kairo<span style={{ color: '#e94560', fontStyle: 'italic' }}>Hub</span>
          </span>
        </motion.div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  onMobileClose?: () => void
}

export function Sidebar({ onMobileClose }: SidebarProps) {
  const location  = useLocation()
  const { signOut, profile } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  // Close mobile sidebar on route change
  useEffect(() => {
    onMobileClose?.()
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col h-full bg-white border-r border-[#e8e8e8] overflow-hidden flex-shrink-0"
    >
      {/* Brand header */}
      <div className="flex items-center h-14 px-3.5 border-b border-[#e8e8e8]">
        <BrandMark collapsed={collapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            location.pathname === item.href ||
            (item.href !== '/' && location.pathname.startsWith(item.href))

          return (
            <Link key={item.href} to={item.href}>
              <div
                title={collapsed ? item.label : undefined}
                style={active ? { color: '#ffffff' } : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-all duration-150 group',
                  active
                    ? 'bg-[#1a1a2e] font-medium'
                    : 'text-[#737373] hover:bg-[#f5f5f5] hover:text-[#1a1a2e]'
                )}
              >
                <item.icon
                  style={active ? { color: '#ffffff' } : undefined}
                  className={cn(
                    'w-[15px] h-[15px] flex-shrink-0 transition-colors',
                    active ? '' : 'text-[#b0b0b0] group-hover:text-[#737373]'
                  )}
                />
                {!collapsed && (
                  <span style={active ? { color: '#ffffff' } : undefined} className="whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Profile + sign out */}
      <div className="p-2 border-t border-[#f0f0f0] space-y-1">
        {!collapsed && profile && (
          <div className="px-2.5 py-2 rounded-xl bg-[#fafafa] mb-1">
            <p className="text-[12px] font-medium text-[#0f0f0f] truncate">
              {profile.full_name || 'Usuário'}
            </p>
            <p className="text-[11px] text-[#a0a0a0] truncate">{profile.email}</p>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] text-[#a0a0a0] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] transition-colors duration-150"
        >
          <LogOut className="w-[15px] h-[15px] flex-shrink-0 text-[#c0c0c0]" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Collapse toggle — hidden on mobile since sidebar is overlay */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full border border-[#e8e8e8] bg-white hidden md:flex items-center justify-center text-[#a0a0a0] hover:text-[#0f0f0f] hover:border-[#d0d0d0] transition-colors shadow-sm"
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft className="w-3 h-3" />}
      </button>
    </motion.aside>
  )
}
