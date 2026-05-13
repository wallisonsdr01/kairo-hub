import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Paperclip, Link2,
  FileText, ImageIcon, Video, Music, File, Building2,
  ExternalLink, Instagram, Mail, Globe, Phone, Sparkles,
  CheckCircle2, AlertCircle, XCircle, Clock, MessageSquare,
  LayoutDashboard, CalendarDays, FolderOpen, LifeBuoy,
  ArrowRight, Bell, Calendar, MessageCircle, Download, Eye,
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO, isThisMonth, startOfToday, isBefore,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PortalLayout } from '@/components/layout/PortalLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  usePortalClient, usePortalPlanner, usePortalContents, useSubmitApproval,
  usePortalMaterials, usePortalSupportContacts,
  usePortalContentAssets, usePortalBrandDNA, usePortalPayments,
} from '@/hooks/usePortal'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import { PlannerCommentsThread } from '@/components/PlannerCommentsThread'
import { NotificationsModal } from '@/components/NotificationsModal'
import { PortalResultadosTab } from './PortalResultadosTab'
import { PortalFinanceiroTab } from './PortalFinanceiroTab'
import { PortalNotesTab } from './PortalNotesTab'
import { useNotifications } from '@/hooks/useNotifications'
import type { ApprovalStatus, Client, Content, ClientMaterial, ClientSupportContact, MaterialType, ContactType, ContentAsset, BrandDNA } from '@/types'
import { contentTypeLabels, formatDate, formatRelative } from '@/utils/formatters'
import { calcFinancialStatus, getFinancialAuxText, hasPaidCurrentCycle } from '@/utils/financial'
import type { PlannerItem, PlannerAttachment, PlannerStatus, ContentType } from '@/types'

// ─── Status config ────────────────────────────────────────────────────────────

const statusColors: Record<PlannerStatus, string> = {
  ideia: 'bg-purple-500', producao: 'bg-blue-500', revisao: 'bg-yellow-500',
  aprovado: 'bg-green-500', publicado: 'bg-emerald-500',
}
const statusTextColors: Record<PlannerStatus, string> = {
  ideia: 'text-purple-600', producao: 'text-blue-600', revisao: 'text-yellow-600',
  aprovado: 'text-green-600', publicado: 'text-emerald-600',
}
const statusLabels: Record<PlannerStatus, string> = {
  ideia: 'Ideia', producao: 'Produção', revisao: 'Revisão',
  aprovado: 'Aprovado', publicado: 'Publicado',
}

// ─── Approval config ─────────────────────────────────────────────────────────

