import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Sparkles, CheckSquare, ArrowRight, Plus, Clock,
  AlertTriangle, TrendingUp, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, BarChart3,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { formatRelative, contentTypeLabels } from '@/utils/formatters'
import {
  startOfWeek, endOfWeek, startOfDay, endOfDay,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval,
  format, isToday, addDays, subDays, startOfToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MetricsCarousel } from '@/components/dashboard/MetricsCarousel'

// ─── Approval helpers (única fonte de verdade) ───────────────────────────────
//
// Regra EXATAMENTE alinhada com o filtro "Pendentes" do Planejamento:
//   (i.approval_status || 'pendente_aprovacao') === 'pendente_aprovacao'
//
// O Planejamento NÃO filtra por status de produção (ideia/producao/revisao/etc.).
// Qualquer item cujo approval_status seja null, vazio ou 'pendente_aprovacao' é "pendente".
// Também contamos 'ajuste_realizado': o ajuste foi feito e voltou para o cliente revisar.
//
// NÃO contam: 'aprovado', 'reprovado', 'ajuste_solicitado'
function isAwaitingApproval(item: { approval_status: string | null }): boolean {
  const as = item.approval_status
  return as !== 'aprovado' && as !== 'reprovado' && as !== 'ajuste_solicitado'
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodMode = 'dia' | 'semana' | 'mes' | 'ano' | 'custom'

interface DateRange { start: Date; end: Date }

interface Stats {
  total_clients:         number
  active_clients:        number
  pending_tasks:         number
  overdue_tasks:         number
  period_pending_approval: number
  period_approved:         number
}

interface PlannerDay {
  id: string
  title: string
  content_type: string
  status: string
  scheduled_date: string
}

interface PlannerChartEntry {
  label: string
  value: number
  color: string
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function computeRange(mode: PeriodMode, custom: DateRange): DateRange {
  const now = new Date()
  switch (mode) {
    case 'dia':    return { start: startOfDay(now),   end: endOfDay(now) }
    case 'semana': return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) }
    case 'mes':    return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'ano':    return { start: startOfYear(now),  end: endOfYear(now) }
    case 'custom': return custom
  }
}

function buildBarData(
  mode: PeriodMode,
  range: DateRange,
  contents: { created_at: string }[],
): { day: string; conteudos: number }[] {
  if (mode === 'ano') {
    return eachMonthOfInterval(range).map(m => ({
      day: format(m, 'MMM', { locale: ptBR }),
      conteudos: contents.filter(c => c.created_at.startsWith(format(m, 'yyyy-MM'))).length,
    }))
  }
  // dia / semana / mes / custom — daily buckets (capped at 60 days)
  const days = eachDayOfInterval({
    start: range.start,
    end: range.end,
  }).slice(0, 60)
  return days.map(d => ({
    day: format(d, mode === 'semana' ? 'EEE' : 'd/M', { locale: ptBR }),
    conteudos: contents.filter(c => c.created_at.startsWith(format(d, 'yyyy-MM-dd'))).length,
  }))
}

function rangeLabel(mode: PeriodMode, range: DateRange): string {
  if (mode === 'dia')    return format(range.start, "d 'de' MMM", { locale: ptBR })
  if (mode === 'ano')    return format(range.start, 'yyyy')
  return `${format(range.start, 'd MMM', { locale: ptBR })} – ${format(range.end, 'd MMM yyyy', { locale: ptBR })}`
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  mode:          PeriodMode
  range:         DateRange
  customRange:   DateRange
  onMode:        (m: PeriodMode) => void
  onCustomRange: (r: DateRange) => void
}

function FilterBar({ mode, range, customRange, onMode, onCustomRange }: FilterBarProps) {
  const [open, setOpen]         = useState(false)
  const [tempS, setTempS]       = useState(format(customRange.start, 'yyyy-MM-dd'))
  const [tempE, setTempE]       = useState(format(customRange.end,   'yyyy-MM-dd'))
  const popoverRef              = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function applyCustom() {
    if (!tempS || !tempE) return
    onCustomRange({ start: new Date(tempS + 'T00:00:00'), end: new Date(tempE + 'T23:59:59') })
    onMode('custom')
    setOpen(false)
  }

  const pills: { key: PeriodMode; label: string }[] = [
    { key: 'dia',    label: 'Dia'    },
    { key: 'semana', label: 'Semana' },
    { key: 'mes',    label: 'Mês'    },
    { key: 'ano',    label: 'Ano'    },
  ]

  return (
    <div className="bg-white border-b border-gray-100 px-5 md:px-7 py-3 flex items-center justify-between gap-4 flex-wrap">
      {/* Period pills */}
      <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
        {pills.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onMode(key)}
            style={mode === key ? { color: '#ffffff' } : undefined}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              mode === key
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date range button + popover */}
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => {
            setTempS(format(customRange.start, 'yyyy-MM-dd'))
            setTempE(format(customRange.end,   'yyyy-MM-dd'))
            setOpen(v => !v)
          }}
          className={`flex items-center gap-2 text-[12px] border rounded-xl px-3 py-1.5 transition-colors ${
            mode === 'custom'
              ? 'text-gray-900 bg-gray-50 border-gray-300 font-medium'
              : 'text-gray-400 bg-gray-50 border-gray-100 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="capitalize whitespace-nowrap">{rangeLabel(mode, range)}</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl p-4 w-[260px]">
            <p className="text-[12px] font-semibold text-gray-800 mb-3">Período personalizado</p>
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Data inicial</label>
                <input
                  type="date"
                  value={tempS}
                  onChange={e => setTempS(e.target.value)}
                  className="w-full h-8 px-3 rounded-lg border border-gray-200 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400/40 focus:border-gray-400"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Data final</label>
                <input
                  type="date"
                  value={tempE}
                  min={tempS}
                  onChange={e => setTempE(e.target.value)}
                  className="w-full h-8 px-3 rounded-lg border border-gray-200 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400/40 focus:border-gray-400"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 h-8 rounded-lg text-[12px] text-gray-500 hover:bg-gray-50 border border-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={applyCustom}
                disabled={!tempS || !tempE || tempE < tempS}
                className="flex-1 h-8 rounded-lg text-[12px] bg-gray-900 text-white hover:bg-gray-800 transition-colors font-medium disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, subtitle, href, icon: Icon,
  iconBg = 'bg-gray-100', iconColor = 'text-gray-500',
  featured = false, warning = false,
}: {
  label:      string
  value:      number
  subtitle?:  string
  href?:      string
  icon:       React.ElementType
  iconBg?:    string
  iconColor?: string
  featured?:  boolean
  warning?:   boolean
}) {
  const showWarning = warning && value > 0

  const inner = featured ? (
    <div className="h-full rounded-3xl bg-gray-900 p-5 flex flex-col gap-4 hover:bg-gray-800 transition-colors duration-200" style={{ color: '#ffffff' }}>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
          <Icon className="w-[18px] h-[18px]" style={{ color: '#ffffff' }} />
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Total
        </span>
      </div>
      <div>
        <p className="text-3xl font-semibold tabular-nums leading-none" style={{ color: '#ffffff' }}>{value}</p>
        <p className="text-[13px] font-medium mt-2 leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</p>
        {subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{subtitle}</p>}
      </div>
    </div>
  ) : (
    <div className={`h-full rounded-3xl border bg-white p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all duration-200 ${
      showWarning ? 'border-red-100' : 'border-gray-100'
    }`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${showWarning ? 'bg-red-50' : iconBg}`}>
          <Icon className={`w-[18px] h-[18px] ${showWarning ? 'text-red-400' : iconColor}`} />
        </div>
        {showWarning && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-400 border border-red-100">
            Atenção
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-semibold text-gray-900 tabular-nums leading-none">{value}</p>
        <p className="text-[13px] font-medium text-gray-600 mt-2 leading-tight">{label}</p>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )

  if (href) return <Link to={href} className="block h-full" style={{ color: 'inherit' }}>{inner}</Link>
  return inner
}

// ─── Status dot colours ───────────────────────────────────────────────────────

const statusDotColor: Record<string, string> = {
  ideia:     'bg-purple-400',
  producao:  'bg-blue-400',
  revisao:   'bg-amber-400',
  aprovado:  'bg-emerald-400',
  publicado: 'bg-green-400',
}

// ─── Calendar Widget ──────────────────────────────────────────────────────────