const approvalBg: Record<ApprovalStatus, string> = {
  pendente_aprovacao: 'bg-yellow-50 border-yellow-200',
  aprovado: 'bg-green-50 border-green-200',
  ajuste_solicitado: 'bg-orange-50 border-orange-200',
  ajuste_realizado: 'bg-blue-50 border-blue-200',
  reprovado: 'bg-red-50 border-red-200',
}
const approvalText: Record<ApprovalStatus, string> = {
  pendente_aprovacao: 'text-yellow-600',
  aprovado: 'text-green-600',
  ajuste_solicitado: 'text-orange-600',
  ajuste_realizado: 'text-blue-600',
  reprovado: 'text-red-600',
}
const approvalLabels: Record<ApprovalStatus, string> = {
  pendente_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  ajuste_solicitado: 'Ajuste solicitado',
  ajuste_realizado: 'Ajuste realizado — revise e decida',
  reprovado: 'Reprovado',
}
const approvalIcons: Record<ApprovalStatus, React.ReactNode> = {
  pendente_aprovacao: <Clock className="w-3.5 h-3.5" />,
  aprovado: <CheckCircle2 className="w-3.5 h-3.5" />,
  ajuste_solicitado: <AlertCircle className="w-3.5 h-3.5" />,
  ajuste_realizado: <CheckCircle2 className="w-3.5 h-3.5" />,
  reprovado: <XCircle className="w-3.5 h-3.5" />,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function FileTypeIcon({ type, size = 'sm' }: { type: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  if (type.startsWith('image/')) return <ImageIcon className={`${cls} text-blue-400`} />
  if (type.startsWith('video/')) return <Video className={`${cls} text-purple-400`} />
  if (type.startsWith('audio/')) return <Music className={`${cls} text-green-400`} />
  if (type === 'application/pdf') return <FileText className={`${cls} text-red-400`} />
  return <File className={`${cls} text-gray-400`} />
}

// ─── Hover Tooltip ────────────────────────────────────────────────────────────

interface HoverState { items: PlannerItem[]; top: number; left: number }

function DayTooltip({ state }: { state: HoverState }) {
  return (
    <div className="fixed z-50 pointer-events-none" style={{ top: state.top, left: state.left }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ duration: 0.13 }}
        className="bg-[#13131f] border border-white/10 rounded-xl shadow-2xl w-[260px] p-3 text-xs text-white"
      >
        {state.items.map((item, i) => (
          <div key={item.id} className={i > 0 ? 'mt-2.5 pt-2.5 border-t border-white/8' : ''}>
            <div className="flex items-start gap-2 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full mt-[3px] flex-shrink-0 ${statusColors[item.status as PlannerStatus]}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-[11px] leading-snug">{item.title}</p>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  {contentTypeLabels[item.content_type as ContentType]} · {statusLabels[item.status as PlannerStatus]}
                </p>
              </div>
            </div>
            {item.notes && (
              <p className="text-[10px] text-gray-300 line-clamp-2 mb-1.5 leading-relaxed">{item.notes}</p>
            )}
            {(() => {
              const img = item.attachments?.find(a => a.file_type.startsWith('image/'))
              return img ? <img src={img.file_url} alt="" className="w-full h-20 object-cover rounded-lg mb-1.5" /> : null
            })()}
            <div className="flex items-center gap-3 flex-wrap">
              {item.attachments && item.attachments.length > 0 && (
                <div className="flex items-center gap-1">
                  <Paperclip className="w-3 h-3 text-gray-400" />
                  <span className="text-[10px] text-gray-300">
                    {item.attachments.length} {item.attachments.length === 1 ? 'anexo' : 'anexos'}
                  </span>
                </div>
              )}
              {item.links && item.links.length > 0 && (
                <div className="flex items-center gap-1 min-w-0">
                  <Link2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <span className="text-[10px] text-blue-400 truncate">
                    {item.links.length === 1 ? item.links[0].url : `${item.links.length} links`}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Item Detail View ─────────────────────────────────────────────────────────

function ItemDetailView({
  item, open, onClose,
}: { item: PlannerItem; open: boolean; onClose: () => void }) {
  const images = item.attachments?.filter(a => a.file_type.startsWith('image/')) || []
  const otherAttachments = item.attachments?.filter((a: PlannerAttachment) => !a.file_type.startsWith('image/')) || []
  const submitApproval = useSubmitApproval()
  const { toast } = useToast()

  const [localStatus, setLocalStatus] = useState<ApprovalStatus>(
    (item.approval_status || 'pendente_aprovacao') as ApprovalStatus
  )
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<ApprovalStatus | null>(null)

  // Reset local state whenever the item changes (different id OR status updated externally)
  useEffect(() => {
    setLocalStatus((item.approval_status || 'pendente_aprovacao') as ApprovalStatus)
    setSuccessMsg(null)
    setPendingAction(null)
  }, [item.id, item.approval_status])

  const handleApproval = async (status: ApprovalStatus) => {
    setPendingAction(status)
    try {
      await submitApproval.mutateAsync({ plannerId: item.id, approval_status: status, client_feedback: '' })
      setLocalStatus(status)
      setSuccessMsg(approvalLabels[status] + ' com sucesso.')
      toast(approvalLabels[status] + '!', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setPendingAction(null)
    }
  }

  // ajuste_realizado = agência fez o ajuste, cliente precisa revisar novamente
  const isDecided = localStatus !== 'pendente_aprovacao' && localStatus !== 'ajuste_realizado'
  const isBusy = submitApproval.isPending

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[item.status as PlannerStatus]}`} />
            <DialogTitle className="text-base leading-snug break-words min-w-0 select-text">{item.title}</DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-gray-500">
              {format(parseISO(item.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {item.scheduled_time && ` às ${item.scheduled_time}`}
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-500">{contentTypeLabels[item.content_type as ContentType]}</span>
            <span className="text-gray-700">·</span>
            <span className={`text-xs font-medium ${statusTextColors[item.status as PlannerStatus]}`}>
              {statusLabels[item.status as PlannerStatus]}
            </span>
          </div>
        </DialogHeader>

        <div
          className="space-y-4 mt-1 min-w-0 w-full max-w-full overflow-x-hidden"
          style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
        >
          {item.notes && (
            <div className="p-3 bg-[#f7f7f7] rounded-xl border border-[#e8e8e8]">
              <p className="text-[10px] text-[#a0a0a0] uppercase tracking-wide mb-2">Notas</p>
              <p
                className="text-sm text-[#0f0f0f] leading-relaxed whitespace-pre-wrap break-words select-text"
                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
              >{item.notes}</p>
            </div>
          )}

          {images.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Imagens</p>
              <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {images.map(img => (
                  <a key={img.id} href={img.file_url} target="_blank" rel="noopener noreferrer"
                    className="block w-full max-w-full overflow-hidden rounded-xl border border-[#e8e8e8] hover:border-[#c8c8c8] transition-colors">
                    <img src={img.file_url} alt={img.file_name} className="w-full max-w-full object-contain max-h-[60vh]" />
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#f5f5f5]">
                      <ImageIcon className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] text-[#737373] truncate flex-1">{img.file_name}</span>
                      <ExternalLink className="w-3 h-3 text-[#a0a0a0]" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {otherAttachments.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Anexos</p>
              <div className="space-y-1.5">
                {otherAttachments.map((att: PlannerAttachment) => (
                  <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 bg-[#f7f7f7] border border-[#e8e8e8] rounded-xl hover:border-[#d0d0d0] hover:bg-[#f0f0f0] transition-colors min-w-0 max-w-full overflow-hidden">
                    <FileTypeIcon type={att.file_type} size="md" />
                    <span className="text-xs text-[#0f0f0f] truncate flex-1">{att.file_name}</span>
                    {att.file_size && <span className="text-[10px] text-[#a0a0a0] flex-shrink-0">{formatFileSize(att.file_size)}</span>}
                    <ExternalLink className="w-3 h-3 text-[#a0a0a0] flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {item.links && item.links.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Links</p>
              <div className="space-y-1.5">
                {item.links.map(link => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 bg-[#f7f7f7] border border-[#e8e8e8] rounded-xl hover:border-[#d0d0d0] hover:bg-[#f0f0f0] transition-colors min-w-0 overflow-hidden">
                    <Link2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="text-xs text-blue-600 flex-1 min-w-0 break-all">{link.label || link.url}</span>
                    <ExternalLink className="w-3 h-3 text-[#a0a0a0] flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Seção de Aprovação ── */}
          <div className={`rounded-xl border p-4 ${approvalBg[localStatus]}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={approvalText[localStatus]}>{approvalIcons[localStatus]}</span>
              <p className={`text-xs font-semibold ${approvalText[localStatus]}`}>
                {approvalLabels[localStatus]}
              </p>
              {item.reviewed_at && !successMsg && (
                <span className="text-[10px] text-gray-600 ml-auto">
                  {format(parseISO(item.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>

            {/* Feedback de sucesso imediato */}
            {successMsg && (
              <div className="mb-3 flex items-center gap-2 p-2.5 bg-white/70 border border-black/[0.06] rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                <p className="text-xs text-[#0f0f0f] font-medium">{successMsg}</p>
              </div>
            )}

            {item.client_feedback && localStatus !== 'pendente_aprovacao' && !successMsg && (
              <div className="mb-3 p-2.5 bg-white/70 border border-black/[0.06] rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3 h-3 text-[#a0a0a0]" />
                  <span className="text-[10px] text-[#a0a0a0] uppercase tracking-wide">Seu comentário</span>
                </div>
                <p
                  className="text-xs text-[#737373] leading-relaxed break-words select-text"
                  style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
                >{item.client_feedback}</p>
              </div>
            )}

            {/* Botões: ocultos após decisão confirmada */}
            {!isDecided && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleApproval('aprovado')}
                  disabled={isBusy}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                    bg-green-50 text-green-700 hover:bg-green-100 border border-green-200
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {pendingAction === 'aprovado'
                    ? <span className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Aprovar
                </button>
                <button
                  onClick={() => handleApproval('ajuste_solicitado')}
                  disabled={isBusy}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                    bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {pendingAction === 'ajuste_solicitado'
                    ? <span className="w-3.5 h-3.5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                    : <AlertCircle className="w-3.5 h-3.5" />}
                  Solicitar ajuste
                </button>
                <button
                  onClick={() => handleApproval('reprovado')}
                  disabled={isBusy}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                    bg-red-50 text-red-700 hover:bg-red-100 border border-red-200
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {pendingAction === 'reprovado'
                    ? <span className="w-3.5 h-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    : <XCircle className="w-3.5 h-3.5" />}
                  Reprovar
                </button>
              </div>
            )}
          </div>

          {/* Comment thread */}
          <PlannerCommentsThread plannerId={item.id} role="client" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Portal Planner (read-only) ───────────────────────────────────────────────

function PortalPlannerView({
  items,
  autoOpenItemId,
  onItemAutoOpened,
}: {
  items: PlannerItem[]
  autoOpenItemId?: string | null
  onItemAutoOpened?: () => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [hover, setHover] = useState<HoverState | null>(null)
  const [dayDate, setDayDate] = useState<Date | null>(null)
  const [dayOpen, setDayOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [itemOpen, setItemOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)

  // Derivados ao vivo — nunca ficam stale após invalidação da query
  const selectedItem = selectedItemId ? (items.find(i => i.id === selectedItemId) ?? null) : null
  const dayItems = dayDate ? items.filter(i => isSameDay(parseISO(i.scheduled_date), dayDate)) : []

  // Auto-abrir item ao receber autoOpenItemId (vindo de notificação)
  useEffect(() => {
    if (!autoOpenItemId || !items.length) return
    const found = items.find(i => i.id === autoOpenItemId)
    if (found) {
      setSelectedItemId(found.id)
      setItemOpen(true)
      onItemAutoOpened?.()
    }
  }, [autoOpenItemId, items])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { locale: ptBR })
  const calEnd = endOfWeek(monthEnd, { locale: ptBR })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const getDay = (day: Date) => items.filter(i => isSameDay(parseISO(i.scheduled_date), day))

  const handleDayClick = (day: Date, di: PlannerItem[]) => {
    if (di.length === 0) return
    setDayDate(day)
    setDayOpen(true)
    setHover(null)
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, di: PlannerItem[]) => {
    if (di.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const tooltipWidth = 268
    const left = rect.right + 8 + tooltipWidth > window.innerWidth ? rect.left - tooltipWidth - 4 : rect.right + 8
    const top = Math.min(rect.top, window.innerHeight - Math.min(di.length * 130, 380) - 16)
    setHover({ items: di, top, left })
  }

  return (
    <div>
      {/* Nav */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white capitalize">
          {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="w-full max-w-full min-w-0">
          <div className="grid grid-cols-7 mb-1 sm:mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-center text-[9px] sm:text-xs font-medium text-gray-500 py-1 sm:py-2 truncate">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {days.map(day => {
              const di = getDay(day)
              const inMonth = isSameMonth(day, currentMonth)
              const today = isToday(day)
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => inMonth && handleDayClick(day, di)}
                  onMouseEnter={!isMobile ? e => inMonth && handleMouseEnter(e, di) : undefined}
                  onMouseLeave={!isMobile ? () => setHover(null) : undefined}
                  className={`
                    min-h-[52px] sm:min-h-[90px] p-0.5 sm:p-1.5 rounded sm:rounded-lg border transition-all
                    ${inMonth ? 'border-[#e8e8e8]' : 'border-transparent opacity-30 cursor-default'}
                    ${inMonth && di.length > 0 ? 'hover:border-[#d0d0d0] hover:bg-[#f5f5f5] cursor-pointer' : ''}
                    ${today ? 'border-blue-500/40 bg-blue-500/5' : ''}
                  `}
                >
                  <div className={`text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full
                    ${today ? 'bg-blue-600 text-white' : inMonth ? 'text-[#737373]' : 'text-gray-400'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {di.slice(0, 2).map(item => (
                      <div key={item.id} className="flex items-center gap-0.5 min-w-0">
                        <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0 ${statusColors[item.status as PlannerStatus]}`} />
                        <span className="text-[#737373] truncate text-[9px] sm:text-[10px] flex-1 min-w-0 hidden xs:block sm:block">{item.title}</span>
                      </div>
                    ))}
                    {di.length > 2 && <p className="text-[8px] sm:text-[10px] text-gray-600">+{di.length - 2}</p>}
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-3 mt-4 flex-wrap">
        {(Object.entries(statusColors) as [PlannerStatus, string][]).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-[#737373]">
            <div className={`w-2 h-2 rounded-full ${c}`} />
            {statusLabels[s]}
          </div>
        ))}
      </div>

      {/* Tooltip — desktop only */}
      <AnimatePresence>
        {!isMobile && hover && <DayTooltip state={hover} />}
      </AnimatePresence>

      {/* Day modal */}
      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              {dayDate && format(dayDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {dayItems.length} {dayItems.length === 1 ? 'post planejado' : 'posts planejados'} · clique para ver detalhes
            </p>
          </DialogHeader>
          <div className="space-y-3 my-1 min-w-0 w-full max-w-full overflow-x-hidden">
            {dayItems.map(item => {
              const thumb = item.attachments?.find(a => a.file_type.startsWith('image/'))
              return (
                <div
                  key={item.id}
                  onClick={() => { setDayOpen(false); setSelectedItemId(item.id); setItemOpen(true) }}
                  className="flex items-start gap-3 p-3 bg-white border border-[#e8e8e8] rounded-xl cursor-pointer hover:bg-[#f5f5f5] hover:border-[#d0d0d0] transition-colors group"
                >
                  {thumb && (
                    <img src={thumb.file_url} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-[#e8e8e8]" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColors[item.status as PlannerStatus]}`} />
                      <p className="font-medium text-[#0f0f0f] text-sm break-words">{item.title}</p>
                    </div>
                    <p className="text-xs text-[#737373] ml-3.5">
                      {contentTypeLabels[item.content_type as ContentType]} · {statusLabels[item.status as PlannerStatus]}
                    </p>
                    {item.approval_status && item.approval_status !== 'pendente_aprovacao' && (
                      <span className={`ml-3.5 inline-flex items-center gap-1 text-[10px] font-medium ${approvalText[item.approval_status as ApprovalStatus]}`}>
                        {approvalIcons[item.approval_status as ApprovalStatus]}
                        {approvalLabels[item.approval_status as ApprovalStatus]}
                      </span>
                    )}
                    {item.notes && (
                      <p className="text-xs text-[#737373] line-clamp-1 ml-3.5 mt-0.5">{item.notes}</p>
                    )}
                    <div className="flex items-center gap-3 ml-3.5 mt-1.5">
                      {item.attachments && item.attachments.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-[#a0a0a0]" />
                          <span className="text-[11px] text-[#737373]">{item.attachments.length} {item.attachments.length === 1 ? 'anexo' : 'anexos'}</span>
                        </div>
                      )}
                      {item.links && item.links.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-blue-500" />
                          <span className="text-[11px] text-blue-600">{item.links.length} {item.links.length === 1 ? 'link' : 'links'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#737373] transition-colors flex-shrink-0 mt-0.5" />
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedItem && (
        <ItemDetailView
          item={selectedItem}
          open={itemOpen}
          onClose={() => { setItemOpen(false); setSelectedItemId(null) }}
        />
      )}
    </div>
  )
}

// ─── Dashboard helpers ────────────────────────────────────────────────────────

function humanizeActivity(status: ApprovalStatus, _item: PlannerItem): string {
  switch (status) {
    case 'aprovado':          return 'Você aprovou um conteúdo'
    case 'reprovado':         return 'Você reprovou um conteúdo'
    case 'ajuste_solicitado': return 'Você solicitou ajuste em um conteúdo'
    case 'ajuste_realizado':  return 'A agência realizou o ajuste solicitado'
    default:                  return 'Conteúdo enviado para revisão'
  }
}

type CardColor = 'amber' | 'green' | 'blue' | 'purple' | 'default'

const cardColorMap: Record<CardColor, { icon: string; label: string; value: string; ring: string; dot: string }> = {
  amber:   { icon: 'text-amber-600',  label: 'text-amber-700',  value: 'text-amber-800',  ring: 'border-amber-200  bg-amber-50',   dot: 'bg-amber-400' },
  green:   { icon: 'text-green-600',  label: 'text-green-700',  value: 'text-green-800',  ring: 'border-green-200  bg-green-50',   dot: 'bg-green-500' },
  blue:    { icon: 'text-blue-600',   label: 'text-blue-700',   value: 'text-blue-800',   ring: 'border-blue-200   bg-blue-50',    dot: 'bg-blue-500' },
  purple:  { icon: 'text-purple-600', label: 'text-purple-700', value: 'text-purple-800', ring: 'border-purple-200 bg-purple-50',  dot: 'bg-purple-500' },
  default: { icon: 'text-gray-500',   label: 'text-[#737373]',  value: 'text-[#0f0f0f]',  ring: 'border-[#e8e8e8]  bg-white',     dot: 'bg-gray-400' },
}

function StatusCard({
  icon, label, value, color, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: CardColor
  onClick?: () => void
}) {
  const c = cardColorMap[color]
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 flex flex-col gap-3 transition-all ${c.ring} ${onClick ? 'cursor-pointer hover:brightness-110' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={c.icon}>{icon}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      </div>
      <div>
        <p className={`text-[11px] leading-snug ${c.label}`}>{label}</p>
        <p className={`text-[13px] font-semibold mt-1 leading-tight ${c.value}`}>{value}</p>
      </div>
    </div>
  )
}

function AgencyWorkItem({
  icon, label, detail,
}: {
  icon: React.ReactNode
  label: string
  detail: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-[#f0f0f0] border border-[#e8e8e8] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#0f0f0f] truncate">{label}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{detail}</p>
      </div>
      <div className="w-1.5 h-1.5 rounded-full bg-green-400/60 flex-shrink-0" />
    </div>
  )
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function ClientDashboardTab({
  client,
  plannerItems,
  contents,
  onNavigate,
  firstName,
  payments,
}: {
  client: Client
  plannerItems: PlannerItem[]
  contents: Content[]
  onNavigate: (tab: string) => void
  firstName: string
  payments: Array<{ status: string; payment_date: string }>
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [itemOpen, setItemOpen] = useState(false)

  // Derivado ao vivo — reflete sempre o dado mais fresco da query
  const selectedItem = selectedItemId ? (plannerItems.find(i => i.id === selectedItemId) ?? null) : null

  const today = startOfToday()

  const pendingItems = plannerItems.filter(
    i => i.approval_status === 'pendente_aprovacao' || (i.status === 'revisao' && !i.approval_status)
  )
  const approvedThisMonth = plannerItems.filter(
    i => i.approval_status === 'aprovado' && isThisMonth(parseISO(i.scheduled_date))
  )
  const thisMonthItems = plannerItems.filter(i => isThisMonth(parseISO(i.scheduled_date)))
  const publishedItems = plannerItems.filter(i => i.status === 'publicado')
  const inProductionCount = plannerItems.filter(i => i.status === 'producao' || i.status === 'revisao').length
  const inIdeaCount = plannerItems.filter(i => i.status === 'ideia').length

  const upcomingItems = plannerItems
    .filter(i => !isBefore(parseISO(i.scheduled_date), today))
    .sort((a, b) => parseISO(a.scheduled_date).getTime() - parseISO(b.scheduled_date).getTime())
    .slice(0, 5)
  const recentActivity = plannerItems
    .filter(i => i.reviewed_at)
    .sort((a, b) => parseISO(b.reviewed_at!).getTime() - parseISO(a.reviewed_at!).getTime())
    .slice(0, 5)

  // Financial alert — only show for 'vence_em_breve'
  const financialStatus = calcFinancialStatus(client)
  const financialAux = getFinancialAuxText(client, financialStatus)
  const showFinancialAlert = financialStatus === 'vence_em_breve'
    && client.dia_vencimento != null
    && !hasPaidCurrentCycle(payments, client.dia_vencimento)

  // Dynamic hero copy
  const headline = pendingItems.length > 0
    ? pendingItems.length === 1
      ? 'Você tem 1 conteúdo aguardando sua aprovação'
      : `Você tem ${pendingItems.length} conteúdos aguardando sua aprovação`
    : plannerItems.length === 0
      ? 'Estamos preparando seus primeiros conteúdos'
      : 'Seu planejamento está ativo e atualizado'

  const subline = pendingItems.length > 0
    ? 'Revise e aprove para manter o calendário em dia.'
    : plannerItems.length === 0
      ? 'Em breve você verá todos os conteúdos aqui.'
      : `${thisMonthItems.length} ${thisMonthItems.length === 1 ? 'conteúdo programado' : 'conteúdos programados'} para este mês.`

  return (
    <div className="space-y-6">

      {/* ── Alertas de atenção ── */}
      {showFinancialAlert && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50"
        >
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-amber-700">Vence em breve</p>
            <p className="text-[12px] text-amber-800 mt-0.5 leading-snug">
              {financialAux === 'Vence hoje'
                ? 'Seu pagamento vence hoje.'
                : `${financialAux}. Fique atento ao pagamento.`}
            </p>
          </div>
          <button
            onClick={() => onNavigate('financeiro')}
            className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-600 transition-colors whitespace-nowrap"
          >
            Ver <ArrowRight className="w-3 h-3" />
          </button>
        </motion.div>
      )}

      {/* ── Hero header ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className={`rounded-2xl p-6 border ${
          pendingItems.length > 0
            ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/40 to-transparent'
            : 'border-[#e8e8e8] bg-gradient-to-br from-[#f7f7f7] via-white to-transparent'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-600 uppercase tracking-[0.12em] mb-2">
              Olá, {firstName}
            </p>
            <h2 className="text-[18px] sm:text-[20px] font-semibold text-[#0f0f0f] leading-snug">
              {headline}
            </h2>
            <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">{subline}</p>
          </div>
          {pendingItems.length > 0 && (
            <button
              onClick={() => { setSelectedItemId(pendingItems[0].id); setItemOpen(true) }}
              className="hidden sm:flex items-center gap-2 flex-shrink-0 px-4 py-2.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 text-[12px] font-semibold hover:bg-amber-200 transition-all"
            >
              Revisar agora <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {pendingItems.length > 0 && (
          <button
            onClick={() => { setSelectedItemId(pendingItems[0].id); setItemOpen(true) }}
            className="sm:hidden mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 text-[12px] font-semibold hover:bg-amber-200 transition-all"
          >
            Revisar agora <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>

      {/* ── Status cards ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.06 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <StatusCard
          icon={<Clock className="w-4 h-4" />}
          label={pendingItems.length > 0 ? 'Aguardando sua aprovação' : 'Nada pendente'}
          value={pendingItems.length > 0
            ? `${pendingItems.length} ${pendingItems.length === 1 ? 'conteúdo' : 'conteúdos'}`
            : 'Tudo revisado'}
          color={pendingItems.length > 0 ? 'amber' : 'green'}
          onClick={pendingItems.length > 0 ? () => onNavigate('planejamento') : undefined}
        />
        <StatusCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Aprovados este mês"
          value={approvedThisMonth.length > 0
            ? `${approvedThisMonth.length} ${approvedThisMonth.length === 1 ? 'aprovado' : 'aprovados'}`
            : 'Aguardando revisões'}
          color={approvedThisMonth.length > 0 ? 'green' : 'default'}
        />
        <StatusCard
          icon={<CalendarDays className="w-4 h-4" />}
          label="Planejamento ativo"
          value={thisMonthItems.length > 0
            ? `${thisMonthItems.length} ${thisMonthItems.length === 1 ? 'conteúdo' : 'conteúdos'} no mês`
            : 'Sem conteúdos no mês'}
          color={thisMonthItems.length > 0 ? 'blue' : 'default'}
          onClick={() => onNavigate('planejamento')}
        />
        <StatusCard
          icon={<Sparkles className="w-4 h-4" />}
          label={publishedItems.length > 0 ? 'Publicados' : 'Nenhum publicado'}
          value={publishedItems.length > 0
            ? `${publishedItems.length} ${publishedItems.length === 1 ? 'publicado' : 'publicados'}`
            : 'Em breve online'}
          color={publishedItems.length > 0 ? 'purple' : 'default'}
        />
      </motion.div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* Pendentes de aprovação */}
          {pendingItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.12] overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-amber-500/20">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <p className="text-[13px] font-semibold text-amber-100">
                  {pendingItems.length === 1
                    ? '1 conteúdo precisa da sua aprovação'
                    : `${pendingItems.length} conteúdos precisam da sua aprovação`}
                </p>
              </div>
              <div className="divide-y divide-white/10">
                {pendingItems.map(item => {
                  const thumb = item.attachments?.find(a => a.file_type.startsWith('image/'))
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setSelectedItemId(item.id); setItemOpen(true) }}
                      className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-amber-500/20 transition-colors text-left group"
                    >
                      {thumb ? (
                        <img src={thumb.file_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full ${statusColors[item.status as PlannerStatus]}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-white truncate">{item.title}</p>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          {format(parseISO(item.scheduled_date), "dd 'de' MMMM", { locale: ptBR })}
                          <span className="mx-1.5 text-white/30">·</span>
                          {contentTypeLabels[item.content_type as ContentType]}
                        </p>
                      </div>
                      <span className="text-[11px] text-amber-400 font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0 group-hover:bg-amber-500/18 transition-colors">
                        Revisar
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Em andamento */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.14 }}
            className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e8e8e8]">
              <div className="flex gap-0.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:300ms]" />
              </div>
              <p className="text-[13px] font-semibold text-[#0f0f0f]">Em andamento</p>
            </div>
            <div className="p-5 space-y-3.5">
              {plannerItems.length === 0 ? (
                <p className="text-[12px] text-gray-600 py-1">
                  A agência está preparando a estratégia inicial para você.
                </p>
              ) : (
                <>
                  {inIdeaCount > 0 && (
                    <AgencyWorkItem
                      icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                      label="Ideias em desenvolvimento"
                      detail={`${inIdeaCount} ${inIdeaCount === 1 ? 'conteúdo' : 'conteúdos'} na fase criativa`}
                    />
                  )}
                  {inProductionCount > 0 && (
                    <AgencyWorkItem
                      icon={<CalendarDays className="w-3.5 h-3.5 text-blue-400" />}
                      label="Conteúdos em produção"
                      detail={`${inProductionCount} ${inProductionCount === 1 ? 'item sendo criado' : 'itens sendo criados'}`}
                    />
                  )}
                  <AgencyWorkItem
                    icon={<LayoutDashboard className="w-3.5 h-3.5 text-green-400" />}
                    label="Planejamento do mês ativo"
                    detail={`${thisMonthItems.length} ${thisMonthItems.length === 1 ? 'conteúdo programado' : 'conteúdos programados'}`}
                  />
                  {contents.length > 0 && (
                    <AgencyWorkItem
                      icon={<MessageSquare className="w-3.5 h-3.5 text-indigo-400" />}
                      label="Estratégia de conteúdo"
                      detail={`${contents.length} ${contents.length === 1 ? 'conteúdo gerado' : 'conteúdos gerados'}`}
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Atividade recente */}
          {recentActivity.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.18 }}
              className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[#e8e8e8]">
                <Bell className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-[13px] font-semibold text-[#0f0f0f]">Atividade recente</p>
              </div>
              <div className="px-5 py-4 space-y-4">
                {recentActivity.map(item => {
                  const status = (item.approval_status || 'pendente_aprovacao') as ApprovalStatus
                  return (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                        ${status === 'aprovado' ? 'bg-green-50' : status === 'reprovado' ? 'bg-red-50' : 'bg-orange-50'}`}
                      >
                        <span className={`${approvalText[status]} [&>svg]:w-3 [&>svg]:h-3`}>
                          {approvalIcons[status]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[#737373] leading-relaxed">
                          {humanizeActivity(status, item)}
                        </p>
                        <p className="text-[11px] text-gray-600 truncate mt-0.5">{item.title}</p>
                        {item.reviewed_at && (
                          <p className="text-[10px] text-gray-700 mt-0.5">{formatRelative(item.reviewed_at)}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">

          {/* Próximos conteúdos */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.11 }}
            className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e8e8e8]">
              <p className="text-[12px] font-semibold text-[#0f0f0f]">Próximos conteúdos</p>
              <button
                onClick={() => onNavigate('planejamento')}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-500 transition-colors"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {upcomingItems.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <CalendarDays className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                <p className="text-[12px] text-gray-600">Nenhum conteúdo agendado.</p>
                <p className="text-[11px] text-gray-700 mt-0.5">A agência está preparando o calendário.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#e8e8e8]">
                {upcomingItems.map(item => {
                  const thumb = item.attachments?.find(a => a.file_type.startsWith('image/'))
                  const isPending = item.approval_status === 'pendente_aprovacao'
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setSelectedItemId(item.id); setItemOpen(true) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f5f5] transition-colors text-left group"
                    >
                      <div className="w-9 flex-shrink-0 text-center">
                        <p className="text-[9px] text-gray-600 uppercase leading-tight">
                          {format(parseISO(item.scheduled_date), 'MMM', { locale: ptBR })}
                        </p>
                        <p className="text-[16px] font-bold text-[#0f0f0f] tabular-nums leading-tight">
                          {format(parseISO(item.scheduled_date), 'd')}
                        </p>
                      </div>
                      {thumb ? (
                        <img src={thumb.file_url} alt="" className="w-8 h-8 rounded-md object-cover border border-[#e8e8e8] flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-[#f0f0f0] border border-[#e8e8e8] flex items-center justify-center flex-shrink-0">
                          <div className={`w-1.5 h-1.5 rounded-full ${statusColors[item.status as PlannerStatus]}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#0f0f0f] truncate">{item.title}</p>
                        <p className={`text-[10px] mt-0.5 ${statusTextColors[item.status as PlannerStatus]}`}>
                          {contentTypeLabels[item.content_type as ContentType]}
                        </p>
                      </div>
                      {isPending && (
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
                      )}
                      <ChevronRight className="w-3 h-3 text-[#a0a0a0] group-hover:text-[#737373] transition-colors flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Próxima reunião */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.16 }}
            className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[#e8e8e8]">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <p className="text-[12px] font-semibold text-[#0f0f0f]">Próxima reunião</p>
            </div>
            <div className="p-5 flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-[#e8e8e8] bg-[#f0f0f0] flex items-center justify-center">
                <Calendar className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#737373]">Quer alinhar estratégias?</p>
                <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                  Agende uma conversa com a agência.
                </p>
              </div>
              <button
                onClick={() => onNavigate('suporte')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#e8e8e8] bg-[#f7f7f7] text-[11px] text-[#737373] font-medium hover:bg-[#f0f0f0] hover:border-[#d0d0d0] transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Solicitar reunião
              </button>
            </div>
          </motion.div>

          {/* Resumo empresa */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.2 }}
            className="rounded-2xl border border-[#e8e8e8] bg-white p-4"
          >
            <div className="flex items-center gap-3 mb-3.5">
              {client.logo_url ? (
                <img src={client.logo_url} alt={client.company_name}
                  className="w-8 h-8 rounded-lg object-cover border border-[#e8e8e8] flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#f0f0f0] border border-[#e8e8e8] flex items-center justify-center text-xs font-bold text-[#0f0f0f] flex-shrink-0">
                  {client.company_name[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#0f0f0f] truncate">{client.company_name}</p>
                <p className="text-[10px] text-gray-500 truncate">{client.niche}</p>
              </div>
            </div>
            {client.main_objective && (
              <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3 mb-3">
                {client.main_objective}
              </p>
            )}
            <button
              onClick={() => onNavigate('empresa')}
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              Ver perfil completo <ArrowRight className="w-3 h-3" />
            </button>
          </motion.div>
        </div>
      </div>

      {selectedItem && (
        <ItemDetailView
          item={selectedItem}
          open={itemOpen}
          onClose={() => { setItemOpen(false); setSelectedItemId(null) }}
        />
      )}
    </div>
  )
}

// ─── Portal Materiais ─────────────────────────────────────────────────────────

const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  pdf: 'PDF', imagem: 'Imagem', video: 'Vídeo',
  link: 'Link', documento: 'Documento', outro: 'Outro',
}

function matIsImage(mat: ClientMaterial): boolean {
  if (mat.type === 'imagem') return true
  if (!mat.file_url) return false
  return /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(mat.file_url)
}
function matIsPdf(mat: ClientMaterial): boolean {
  if (mat.type === 'pdf') return true
  if (!mat.file_url) return false
  return /\.pdf(\?|$)/i.test(mat.file_url)
}
function matIsVideo(mat: ClientMaterial): boolean {
  if (mat.type === 'video') return true
  if (!mat.file_url) return false
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mat.file_url)
}

function PortalMaterialIcon({ type, size = 'sm' }: { type: MaterialType; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-8 h-8' : 'w-4 h-4'
  switch (type) {
    case 'pdf':    return <FileText  className={`${cls} text-red-400`} />
    case 'imagem': return <ImageIcon className={`${cls} text-blue-400`} />
    case 'video':  return <Video     className={`${cls} text-purple-400`} />
    case 'link':   return <Link2     className={`${cls} text-sky-400`} />
    default:       return <File      className={`${cls} text-gray-500`} />
  }
}

// ── Hover card ──────────────────────────────────────────────────────────────

interface MatHoverState { mat: ClientMaterial; top: number; left: number }

function MaterialHoverCard({ state }: { state: MatHoverState }) {
  const { mat } = state
  const isImg = matIsImage(mat)
  return (
    <div className="fixed z-50 pointer-events-none" style={{ top: state.top, left: state.left }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ duration: 0.13 }}
        className="bg-[#13131f] border border-white/10 rounded-xl shadow-2xl w-[220px] overflow-hidden text-white"
      >
        {isImg && mat.file_url ? (
          <img
            src={mat.file_url}
            alt={mat.title}
            className="w-full h-32 object-cover"
          />
        ) : (
          <div className="w-full h-24 bg-white/[0.04] flex items-center justify-center">
            <PortalMaterialIcon type={mat.type} size="lg" />
          </div>
        )}
        <div className="p-3">
          <p className="text-[12px] font-medium text-white leading-snug">{mat.title}</p>
          {mat.description && (
            <p className="text-[10px] text-gray-300 mt-0.5 line-clamp-2 leading-relaxed">{mat.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[10px] text-gray-400">{MATERIAL_TYPE_LABELS[mat.type]}</span>
            <span className="text-gray-500 text-[10px]">·</span>
            <span className="text-[10px] text-gray-400">{formatDate(mat.created_at)}</span>
          </div>
          <p className="text-[10px] text-blue-400 mt-1.5 flex items-center gap-1">
            <Eye className="w-2.5 h-2.5" /> Clique para visualizar
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ── Detail modal ────────────────────────────────────────────────────────────

function MaterialDetailModal({
  mat, open, onClose,
}: { mat: ClientMaterial; open: boolean; onClose: () => void }) {
  const isImg  = matIsImage(mat)
  const isPdf  = matIsPdf(mat)
  const isVid  = matIsVideo(mat)
  const isLink = !!(mat.link_url)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2.5 min-w-0">
            <PortalMaterialIcon type={mat.type} />
            <DialogTitle className="text-base leading-snug break-words min-w-0">{mat.title}</DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-500">{MATERIAL_TYPE_LABELS[mat.type]}</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-500">{formatDate(mat.created_at)}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-1 min-w-0 w-full max-w-full overflow-x-hidden">
          {mat.description && (
            <div className="p-3 bg-white/3 rounded-xl border border-white/8">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Descrição</p>
              <p className="text-sm text-gray-300 leading-relaxed break-words">{mat.description}</p>
            </div>
          )}

          {/* Preview: imagem */}
          {isImg && mat.file_url && (
            <div className="w-full max-w-full overflow-hidden rounded-xl border border-white/8">
              <img
                src={mat.file_url}
                alt={mat.title}
                className="w-full max-w-full max-h-[60vh] object-contain"
              />
            </div>
          )}

          {/* Preview: vídeo */}
          {isVid && mat.file_url && (
            <video
              src={mat.file_url}
              controls
              className="w-full max-w-full rounded-xl border border-white/8"
            />
          )}

          {/* Preview: PDF (iframe) */}
          {isPdf && mat.file_url && (
            <div className="rounded-xl overflow-hidden border border-white/8">
              <iframe
                src={mat.file_url}
                title={mat.title}
                className="w-full h-72"
              />
            </div>
          )}

          {/* Link externo */}
          {isLink && mat.link_url && (
            <a
              href={mat.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-3 bg-white/3 border border-white/8 rounded-xl hover:bg-white/5 hover:border-white/15 transition-colors"
            >
              <Link2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span className="text-sm text-sky-300 flex-1 min-w-0 break-all">{mat.link_url}</span>
              <ExternalLink className="w-3 h-3 text-gray-600 flex-shrink-0" />
            </a>
          )}

          {/* Fallback: nenhum preview disponível */}
          {!isImg && !isVid && !isPdf && !isLink && (
            <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-white/8 bg-white/3">
              <PortalMaterialIcon type={mat.type} size="lg" />
              <p className="text-xs text-gray-500 mt-2">Sem visualização disponível</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          {isLink && mat.link_url && (
            <a href={mat.link_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <ExternalLink className="w-3.5 h-3.5" /> Acessar link
              </Button>
            </a>
          )}
          {mat.file_url && (
            <a href={mat.file_url} download target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <Download className="w-3.5 h-3.5" /> Baixar material
              </Button>
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Material row (shared between flat + grouped views) ──────────────────────

type MatHoverSetter = (s: MatHoverState | null) => void

function MatRow({
  mat,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  mat: ClientMaterial
  onClick: (m: ClientMaterial) => void
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>, m: ClientMaterial) => void
  onMouseLeave: MatHoverSetter
}) {
  const isImg  = matIsImage(mat)
  const isLink = mat.type === 'link' && !!mat.link_url

  // Links get a special card — no hover card, click opens URL directly
  if (isLink) {
    return (
      <div className="flex items-start gap-3 p-4 bg-white border border-[#e8e8e8] rounded-xl hover:border-sky-200 hover:shadow-sm transition-all group">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Link2 className="w-4.5 h-4.5 text-sky-500" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#0f0f0f] text-sm truncate">{mat.title}</p>
          {mat.description && (
            <p className="text-[12px] text-[#737373] mt-0.5 leading-snug line-clamp-2">{mat.description}</p>
          )}
          <p className="text-[10px] text-[#a0a0a0] mt-1 truncate">{mat.link_url}</p>
        </div>

        {/* CTA */}
        <a
          href={mat.link_url!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-sky-500 text-white text-[12px] font-medium hover:bg-sky-600 transition-colors whitespace-nowrap"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Abrir
        </a>
      </div>
    )
  }

  return (
    <div
      onClick={() => onClick(mat)}
      onMouseEnter={e => onMouseEnter(e, mat)}
      onMouseLeave={() => onMouseLeave(null)}
      className="flex items-center gap-3 p-3.5 bg-white border border-[#e8e8e8] rounded-xl hover:bg-[#f5f5f5] hover:border-[#d0d0d0] transition-colors group cursor-pointer"
    >
      {/* Thumbnail */}
      {isImg && mat.file_url ? (
        <img
          src={mat.file_url}
          alt={mat.title}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-[#e8e8e8]"
        />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-[#f0f0f0] border border-[#e8e8e8] flex items-center justify-center flex-shrink-0">
          <PortalMaterialIcon type={mat.type} />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[#0f0f0f] text-sm truncate">{mat.title}</p>
        {mat.description && (
          <p className="text-xs text-[#737373] truncate mt-0.5">{mat.description}</p>
        )}
        <p className="text-[10px] text-[#a0a0a0] mt-0.5">
          {MATERIAL_TYPE_LABELS[mat.type]}
          {' · '}{formatDate(mat.created_at)}
        </p>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[11px] text-[#737373]">Visualizar</span>
        <ChevronRight className="w-3.5 h-3.5 text-[#a0a0a0]" />
      </div>
    </div>
  )
}

// ── Tab principal ───────────────────────────────────────────────────────────

type MatTypeFilter = 'todos' | MaterialType

const MAT_TAB_LABELS: { value: MatTypeFilter; label: string }[] = [
  { value: 'todos',     label: 'Todos'     },
  { value: 'imagem',    label: 'Imagens'   },
  { value: 'video',     label: 'Vídeos'    },
  { value: 'pdf',       label: 'PDFs'      },
  { value: 'link',      label: 'Links'     },
  { value: 'documento', label: 'Documentos'},
  { value: 'outro',     label: 'Outros'    },
]

function PortalMateriaisTab({ materials }: { materials: ClientMaterial[] }) {
  const [hover, setHover]         = useState<MatHoverState | null>(null)
  const [selected, setSelected]   = useState<ClientMaterial | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<MatTypeFilter>('todos')

  const handleClick = (mat: ClientMaterial) => {
    setSelected(mat)
    setModalOpen(true)
    setHover(null)
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, mat: ClientMaterial) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const tooltipW = 228
    const left = rect.right + 8 + tooltipW > window.innerWidth
      ? rect.left - tooltipW - 4
      : rect.right + 8
    const top = Math.min(rect.top, window.innerHeight - 320 - 16)
    setHover({ mat, top, left })
  }

  // Types that actually exist in the data
  const availableTypes = useMemo(() => {
    const present = new Set(materials.map(m => m.type))
    return MAT_TAB_LABELS.filter(t => t.value === 'todos' || present.has(t.value as MaterialType))
  }, [materials])

  // Materials filtered by type
  const filtered = useMemo(() =>
    typeFilter === 'todos' ? materials : materials.filter(m => m.type === typeFilter),
    [materials, typeFilter]
  )

  // Group by folder_name
  const { folders, byFolder, noFolder } = useMemo(() => {
    const foldersSet = new Set<string>()
    const byFolder: Record<string, ClientMaterial[]> = {}
    const noFolder: ClientMaterial[] = []
    filtered.forEach(m => {
      if (m.folder_name) {
        foldersSet.add(m.folder_name)
        if (!byFolder[m.folder_name]) byFolder[m.folder_name] = []
        byFolder[m.folder_name].push(m)
      } else {
        noFolder.push(m)
      }
    })
    return { folders: [...foldersSet], byFolder, noFolder }
  }, [filtered])

  const hasFolders = folders.length > 0

  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-xl border border-[#e8e8e8] bg-[#f0f0f0] flex items-center justify-center mb-4">
          <FolderOpen className="w-5 h-5 text-[#a0a0a0]" />
        </div>
        <p className="text-[14px] font-medium text-[#737373]">Nenhum material disponível</p>
        <p className="text-[12px] text-[#a0a0a0] mt-1 max-w-xs">
          Quando a agência adicionar materiais, eles aparecerão aqui.
        </p>
      </div>
    )
  }

  const rowProps = { onClick: handleClick, onMouseEnter: handleMouseEnter, onMouseLeave: setHover }

  return (
    <div className="space-y-4">
      {/* Type filter tabs — only shown when multiple types exist */}
      {availableTypes.length > 2 && (
        <div className="flex gap-1.5 flex-wrap">
          {availableTypes.map(({ value, label }) => {
            const count = value === 'todos' ? materials.length : materials.filter(m => m.type === value).length
            return (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                  typeFilter === value
                    ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                    : 'bg-white text-[#737373] border-[#e0e0e0] hover:bg-[#f5f5f5] hover:text-[#0f0f0f]'
                }`}
              >
                {label} <span className={`ml-1 text-[10px] ${typeFilter === value ? 'text-white/70' : 'text-[#b0b0b0]'}`}>({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Material list — grouped by folder or flat */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[13px] text-[#a0a0a0]">Nenhum material nessa categoria.</p>
        </div>
      ) : hasFolders ? (
        <div className="space-y-6">
          {/* Folders */}
          {folders.map(folder => (
            <div key={folder}>
              <div className="flex items-center gap-2 mb-2.5">
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider">{folder}</p>
                <span className="text-[10px] text-[#b0b0b0]">({byFolder[folder].length})</span>
              </div>
              <div className="space-y-2 pl-0.5">
                {byFolder[folder].map(mat => <MatRow key={mat.id} mat={mat} {...rowProps} />)}
              </div>
            </div>
          ))}
          {/* Items without folder */}
          {noFolder.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <p className="text-[11px] font-semibold text-[#b0b0b0] uppercase tracking-wider">Outros</p>
              </div>
              <div className="space-y-2">
                {noFolder.map(mat => <MatRow key={mat.id} mat={mat} {...rowProps} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(mat => <MatRow key={mat.id} mat={mat} {...rowProps} />)}
        </div>
      )}

      <AnimatePresence>
        {hover && <MaterialHoverCard state={hover} />}
      </AnimatePresence>

      {selected && (
        <MaterialDetailModal
          mat={selected}
          open={modalOpen}
          onClose={() => { setModalOpen(false); setSelected(null) }}
        />
      )}
    </div>
  )
}

// ─── Portal Suporte ───────────────────────────────────────────────────────────

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  whatsapp: 'WhatsApp', email: 'E-mail', telefone: 'Telefone', outro: 'Outro',
}

function PortalContactIcon({ type }: { type: ContactType }) {
  switch (type) {
    case 'whatsapp': return <MessageCircle className="w-4 h-4 text-green-400" />
    case 'email':    return <Mail          className="w-4 h-4 text-blue-400" />
    case 'telefone': return <Phone         className="w-4 h-4 text-gray-400" />
    default:         return <Phone         className="w-4 h-4 text-gray-500" />
  }
}

function autoLink(type: ContactType, value: string): string {
  const clean = value.trim()
  switch (type) {
    case 'whatsapp': return `https://wa.me/${clean.replace(/\D/g, '')}`
    case 'email':    return `mailto:${clean}`
    case 'telefone': return `tel:${clean.replace(/\s/g, '')}`
    default:         return clean.startsWith('http') ? clean : `https://${clean}`
  }
}

function PortalSuporteTab({ contacts }: { contacts: ClientSupportContact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-xl border border-[#e8e8e8] bg-[#f0f0f0] flex items-center justify-center mb-4">
          <LifeBuoy className="w-5 h-5 text-gray-600" />
        </div>
        <p className="text-[14px] font-medium text-[#737373]">Nenhum contato de suporte</p>
        <p className="text-[12px] text-gray-600 mt-1 max-w-xs">
          Em breve você verá os canais de atendimento da sua agência aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-4">
        Precisa de ajuda? Entre em contato com a equipe pelos canais abaixo.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {contacts.map(c => {
          const href = c.direct_link || autoLink(c.contact_type, c.contact_value)
          return (
            <a
              key={c.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-white border border-[#e8e8e8] rounded-xl hover:bg-[#f5f5f5] hover:border-[#d0d0d0] transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#f0f0f0] border border-[#e8e8e8] flex items-center justify-center flex-shrink-0">
                <PortalContactIcon type={c.contact_type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#0f0f0f] text-sm truncate">{c.name}</p>
                {c.role && <p className="text-xs text-gray-500 truncate">{c.role}</p>}
                <p className="text-[11px] text-gray-600 mt-0.5 truncate">
                  {CONTACT_TYPE_LABELS[c.contact_type]} · {c.contact_value}
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#737373] transition-colors flex-shrink-0" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ─── Content Asset Detail Modal ──────────────────────────────────────────────

function ContentAssetDetailModal({
  asset,
  open,
  onClose,
}: { asset: ContentAsset; open: boolean; onClose: () => void }) {
  const isImg = asset.media_url
    ? /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(asset.media_url)
    : false
  const isVid = asset.media_url
    ? /\.(mp4|webm|ogg|mov)(\?|$)/i.test(asset.media_url)
    : false

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2.5 min-w-0">
            <ImageIcon className="w-4 h-4 text-[#a0a0a0] flex-shrink-0" />
            <DialogTitle className="text-base leading-snug break-words min-w-0">{asset.title}</DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-gray-500">{contentTypeLabels[asset.content_type as ContentType]}</span>
            {asset.category && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-xs text-gray-500">{asset.category}</span>
              </>
            )}
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-500">{formatDate(asset.created_at)}</span>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-1 min-w-0">

          {/* Imagem */}
          {isImg && asset.media_url && (
            <a href={asset.media_url} target="_blank" rel="noopener noreferrer"
              className="block w-full overflow-hidden rounded-xl border border-[#e8e8e8] hover:border-[#c8c8c8] transition-colors">
              <img src={asset.media_url} alt={asset.title} className="w-full max-w-full object-contain" style={{ maxHeight: 280 }} />
            </a>
          )}

          {/* Vídeo */}
          {isVid && asset.media_url && (
            <video src={asset.media_url} controls className="w-full max-w-full rounded-xl border border-[#e8e8e8]" />
          )}

          {/* Arquivo não-mídia */}
          {asset.media_url && !isImg && !isVid && (
            <a href={asset.media_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2.5 bg-[#f7f7f7] border border-[#e8e8e8] rounded-xl hover:border-[#d0d0d0] hover:bg-[#f0f0f0] transition-colors min-w-0">
              <File className="w-4 h-4 text-[#a0a0a0] flex-shrink-0" />
              <span className="text-xs text-[#0f0f0f] truncate flex-1 min-w-0">Abrir arquivo</span>
              <ExternalLink className="w-3 h-3 text-[#a0a0a0] flex-shrink-0" />
            </a>
          )}

          {/* Legenda */}
          {asset.caption && (
            <div className="p-3 bg-[#f7f7f7] rounded-xl border border-[#e8e8e8]">
              <p className="text-[10px] text-[#a0a0a0] uppercase tracking-wide mb-2">Legenda / Copy</p>
              <p className="text-sm text-[#0f0f0f] leading-relaxed whitespace-pre-wrap break-words">{asset.caption}</p>
            </div>
          )}

          {/* Observações */}
          {asset.observations && (
            <div className="p-3 bg-[#f7f7f7] rounded-xl border border-[#e8e8e8]">
              <p className="text-[10px] text-[#a0a0a0] uppercase tracking-wide mb-2">Observações</p>
              <p className="text-sm text-[#737373] leading-relaxed whitespace-pre-wrap break-words">{asset.observations}</p>
            </div>
          )}

          {/* Link externo — botão proeminente */}
          {asset.link_url && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Link</p>
              <a
                href={asset.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-3 bg-[#f7f7f7] border border-[#e8e8e8] rounded-xl hover:border-[#d0d0d0] hover:bg-[#f0f0f0] transition-colors min-w-0 overflow-hidden"
              >
                <Link2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-xs text-blue-600 flex-1 min-w-0 break-all">{asset.link_url}</span>
                <span className="flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 flex-shrink-0">
                  Abrir link <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            </div>
          )}

          {!asset.caption && !asset.observations && !asset.media_url && !asset.link_url && (
            <p className="text-xs text-[#a0a0a0] text-center py-4">Nenhuma informação adicional.</p>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          {asset.link_url && (
            <a href={asset.link_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm">
                <Link2 className="w-3.5 h-3.5" /> Abrir link
              </Button>
            </a>
          )}
          {asset.media_url && !isImg && !isVid && (
            <a href={asset.media_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline">
                <Download className="w-3.5 h-3.5" /> Baixar arquivo
              </Button>
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Portal Dashboard ────────────────────────────────────────────────────

export function PortalDashboard() {
  const { data: client, isLoading } = usePortalClient()
  const { data: plannerItems } = usePortalPlanner()
  const { data: contents } = usePortalContents()
  const { data: contentAssets = [] } = usePortalContentAssets()
  const { data: brandDNA } = usePortalBrandDNA()
  const { data: materials = [] } = usePortalMaterials()
  const { data: supportContacts = [] } = usePortalSupportContacts()
  const { data: portalPayments = [] } = usePortalPayments()
  const { data: notifications = [] } = useNotifications()
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [selectedAsset, setSelectedAsset] = useState<ContentAsset | null>(null)
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [autoOpenPlannerItemId, setAutoOpenPlannerItemId] = useState<string | null>(null)

  const rawName = profile?.full_name || ''
  const firstName = rawName.split(' ')[0] || 'Cliente'

  const pendingCount = (plannerItems || []).filter(
    i => i.approval_status === 'pendente_aprovacao' || (i.status === 'revisao' && !i.approval_status)
  ).length

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-full py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Carregando...</p>
          </div>
        </div>
      </PortalLayout>
    )
  }

  if (!client) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-full py-32">
          <div className="text-center">
            <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-[#737373] font-medium">Conta não vinculada</p>
            <p className="text-gray-500 text-sm mt-1">Entre em contato com sua agência.</p>
          </div>
        </div>
      </PortalLayout>
    )
  }

  const infoFields = [
    { label: 'Objetivo Principal', value: client.main_objective },
    { label: 'Público-alvo', value: client.target_audience },
    { label: 'Tom de Voz', value: client.tone_of_voice },
    { label: 'Estilo de Comunicação', value: client.communication_style },
    { label: 'Diferenciais', value: client.differentials },
    { label: 'Serviços Oferecidos', value: client.services_offered },
    { label: 'Observações', value: client.observations },
  ]

  return (
    <>
    <PortalLayout
      clientName={client.company_name}
      unreadCount={unreadCount}
      pendingCount={pendingCount}
      onBellClick={() => setShowNotifications(true)}
    >
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Cabeçalho da empresa */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 mb-8 p-5 rounded-2xl border border-[#e8e8e8] bg-white"
        >
          {client.logo_url ? (
            <img src={client.logo_url} alt={client.company_name}
              className="w-16 h-16 rounded-2xl object-cover border border-[#e8e8e8] flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#f0f0f0] border border-[#e8e8e8] flex items-center justify-center text-2xl font-bold text-[#0f0f0f] flex-shrink-0">
              {client.company_name[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-[#0f0f0f]">{client.company_name}</h1>
              <Badge status={client.status} />
            </div>
            <p className="text-[#737373] text-sm mt-0.5">{client.responsible_name} · {client.niche}</p>
            <div className="flex flex-wrap gap-3 mt-2">
              {client.instagram && (
                <span className="flex items-center gap-1 text-xs text-[#737373]">
                  <Instagram className="w-3 h-3" /> @{client.instagram.replace('@', '')}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1 text-xs text-[#737373]">
                  <Mail className="w-3 h-3" /> {client.email}
                </span>
              )}
              {client.whatsapp && (
                <span className="flex items-center gap-1 text-xs text-[#737373]">
                  <Phone className="w-3 h-3" /> {client.whatsapp}
                </span>
              )}
              {client.website && (
                <span className="flex items-center gap-1 text-xs text-[#737373]">
                  <Globe className="w-3 h-3" /> {client.website}
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-gray-500 flex-shrink-0">
            <p>Cliente desde</p>
            <p className="font-medium text-[#737373]">{formatDate(client.entry_date)}</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="planejamento">
              Planejamento ({plannerItems?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="conteudos">
              Conteúdos ({(contents?.length || 0) + contentAssets.length})
            </TabsTrigger>
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
            <TabsTrigger value="suporte">Suporte</TabsTrigger>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="notas">Solicitações</TabsTrigger>
          </TabsList>

          {/* Aba Dashboard */}
          <TabsContent value="dashboard">
            <ClientDashboardTab
              client={client}
              plannerItems={plannerItems || []}
              contents={contents || []}
              onNavigate={setActiveTab}
              firstName={firstName}
              payments={portalPayments}
            />
          </TabsContent>

          {/* Aba Planejamento */}
          <TabsContent value="planejamento">
            {plannerItems && plannerItems.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-sm">Nenhum conteúdo planejado ainda.</p>
              </div>
            ) : (
              <PortalPlannerView
                items={plannerItems || []}
                autoOpenItemId={autoOpenPlannerItemId}
                onItemAutoOpened={() => setAutoOpenPlannerItemId(null)}
              />
            )}
          </TabsContent>

          {/* Aba Conteúdos */}
          <TabsContent value="conteudos">
            <div className="space-y-6">

              {/* Conteúdos gerados com IA */}
              {(contents && contents.length > 0) && (
                <div>
                  <p className="text-[11px] font-semibold text-[#a0a0a0] uppercase tracking-wide mb-3">Gerados com IA</p>
                  <div className="space-y-2">
                    {contents.map(c => (
                      <Card key={c.id} className="hover:border-[#d0d0d0] transition-colors">
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#0f0f0f] text-sm truncate">{c.title || c.term}</p>
                            {c.subtitle && <p className="text-xs text-[#737373] truncate mt-0.5">{c.subtitle}</p>}
                            <p className="text-xs text-[#a0a0a0] mt-1">{formatRelative(c.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge status={c.status} />
                            <span className="text-xs text-[#737373]">{contentTypeLabels[c.content_type]}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Arsenal Visual (content_assets) */}
              {contentAssets.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-[#a0a0a0] uppercase tracking-wide mb-3">Arsenal visual</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {contentAssets.map(asset => {
                      const isImg = asset.media_url && /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(asset.media_url)
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => { setSelectedAsset(asset); setAssetModalOpen(true) }}
                          className="rounded-xl border border-[#e8e8e8] bg-white overflow-hidden hover:border-[#c8c8c8] hover:shadow-sm transition-all text-left w-full"
                        >
                          {/* Thumbnail */}
                          <div className="h-28 bg-[#f5f5f5] flex items-center justify-center overflow-hidden">
                            {asset.media_url ? (
                              isImg ? (
                                <img
                                  src={asset.media_url}
                                  alt={asset.title}
                                  className="w-full h-full object-cover"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <File className="w-6 h-6 text-[#b0b0b0]" />
                                  <span className="text-[10px] text-[#b0b0b0]">Ver arquivo</span>
                                </div>
                              )
                            ) : (
                              <ImageIcon className="w-6 h-6 text-[#c8c8c8]" />
                            )}
                          </div>
                          {/* Info */}
                          <div className="p-2.5">
                            <p className="text-[12px] font-medium text-[#0f0f0f] truncate">{asset.title}</p>
                            {asset.caption && (
                              <p className="text-[10px] text-[#737373] mt-0.5 line-clamp-2 leading-relaxed">{asset.caption}</p>
                            )}
                            <p className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-600">
                              <Eye className="w-2.5 h-2.5" /> Ver detalhes
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(!contents || contents.length === 0) && contentAssets.length === 0 && (
                <div className="text-center py-16">
                  <Sparkles className="w-8 h-8 text-[#c0c0c0] mx-auto mb-2" />
                  <p className="text-[#737373] text-sm">Nenhum conteúdo disponível ainda.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Aba Empresa */}
          <TabsContent value="empresa">
            <div className="space-y-6">
              {/* Informações gerais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {infoFields.map(({ label, value }) => value && (
                  <Card key={label}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-[#a0a0a0] uppercase tracking-wide">{label}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-[#737373]">{value}</p>
                    </CardContent>
                  </Card>
                ))}
                {infoFields.every(f => !f.value) && (
                  <div className="col-span-2 text-center py-8">
                    <p className="text-[#a0a0a0] text-sm">Nenhuma informação estratégica cadastrada ainda.</p>
                  </div>
                )}
              </div>

              {/* Brand DNA */}
              {brandDNA && (
                brandDNA.how_brand_speaks || brandDNA.how_brand_not_speaks ||
                brandDNA.positioning || brandDNA.ideal_language || brandDNA.mental_triggers
              ) && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-[#e8e8e8]" />
                    <p className="text-[11px] font-semibold text-[#a0a0a0] uppercase tracking-wider px-2">Identidade da marca</p>
                    <div className="h-px flex-1 bg-[#e8e8e8]" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {brandDNA.how_brand_speaks && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-[#a0a0a0] uppercase tracking-wide">Como a marca fala</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-[#737373]">{brandDNA.how_brand_speaks}</p>
                        </CardContent>
                      </Card>
                    )}
                    {brandDNA.how_brand_not_speaks && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-[#a0a0a0] uppercase tracking-wide">Como não fala</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-[#737373]">{brandDNA.how_brand_not_speaks}</p>
                        </CardContent>
                      </Card>
                    )}
                    {brandDNA.positioning && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-[#a0a0a0] uppercase tracking-wide">Posicionamento</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-[#737373]">{brandDNA.positioning}</p>
                        </CardContent>
                      </Card>
                    )}
                    {brandDNA.ideal_language && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-[#a0a0a0] uppercase tracking-wide">Linguagem ideal</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-[#737373]">{brandDNA.ideal_language}</p>
                        </CardContent>
                      </Card>
                    )}
                    {brandDNA.mental_triggers && (
                      <Card className="md:col-span-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-[#a0a0a0] uppercase tracking-wide">Gatilhos mentais</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-[#737373]">{brandDNA.mental_triggers}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Aba Materiais */}
          <TabsContent value="materiais">
            <PortalMateriaisTab materials={materials} />
          </TabsContent>

          {/* Aba Suporte */}
          <TabsContent value="suporte">
            <PortalSuporteTab contacts={supportContacts} />
          </TabsContent>

          {/* Aba Resultados */}
          <TabsContent value="resultados">
            <PortalResultadosTab />
          </TabsContent>

          {/* Aba Financeiro */}
          <TabsContent value="financeiro">
            <PortalFinanceiroTab />
          </TabsContent>

          {/* Aba Notas */}
          <TabsContent value="notas">
            <PortalNotesTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de detalhe de conteúdo do arsenal */}
      {selectedAsset && (
        <ContentAssetDetailModal
          asset={selectedAsset}
          open={assetModalOpen}
          onClose={() => { setAssetModalOpen(false); setSelectedAsset(null) }}
        />
      )}
    </PortalLayout>

    {/* Modal de notificações */}
    <NotificationsModal
      open={showNotifications}
      onClose={() => setShowNotifications(false)}
      onView={(notification) => {
        setShowNotifications(false)
        setActiveTab('planejamento')
        if (notification.link) {
          setAutoOpenPlannerItemId(notification.link)
        }
      }}
    />
    </>
  )
}