function CalendarWidget({ items }: { items: PlannerDay[] }) {
  const today = startOfToday()
  const todayStr = format(today, 'yyyy-MM-dd')

  // offset desloca o centro da faixa de 5 dias (em unidades de 5)
  const [offset, setOffset]         = useState(0)
  // dia selecionado — começa com hoje
  const [selectedStr, setSelectedStr] = useState<string>(todayStr)

  const center = addDays(today, offset)
  const days   = [-2, -1, 0, 1, 2].map(d => addDays(center, d))

  // itens do dia selecionado
  const selectedItems = items.filter(i => i.scheduled_date === selectedStr)

  // label do dia selecionado
  const selectedDate = new Date(selectedStr + 'T12:00:00')
  const selectedLabel =
    selectedStr === todayStr
      ? 'Hoje'
      : format(selectedDate, "d 'de' MMM", { locale: ptBR })

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      {/* Month + nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setOffset(o => o - 5)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <h3 className="text-[13px] font-semibold text-gray-900 capitalize">
          {format(center, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <button
          onClick={() => setOffset(o => o + 5)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-5 mb-2">
        {days.map(day => (
          <div key={day.toISOString()} className="text-center text-[10px] font-medium text-gray-400 py-1 capitalize">
            {format(day, 'EEE', { locale: ptBR }).replace('.', '')}
          </div>
        ))}
      </div>

      {/* Day numbers — clicar SELECIONA o dia, sem navegar */}
      <div className="grid grid-cols-5 gap-1 mb-4">
        {days.map(day => {
          const dayStr    = format(day, 'yyyy-MM-dd')
          const dayItems  = items.filter(i => i.scheduled_date === dayStr)
          const isSelected = dayStr === selectedStr
          const isCurrent  = isToday(day)
          return (
            <div
              key={dayStr}
              onClick={() => setSelectedStr(dayStr)}
              className={`flex flex-col items-center py-2.5 rounded-2xl cursor-pointer transition-all duration-150 select-none ${
                isSelected
                  ? 'bg-gray-900'
                  : 'hover:bg-gray-50 border border-transparent hover:border-gray-100'
              }`}
            >
              <span
                className={`text-[15px] font-semibold leading-none`}
                style={{ color: isSelected ? '#ffffff' : isCurrent ? '#1a1a2e' : '#374151' }}
              >
                {format(day, 'd')}
              </span>
              {/* ponto coral no dia de hoje quando não está selecionado */}
              {isCurrent && !isSelected && (
                <div className="w-1 h-1 rounded-full mt-1" style={{ background: '#e94560' }} />
              )}
              {dayItems.length > 0 && (
                <div className="flex gap-0.5 mt-1 justify-center flex-wrap">
                  {dayItems.slice(0, 3).map(item => (
                    <div
                      key={item.id}
                      className={`w-1 h-1 rounded-full ${
                        isSelected ? 'bg-white/60' : (statusDotColor[item.status] ?? 'bg-gray-400')
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Posts do dia selecionado */}
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {selectedLabel}
      </p>
      {selectedItems.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-1">Nenhum post nesse dia</p>
      ) : (
        <div className="space-y-1.5">
          {selectedItems.slice(0, 3).map(item => (
            <div key={item.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-50">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotColor[item.status] ?? 'bg-gray-300'}`} />
              <p className="text-[12px] text-gray-800 truncate flex-1 font-medium">{item.title}</p>
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                {contentTypeLabels[item.content_type as any] ?? item.content_type}
              </span>
            </div>
          ))}
          {selectedItems.length > 3 && (
            <Link to="/planner">
              <p className="text-[11px] text-gray-400 hover:text-gray-700 text-center transition-colors mt-1">
                +{selectedItems.length - 3} mais →
              </p>
            </Link>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 flex-wrap pt-4 border-t border-gray-50">
        {Object.entries(statusDotColor).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
            <span className="text-[10px] text-gray-400 capitalize">
              {status === 'producao' ? 'Prod.' : status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Alerts Widget ────────────────────────────────────────────────────────────

function AlertsWidget({
  pendingApproval, overdueTasks, pendingTasks, periodApproved,
}: {
  pendingApproval: number
  overdueTasks:    number
  pendingTasks:    number
  periodApproved:  number
}) {
  const allGood = pendingApproval === 0 && overdueTasks === 0

  const rows = [
    { icon: CheckCircle2, label: 'Aprovados no período',    value: periodApproved,  color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/planner' },
    { icon: Clock,        label: 'Aguardando aprovação',    value: pendingApproval, color: pendingApproval > 0 ? 'text-amber-600'  : 'text-gray-400', bg: pendingApproval > 0 ? 'bg-amber-50'  : 'bg-gray-50', href: '/planner' },
    { icon: CheckSquare,  label: 'Tarefas em aberto',       value: pendingTasks,    color: pendingTasks    > 0 ? 'text-blue-600'   : 'text-gray-400', bg: pendingTasks    > 0 ? 'bg-blue-50'   : 'bg-gray-50', href: '/tasks'   },
    { icon: AlertTriangle,label: 'Tarefas atrasadas',       value: overdueTasks,    color: overdueTasks    > 0 ? 'text-red-500'    : 'text-gray-400', bg: overdueTasks    > 0 ? 'bg-red-50'    : 'bg-gray-50', href: '/tasks'   },
  ]

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${allGood ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          {allGood
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            : <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
          }
        </div>
        <h3 className="text-[14px] font-semibold text-gray-900">Resumo</h3>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <Link key={i} to={row.href}>
            <div className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-gray-50 transition-colors group cursor-pointer">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${row.bg}`}>
                <row.icon className={`w-3.5 h-3.5 ${row.color}`} />
              </div>
              <p className="text-[12px] text-gray-600 flex-1 leading-snug">{row.label}</p>
              <span className={`text-[14px] font-semibold tabular-nums ${row.color}`}>{row.value}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth()

  // ── Period state (single source of truth) ─────────────────────────────────
  const defaultCustom: DateRange = {
    start: startOfWeek(new Date(), { locale: ptBR }),
    end:   endOfWeek(new Date(),   { locale: ptBR }),
  }
  const [periodMode, setPeriodMode]   = useState<PeriodMode>('semana')
  const [customRange, setCustomRange] = useState<DateRange>(defaultCustom)

  const range = useMemo(
    () => computeRange(periodMode, customRange),
    [periodMode, customRange],
  )

  // ── Data state ────────────────────────────────────────────────────────────
  const [stats, setStats]                       = useState<Stats>({ total_clients: 0, active_clients: 0, pending_tasks: 0, overdue_tasks: 0, period_pending_approval: 0, period_approved: 0 })
  const [recentContents, setRecentContents]     = useState<any[]>([])
  const [weeklyData, setWeeklyData]             = useState<any[]>([])
  const [assetTypes, setAssetTypes]             = useState<{ type: string; count: number }[]>([])
  const [plannerStatuses, setPlannerStatuses]   = useState<{ status: string; count: number }[]>([])
  const [plannerChartData, setPlannerChartData] = useState<PlannerChartEntry[]>([])
  const [plannerCalItems, setPlannerCalItems]   = useState<PlannerDay[]>([])

  // ── Re-fetch whenever user or range changes ───────────────────────────────
  useEffect(() => {
    if (!user) return
    fetchStats(range)
  }, [user, range.start.toISOString(), range.end.toISOString()])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  async function fetchStats({ start, end }: DateRange) {
    const now       = new Date()
    const startIso  = start.toISOString()
    const endIso    = end.toISOString()
    const startDate = format(start, 'yyyy-MM-dd')
    const endDate   = format(end,   'yyyy-MM-dd')

    // Calendário — janela ampla de ±60 dias para suportar navegação
    const calStart = format(subDays(now, 60), 'yyyy-MM-dd')
    const calEnd   = format(addDays(now, 60), 'yyyy-MM-dd')

    const [
      clientsRes,
      tasksRes,
      recentRes,
      contentsRes,
      assetsRes,
      plannerRes,
      plannerAllRes,
      plannerCalRes,
    ] = await Promise.all([
      // Clientes — sempre global
      supabase.from('clients').select('id, status').eq('user_id', user!.id),

      // Tarefas — todas não concluídas (filtro de período no cliente)
      supabase.from('tasks').select('id, status, due_date').eq('user_id', user!.id).neq('status', 'concluido'),

      // Conteúdos recentes — filtrados pelo período
      supabase.from('contents')
        .select('id, term, content_type, status, created_at, client:clients(company_name)')
        .eq('user_id', user!.id)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(5),

      // Todos os conteúdos do período (para gráfico de barras)
      supabase.from('contents')
        .select('created_at')
        .eq('user_id', user!.id)
        .gte('created_at', startIso)
        .lte('created_at', endIso),

      // Arsenal — sempre global
      supabase.from('content_assets').select('content_type').eq('user_id', user!.id),

      // Planner PERÍODO — apenas para os KPI cards (ag. aprovação, aprovados no período)
      supabase.from('planner')
        .select('status, approval_status')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate),

      // Planner GLOBAL — sem filtro de data, para o gráfico de status geral
      // Usa RLS (mesma abordagem do hook usePlanner)
      supabase.from('planner')
        .select('status, approval_status'),

      // Calendário — janela ampla (independe do período selecionado)
      supabase.from('planner')
        .select('id, title, content_type, status, scheduled_date')
        .gte('scheduled_date', calStart)
        .lte('scheduled_date', calEnd),
    ])

    const clients  = clientsRes.data  || []
    const taskList = tasksRes.data    || []

    // Tarefas do período: inclui tarefas sem prazo (due_date null = sempre pendente)
    const periodTasks = taskList.filter(t => {
      if (!t.due_date) return true
      const d = new Date(t.due_date)
      return d >= start && d <= end
    })
    // Atrasadas: métrica global (independe do período)
    const overdue = taskList.filter(t => t.due_date && new Date(t.due_date) < now).length

    // ── KPIs de período: usa plannerRes (filtrado por data) ─────────────────────
    const pPeriod = plannerRes.data || []
    const period_pending_approval = pPeriod.filter(isAwaitingApproval).length
    const period_approved         = pPeriod.filter((p: any) => p.approval_status === 'aprovado').length

    setStats({
      total_clients:  clients.length,
      active_clients: clients.filter(c => c.status === 'ativo').length,
      pending_tasks:  periodTasks.length,
      overdue_tasks:  overdue,
      period_pending_approval,
      period_approved,
    })

    setRecentContents(recentRes.data || [])
    setPlannerCalItems((plannerCalRes.data || []) as PlannerDay[])

    // Gráfico de barras de conteúdos
    setWeeklyData(buildBarData(periodMode, { start, end }, contentsRes.data || []))

    // Donut do arsenal
    const typeMap: Record<string, number> = {}
    ;(assetsRes.data || []).forEach((a: any) => { typeMap[a.content_type] = (typeMap[a.content_type] || 0) + 1 })
    setAssetTypes(Object.entries(typeMap).map(([type, count]) => ({ type, count })))

    // ── Gráfico de planejamento: usa plannerAllRes (GLOBAL, sem filtro de data) ─
    // Isso garante que o gráfico mostra todos os itens do planner,
    // independente do período selecionado na Dashboard — mesma abordagem do usePlanner hook
    const pAll = plannerAllRes.data || []

    // Status breakdown (para debug / extensão futura)
    const statusMap: Record<string, number> = {}
    pAll.forEach((p: any) => { statusMap[p.status] = (statusMap[p.status] || 0) + 1 })
    setPlannerStatuses(Object.entries(statusMap).map(([status, count]) => ({ status, count })))

    // Gráfico com TODOS os status do planner
    setPlannerChartData([
      { label: 'Ideia',       value: pAll.filter((p: any) => p.status === 'ideia').length,                color: '#8b5cf6' },
      { label: 'Produção',    value: pAll.filter((p: any) => p.status === 'producao').length,             color: '#3b82f6' },
      { label: 'Revisão',     value: pAll.filter((p: any) => p.status === 'revisao').length,              color: '#f59e0b' },
      { label: 'Aprovado',    value: pAll.filter((p: any) => p.status === 'aprovado').length,             color: '#10b981' },
      { label: 'Publicado',   value: pAll.filter((p: any) => p.status === 'publicado').length,            color: '#059669' },
      { label: 'Reprovado',   value: pAll.filter((p: any) => p.status === 'reprovado').length,            color: '#ef4444' },
    ])
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[#f2f2f2]">

      {/* Header */}
      <Header
        title="Dashboard"
        subtitle="Visão geral da operação"
        dark={false}
        action={
          <Button asChild size="sm" className="bg-gray-900 text-white hover:bg-gray-800 rounded-xl border-0 text-xs font-medium">
            <Link to="/content"><Plus className="w-3.5 h-3.5 mr-1" /> Novo conteúdo</Link>
          </Button>
        }
      />

      {/* Filter Bar — controlled */}
      <FilterBar
        mode={periodMode}
        range={range}
        customRange={customRange}
        onMode={m => setPeriodMode(m)}
        onCustomRange={r => setCustomRange(r)}
      />

      <div className="p-5 md:p-7 space-y-5">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard label="Total de Clientes"  value={stats.total_clients}            subtitle="global"             href="/clients"  icon={Users}          featured />
          <KpiCard label="Clientes Ativos"    value={stats.active_clients}           subtitle="em operação"        href="/clients"  icon={TrendingUp}     iconBg="bg-emerald-50"  iconColor="text-emerald-600" />
          <KpiCard label="Tarefas Pendentes"  value={stats.pending_tasks}            subtitle="no período"         href="/tasks"    icon={CheckSquare}    iconBg="bg-blue-50"     iconColor="text-blue-500" />
          <KpiCard label="Tarefas Atrasadas"  value={stats.overdue_tasks}            subtitle={stats.overdue_tasks > 0 ? 'requer atenção' : 'em dia'} href="/tasks"    icon={AlertTriangle}  warning />
          <KpiCard label="Ag. aprovação"      value={stats.period_pending_approval}  subtitle="no período"         href="/planner"  icon={Clock}          iconBg="bg-orange-50"   iconColor="text-orange-500" />
          <KpiCard label="Aprovados"          value={stats.period_approved}          subtitle="no período"         href="/planner"  icon={CheckCircle2}   iconBg="bg-emerald-50"  iconColor="text-emerald-600" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Charts — 2/3 */}
          <div className="lg:col-span-2">
            <MetricsCarousel
              weeklyData={weeklyData}
              assetTypes={assetTypes}
              plannerStatuses={plannerStatuses}
              plannerChartData={plannerChartData}
              contentsThisWeek={weeklyData.reduce((s, d) => s + d.conteudos, 0)}
              totalAssets={assetTypes.reduce((s, t) => s + t.count, 0)}
              totalPlanner={plannerStatuses.reduce((s, p) => s + p.count, 0)}
            />
          </div>

          {/* Right sidebar — 1/3 */}
          <div className="flex flex-col gap-5">
            <CalendarWidget
              items={plannerCalItems}
            />
            <AlertsWidget
              pendingApproval={stats.period_pending_approval}
              overdueTasks={stats.overdue_tasks}
              pendingTasks={stats.pending_tasks}
              periodApproved={stats.period_approved}
            />
          </div>
        </div>

        {/* Recent contents table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <div>
              <h3 className="text-[14px] font-semibold text-gray-900">Conteúdos Recentes</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Últimos gerados no período selecionado</p>
            </div>
            <Link to="/history" className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-800 transition-colors">
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentContents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-11 h-11 rounded-2xl bg-gray-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-gray-300" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-gray-600">Nenhum conteúdo neste período</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Tente outro intervalo ou gere um conteúdo</p>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-1 rounded-xl">
                <Link to="/content">Gerar conteúdo</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[1fr_160px_120px_140px] gap-4 px-6 py-2.5 bg-gray-50/60 border-b border-gray-50">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Conteúdo</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Cliente</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tipo</span>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status / Data</span>
              </div>
              <div className="divide-y divide-gray-50">
                {recentContents.map(c => (
                  <div key={c.id} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px_140px] gap-1 sm:gap-4 items-center px-6 py-3.5 hover:bg-gray-50/70 transition-colors">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 truncate">{c.term}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 sm:hidden">
                        {(c.client as any)?.company_name || 'Sem cliente'} · {formatRelative(c.created_at)}
                      </p>
                    </div>
                    <p className="hidden sm:block text-[12px] text-gray-500 truncate">
                      {(c.client as any)?.company_name || '—'}
                    </p>
                    <p className="hidden sm:block text-[12px] text-gray-500">
                      {contentTypeLabels[c.content_type]}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge status={c.status} />
                      <span className="hidden sm:block text-[10px] text-gray-400 whitespace-nowrap">
                        {formatRelative(c.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
