import { useState, useRef, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon,
  Save, Paperclip, Link2, X, FileText, ImageIcon, Video, Music, File,
  Building2, Upload, Trash2, Pencil, CalendarDays, ExternalLink, Check,
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { usePlanner, useCreatePlannerItem, useUpdatePlannerItem, useDeletePlannerItem } from '@/hooks/usePlanner'
import { useClients } from '@/hooks/useClients'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import { contentTypeLabels } from '@/utils/formatters'
import { supabase } from '@/integrations/supabase/client'
import { useContentAssets } from '@/hooks/useContentAssets'
import { PlannerCommentsThread } from '@/components/PlannerCommentsThread'
import type { PlannerStatus, PlannerItem, PlannerAttachment, PlannerLink, ContentType, ApprovalStatus, ContentAsset } from '@/types'

// ─── Status config ────────────────────────────────────────────────────────────

const statusColors: Record<PlannerStatus, string> = {
  ideia: 'bg-purple-500',
  producao: 'bg-blue-500',
  revisao: 'bg-yellow-500',
  aprovado: 'bg-green-500',
  publicado: 'bg-emerald-500',
}

const statusTextColors: Record<PlannerStatus, string> = {
  ideia: 'text-purple-400',
  producao: 'text-blue-400',
  revisao: 'text-yellow-400',
  aprovado: 'text-green-400',
  publicado: 'text-emerald-400',
}

const statusLabels: Record<PlannerStatus, string> = {
  ideia: 'Ideia',
  producao: 'Produção',
  revisao: 'Revisão',
  aprovado: 'Aprovado',
  publicado: 'Publicado',
}

// ─── Approval config ─────────────────────────────────────────────────────────

const approvalDot: Record<ApprovalStatus, string> = {
  pendente_aprovacao: 'bg-yellow-400',
  aprovado: 'bg-green-400',
  ajuste_solicitado: 'bg-orange-400',
  ajuste_realizado: 'bg-blue-400',
  reprovado: 'bg-red-400',
}
const approvalTextColor: Record<ApprovalStatus, string> = {
  pendente_aprovacao: 'text-yellow-400',
  aprovado: 'text-green-400',
  ajuste_solicitado: 'text-orange-400',
  ajuste_realizado: 'text-blue-400',
  reprovado: 'text-red-400',
}
const approvalLabel: Record<ApprovalStatus, string> = {
  pendente_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado pelo cliente',
  ajuste_solicitado: 'Ajuste solicitado',
  ajuste_realizado: 'Ajuste realizado',
  reprovado: 'Reprovado pelo cliente',
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

function extractStoragePath(url: string): string | null {
  const marker = '/planner-attachments/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
}

// ─── Helpers de mídia ────────────────────────────────────────────────────────

function guessMediaType(url: string): string {
  const lower = url.toLowerCase().split('?')[0]
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg)$/.test(lower)) return 'image/jpeg'
  if (/\.(mp4|mov|webm|avi)$/.test(lower)) return 'video/mp4'
  if (/\.(pdf)$/.test(lower)) return 'application/pdf'
  return 'application/octet-stream'
}

// ─── Content Picker Dialog ────────────────────────────────────────────────────

function ContentPickerDialog({
  open,
  onClose,
  clientId,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  clientId: string
  onSelect: (asset: ContentAsset) => void
}) {
  const { data: assets } = useContentAssets(clientId)
  const [search, setSearch] = useState('')

  const filtered = (assets || []).filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[80vh] flex flex-col overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Selecionar conteúdo do arsenal</DialogTitle>
        </DialogHeader>

        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-8 px-3 rounded-md border border-white/[0.08] bg-white/[0.03] text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20 mb-3"
        />

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-6 h-6 text-zinc-700 mx-auto mb-1.5" />
              <p className="text-[12px] text-zinc-600">
                {(assets || []).length === 0
                  ? 'Nenhum conteúdo no arsenal deste cliente.'
                  : 'Nenhum resultado para a busca.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filtered.map(asset => {
                const isImg = asset.media_url && /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(asset.media_url)
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => { onSelect(asset); onClose() }}
                    className="group text-left rounded-lg border border-white/[0.06] overflow-hidden bg-[#111113] hover:border-white/[0.15] transition-colors"
                  >
                    <div className="aspect-square overflow-hidden bg-white/[0.03]">
                      {isImg ? (
                        <img
                          src={asset.media_url!}
                          alt={asset.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-zinc-700" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] text-zinc-200 truncate">{asset.title}</p>
                      <p className="text-[10px] text-zinc-600">{contentTypeLabels[asset.content_type as ContentType]}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Hover Tooltip ────────────────────────────────────────────────────────────

interface HoverState { items: PlannerItem[]; top: number; left: number }

function DayTooltip({
  state,
  onMouseEnter,
  onMouseLeave,
  onOpenItem,
}: {
  state: HoverState
  onMouseEnter: () => void
  onMouseLeave: () => void
  onOpenItem: (item: PlannerItem) => void
}) {
  return (
    <div
      className="fixed z-50 pointer-events-auto"
      style={{ top: state.top, left: state.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ duration: 0.13 }}
        className="bg-[#13131f] border border-white/10 rounded-xl shadow-2xl w-[270px] text-xs text-white overflow-hidden"
      >
        {/* Header */}
        <div className="px-3 pt-2.5 pb-1.5 border-b border-white/[0.07]">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            {state.items.length} {state.items.length === 1 ? 'conteúdo' : 'conteúdos'}
          </p>
        </div>

        {/* Scrollable items */}
        <div className="overflow-y-auto max-h-[340px] p-2 space-y-1.5">
          {state.items.map(item => {
            const as_ = (item.approval_status || 'pendente_aprovacao') as ApprovalStatus
            const accent = getApprovalAccent(item)
            const thumb = item.attachments?.find(a => a.file_type.startsWith('image/'))
            return (
              <button
                key={item.id}
                onClick={() => onOpenItem(item)}
                className="w-full text-left rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-colors overflow-hidden"
                style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
              >
                {thumb && (
                  <img src={thumb.file_url} alt="" className="w-full h-20 object-cover" draggable={false} />
                )}
                <div className="px-2.5 py-2">
                  <p className="font-semibold text-white text-[11px] leading-snug mb-1">{item.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.client && (
                      <div className="flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" />
                        <span className="text-[9px] text-gray-400 truncate max-w-[80px]">{item.client.company_name}</span>
                      </div>
                    )}
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${accent}20`, color: accent }}
                    >
                      {contentTypeLabels[item.content_type as ContentType]}
                    </span>
                    <span className={`ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      as_ === 'aprovado' ? 'bg-green-500/15 text-green-400' :
                      as_ === 'ajuste_solicitado' ? 'bg-orange-500/15 text-orange-400' :
                      as_ === 'ajuste_realizado' ? 'bg-blue-500/15 text-blue-400' :
                      as_ === 'reprovado' ? 'bg-red-500/15 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {approvalLabel[as_]}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-[9px] text-gray-400 line-clamp-1 mt-1">{item.notes}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Visualização completa do evento ─────────────────────────────────────────

function PlannerItemView({
  item,
  open,
  onClose,
  onEdit,
}: {
  item: PlannerItem
  open: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const images = item.attachments?.filter(a => a.file_type.startsWith('image/')) || []
  const otherAttachments = item.attachments?.filter(a => !a.file_type.startsWith('image/')) || []

  const [localApprovalStatus, setLocalApprovalStatus] = useState<ApprovalStatus | null>(
    item.approval_status as ApprovalStatus | null
  )
  const updateItem = useUpdatePlannerItem()
  const { toast } = useToast()

  const handleMarkAdjustmentDone = async () => {
    try {
      await updateItem.mutateAsync({ id: item.id, approval_status: 'ajuste_realizado' })
      setLocalApprovalStatus('ajuste_realizado')
      toast('Ajuste marcado como realizado.', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[item.status as PlannerStatus]}`} />
            <DialogTitle className="text-base leading-snug break-words min-w-0">{item.title}</DialogTitle>
          </div>
          <div className="flex items-center gap-2 mt-1.5 ml-4.5 flex-wrap">
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

        <div className="space-y-4 mt-1 min-w-0 w-full max-w-full overflow-x-hidden">
          {/* Cliente */}
          {item.client && (
            <div className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/8">
              <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Cliente</p>
                <p className="text-sm text-white font-medium">{item.client.company_name}</p>
              </div>
            </div>
          )}

          {/* Notas */}
          {item.notes && (
            <div className="p-3 bg-white/3 rounded-xl border border-white/8">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Notas</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words select-text" style={{ color: '#0f0f0f' }}>{item.notes}</p>
            </div>
          )}

          {/* Imagens em destaque */}
          {images.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Imagens</p>
              <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {images.map(img => (
                  <a
                    key={img.id}
                    href={img.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full max-w-full overflow-hidden rounded-xl border border-white/8 hover:border-white/20 transition-colors"
                  >
                    <img
                      src={img.file_url}
                      alt={img.file_name}
                      className="w-full max-w-full object-contain max-h-[60vh]"
                    />
                    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/3">
                      <ImageIcon className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-gray-400 truncate flex-1">{img.file_name}</span>
                      <ExternalLink className="w-3 h-3 text-gray-600" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Outros anexos */}
          {otherAttachments.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Anexos</p>
              <div className="space-y-1.5">
                {otherAttachments.map(att => (
                  <a
                    key={att.id}
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 bg-white/3 border border-white/8 rounded-xl hover:border-white/20 hover:bg-white/5 transition-colors min-w-0 max-w-full overflow-hidden"
                  >
                    <FileTypeIcon type={att.file_type} size="md" />
                    <span className="text-xs text-gray-300 truncate flex-1">{att.file_name}</span>
                    {att.file_size && (
                      <span className="text-[10px] text-gray-600 flex-shrink-0">{formatFileSize(att.file_size)}</span>
                    )}
                    <ExternalLink className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {item.links && item.links.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Links</p>
              <div className="space-y-1.5">
                {item.links.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 bg-white/3 border border-white/8 rounded-xl hover:border-white/20 hover:bg-white/5 transition-colors min-w-0 overflow-hidden"
                  >
                    <Link2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-blue-300 flex-1 min-w-0 break-all">{link.label || link.url}</span>
                    <ExternalLink className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Nenhum conteúdo extra */}
          {!item.client && !item.notes && images.length === 0 && otherAttachments.length === 0 && (!item.links || item.links.length === 0) && (
            <p className="text-xs text-gray-600 text-center py-4">Nenhuma informação adicional cadastrada.</p>
          )}

          {/* Resposta do cliente */}
          {item.approval_status && (
            <div className="p-3 bg-white/3 rounded-xl border border-white/8">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Resposta do Cliente</p>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${approvalDot[(localApprovalStatus ?? item.approval_status) as ApprovalStatus]}`} />
                <span className={`text-xs font-medium ${approvalTextColor[(localApprovalStatus ?? item.approval_status) as ApprovalStatus]}`}>
                  {approvalLabel[(localApprovalStatus ?? item.approval_status) as ApprovalStatus]}
                </span>
                {item.reviewed_at && (
                  <span className="text-[10px] text-gray-600 ml-auto">
                    {format(parseISO(item.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
              {item.client_feedback && (
                <p className="text-xs text-gray-300 leading-relaxed bg-white/5 rounded-lg px-3 py-2 break-words">
                  "{item.client_feedback}"
                </p>
              )}
              {(localApprovalStatus ?? item.approval_status) === 'ajuste_solicitado' && (
                <button
                  onClick={handleMarkAdjustmentDone}
                  disabled={updateItem.isPending}
                  className="mt-3 flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                >
                  {updateItem.isPending
                    ? <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    : <Check className="w-3 h-3" />}
                  Ajuste realizado
                </button>
              )}
            </div>
          )}

          {/* Thread de comentários */}
          <PlannerCommentsThread plannerId={item.id} role="agency" />
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" /> Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Day Item Card — card clicável na lista do dia ────────────────────────────

function DayItemCard({
  item,
  onView,
  onEdit,
  onDelete,
}: {
  item: PlannerItem
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const thumbnail = item.attachments?.find(a => a.file_type.startsWith('image/'))

  return (
    <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden w-full max-w-full min-w-0">
      {/* Área clicável para visualização */}
      <div
        onClick={onView}
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors group/view min-w-0 w-full max-w-full"
      >
        {thumbnail && (
          <img src={thumbnail.file_url} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColors[item.status as PlannerStatus]}`} />
            <p className="font-medium text-white text-sm break-words">{item.title}</p>
          </div>
          <p className="text-xs text-gray-500 mb-1 ml-3.5">
            {contentTypeLabels[item.content_type as ContentType]} · {statusLabels[item.status as PlannerStatus]}
          </p>
          {item.client && (
            <div className="flex items-center gap-1 ml-3.5 mb-1">
              <Building2 className="w-3 h-3 text-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-400 truncate">{item.client.company_name}</span>
            </div>
          )}
          {item.notes && (
            <p className="text-xs text-gray-500 line-clamp-2 ml-3.5 mb-1">{item.notes}</p>
          )}
          {(() => {
            const as_ = (item.approval_status || 'pendente_aprovacao') as ApprovalStatus
            return (
              <div className="flex items-center gap-1.5 ml-3.5 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${approvalDot[as_]}`} />
                <span className={`text-[10px] font-medium ${approvalTextColor[as_]}`}>
                  {approvalLabel[as_]}
                </span>
              </div>
            )
          })()}
          <div className="flex items-center gap-3 ml-3.5 mt-1">
            {item.attachments && item.attachments.length > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip className="w-3 h-3 text-gray-500" />
                <span className="text-[11px] text-gray-500">
                  {item.attachments.length} {item.attachments.length === 1 ? 'anexo' : 'anexos'}
                </span>
              </div>
            )}
            {item.links && item.links.length > 0 && (
              <div className="flex items-center gap-1">
                <Link2 className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] text-blue-400">
                  {item.links.length} {item.links.length === 1 ? 'link' : 'links'}
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Seta indicando que é clicável */}
        <ChevronRightIcon className="w-4 h-4 text-gray-600 group-hover/view:text-gray-300 transition-colors flex-shrink-0 mt-0.5" />
      </div>

      {/* Ações separadas da área de visualização */}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-2 border-t border-white/8">
          <span className="text-xs text-gray-400 flex-1">Confirmar exclusão?</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300"
            onClick={() => { setConfirming(false); onDelete() }}
          >
            Excluir
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2 px-3 pb-3 pt-2 border-t border-white/8">
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-500 hover:text-red-400"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Drag & Drop primitives ───────────────────────────────────────────────────

function getApprovalAccent(item: PlannerItem): string {
  if (item.status === 'publicado') return '#10b981'
  switch (item.approval_status) {
    case 'aprovado':          return '#22c55e'
    case 'ajuste_solicitado': return '#f97316'
    case 'ajuste_realizado':  return '#3b82f6'
    case 'reprovado':         return '#ef4444'
    default:                  return '#eab308'
  }
}

function CalendarCard({ item, disabled, onOpen }: { item: PlannerItem; disabled: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, disabled })
  const accent = getApprovalAccent(item)
  const thumb = item.attachments?.find(a => a.file_type.startsWith('image/'))

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ touchAction: 'none', opacity: isDragging ? 0.2 : 1, borderLeftColor: accent }}
      onClick={e => { e.stopPropagation(); onOpen() }}
      className={`w-full rounded-[4px] border border-gray-200 border-l-[3px] bg-white shadow-sm overflow-hidden transition-all hover:shadow-md select-none
        ${disabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
    >
      {/* Thumbnail compacta — apenas sm+ */}
      {thumb && (
        <img
          src={thumb.file_url}
          alt=""
          className="hidden sm:block w-full object-cover"
          style={{ height: 44 }}
          draggable={false}
        />
      )}
      <div className="px-1 sm:px-1.5 py-0.5">
        <p className="text-[8px] sm:text-[9px] font-semibold text-gray-800 truncate leading-tight">{item.title}</p>
        {/* Desktop: chip de tipo */}
        <div className="hidden sm:block mt-0.5">
          <span
            className="text-[7px] px-1 py-0.5 rounded font-semibold"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            {contentTypeLabels[item.content_type as ContentType]}
          </span>
        </div>
        {/* Mobile: ponto colorido */}
        <div className="flex sm:hidden items-center gap-0.5 mt-0.5">
          <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
        </div>
      </div>
    </div>
  )
}

function DroppableDay({
  day, isCurrentMonth, isCurrentDay, hasItems, dragging,
  onDayClick, onMouseEnter, onMouseLeave, children,
}: {
  day: Date
  isCurrentMonth: boolean
  isCurrentDay: boolean
  hasItems: boolean
  dragging: boolean
  onDayClick: () => void
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave: () => void
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${format(day, 'yyyy-MM-dd')}`,
    disabled: !isCurrentMonth,
  })
  return (
    <div
      ref={setNodeRef}
      onClick={() => isCurrentMonth && !dragging && onDayClick()}
      onMouseEnter={e => isCurrentMonth && !dragging && onMouseEnter(e)}
      onMouseLeave={() => !dragging && onMouseLeave()}
      className={`
        h-[44px] sm:h-[150px] p-0.5 sm:p-1.5 rounded sm:rounded-lg border transition-all overflow-hidden
        ${isCurrentMonth
          ? `cursor-pointer ${isOver
              ? 'border-blue-400/60 bg-blue-500/10 scale-[1.02]'
              : 'border-black/10 hover:border-black/20 hover:bg-gray-50'}`
          : 'border-transparent opacity-30 cursor-default'}
        ${isCurrentDay && !isOver ? 'border-blue-500/40 bg-blue-50' : ''}
        ${hasItems && isCurrentMonth && !isOver ? 'hover:border-black/20' : ''}
      `}
    >
      {children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Planner() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Modal de criação/edição
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content_type: 'post',
    status: 'ideia' as PlannerStatus,
    notes: '',
    client_id: null as string | null,
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    scheduled_time: '',
  })
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [pendingLinks, setPendingLinks] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Modo edição
  const [editingItem, setEditingItem] = useState<PlannerItem | null>(null)
  const [existingAttachments, setExistingAttachments] = useState<PlannerAttachment[]>([])
  const [existingLinks, setExistingLinks] = useState<PlannerLink[]>([])
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<PlannerAttachment[]>([])
  const [linksToDelete, setLinksToDelete] = useState<PlannerLink[]>([])

  // Modal de detalhes do dia
  const [dayDetailsOpen, setDayDetailsOpen] = useState(false)
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null)

  // ── NOVO: visualização completa do evento ──────────────────────────────────
  const [selectedPlannerItem, setSelectedPlannerItem] = useState<PlannerItem | null>(null)
  const [itemViewOpen, setItemViewOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const autoOpenProcessed = useRef(false)

  // Arsenal: picker de conteúdo
  const [pickerOpen, setPickerOpen] = useState(false)
  const [linkedAsset, setLinkedAsset] = useState<ContentAsset | null>(null)

  // Filtro por cliente
  const [selectedClientFilter, setSelectedClientFilter] = useState<string | null>(null)

  // Filtro por status de aprovação
  const [selectedApprovalFilter, setSelectedApprovalFilter] = useState<ApprovalStatus | 'todos'>('todos')

  // Hover tooltip
  const [hover, setHover] = useState<HoverState | null>(null)
  const hideTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startHideTimer = () => {
    hideTooltipTimerRef.current = setTimeout(() => setHover(null), 180)
  }
  const cancelHideTimer = () => {
    if (hideTooltipTimerRef.current) {
      clearTimeout(hideTooltipTimerRef.current)
      hideTooltipTimerRef.current = null
    }
  }

  // Drag and drop
  const [draggingItem, setDraggingItem] = useState<PlannerItem | null>(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const { data: items } = usePlanner()
  const { data: clients } = useClients()

  // Auto-abrir item via query param ?item=UUID (vindo de notificação)
  useEffect(() => {
    const itemId = searchParams.get('item')
    if (!itemId || !items?.length || autoOpenProcessed.current) return
    const found = items.find(i => i.id === itemId)
    if (found) {
      autoOpenProcessed.current = true
      setSelectedPlannerItem(found)
      setItemViewOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, items])
  const createItem = useCreatePlannerItem()
  const updateItem = useUpdatePlannerItem()
  const deleteItem = useDeletePlannerItem()
  const { toast } = useToast()

  // ── Calendar calculations ──────────────────────────────────────────────────

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { locale: ptBR })
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const filteredItems = (selectedClientFilter
    ? (items || []).filter(i => i.client_id === selectedClientFilter)
    : (items || [])
  ).filter(i => {
    if (selectedApprovalFilter === 'todos') return true
    const status = (i.approval_status || 'pendente_aprovacao') as ApprovalStatus
    return status === selectedApprovalFilter
  })

  const getItemsForDay = (day: Date) =>
    filteredItems.filter(item => isSameDay(parseISO(item.scheduled_date), day))

  // ── Form helpers ───────────────────────────────────────────────────────────

  const set = (field: string, value: unknown) => setForm(p => ({ ...p, [field]: value }))

  const resetForm = () => {
    setForm({
      title: '', content_type: 'post', status: 'ideia',
      notes: '', client_id: null,
      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
      scheduled_time: '',
    })
    setPendingFiles([])
    setPendingLinks([])
    setLinkInput('')
    setEditingItem(null)
    setExistingAttachments([])
    setExistingLinks([])
    setAttachmentsToDelete([])
    setLinksToDelete([])
    setLinkedAsset(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) setPendingFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  const addLink = () => {
    const url = linkInput.trim()
    if (!url) return
    setPendingLinks(prev => [...prev, url])
    setLinkInput('')
  }

  // ── Drag and drop handlers ─────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const item = (items || []).find(i => i.id === event.active.id)
    if (item) { setDraggingItem(item); setHover(null) }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingItem(null)
    const { active, over } = event
    if (!over || !active) return
    const newDate = over.id as string          // "day-YYYY-MM-DD"
    if (!newDate.startsWith('day-')) return
    const dateStr = newDate.replace('day-', '')
    const item = (items || []).find(i => i.id === active.id)
    if (!item || item.scheduled_date === dateStr) return
    try {
      await updateItem.mutateAsync({ id: item.id, scheduled_date: dateStr })
      toast('Post movido para ' + format(new Date(dateStr + 'T00:00:00'), "dd/MM", { locale: ptBR }), 'success')
    } catch {
      toast('Erro ao mover post. Tente novamente.', 'error')
    }
  }

  // ── Click: dia vazio → criar | dia com itens → detalhes ───────────────────

  const handleDayClick = (day: Date, dayItems: PlannerItem[]) => {
    setHover(null)
    if (dayItems.length === 0) {
      resetForm()
      setForm(prev => ({
        ...prev,
        scheduled_date: format(day, 'yyyy-MM-dd'),
        client_id: selectedClientFilter ?? null,
      }))
      setOpen(true)
    } else {
      setSelectedDayDate(day)
      setDayDetailsOpen(true)
    }
  }

  // ── Abrir visualização completa do evento ──────────────────────────────────

  const openItemView = (item: PlannerItem) => {
    setSelectedPlannerItem(item)
    setItemViewOpen(true)
  }

  const closeItemView = () => {
    setItemViewOpen(false)
    setSelectedPlannerItem(null)
  }

  // ── Abrir modo edição ──────────────────────────────────────────────────────

  const openEdit = (item: PlannerItem) => {
    setDayDetailsOpen(false)
    setItemViewOpen(false)
    setSelectedPlannerItem(null)
    setEditingItem(item)
    setForm({
      title: item.title,
      content_type: item.content_type,
      status: item.status,
      notes: item.notes || '',
      client_id: item.client_id,
      scheduled_date: item.scheduled_date,
      scheduled_time: item.scheduled_time || '',
    })
    setExistingAttachments(item.attachments || [])
    setExistingLinks(item.links || [])
    setPendingFiles([])
    setPendingLinks([])
    setLinkInput('')
    setAttachmentsToDelete([])
    setLinksToDelete([])
    setOpen(true)
  }

  // ── Marcar para remoção (aplicado só no save) ──────────────────────────────

  const markAttachmentForDeletion = (att: PlannerAttachment) => {
    setExistingAttachments(prev => prev.filter(a => a.id !== att.id))
    setAttachmentsToDelete(prev => [...prev, att])
  }

  const markLinkForDeletion = (link: PlannerLink) => {
    setExistingLinks(prev => prev.filter(l => l.id !== link.id))
    setLinksToDelete(prev => [...prev, link])
  }

  // ── Salvar: cria ou atualiza ───────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.title.trim() || !user) return
    setIsUploading(true)
    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          title: form.title,
          content_type: form.content_type as ContentType,
          status: form.status,
          notes: form.notes || null,
          client_id: form.client_id,
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time || null,
        })
        for (const att of attachmentsToDelete) {
          const path = extractStoragePath(att.file_url)
          if (path) await supabase.storage.from('planner-attachments').remove([path])
          await supabase.from('planner_attachments').delete().eq('id', att.id)
        }
        if (linksToDelete.length > 0) {
          await supabase.from('planner_links').delete().in('id', linksToDelete.map(l => l.id))
        }
        for (const file of pendingFiles) {
          const ext = file.name.split('.').pop() || 'bin'
          const path = `${user.id}/${editingItem.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const { error: upErr } = await supabase.storage.from('planner-attachments').upload(path, file)
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('planner-attachments').getPublicUrl(path)
            await supabase.from('planner_attachments').insert({
              planner_id: editingItem.id, user_id: user.id,
              file_name: file.name, file_type: file.type || 'application/octet-stream',
              file_url: publicUrl, file_size: file.size,
            })
          }
        }
        if (pendingLinks.length > 0) {
          await supabase.from('planner_links').insert(
            pendingLinks.map(url => ({ planner_id: editingItem.id, user_id: user.id, url, label: null }))
          )
        }
        toast('Post atualizado!', 'success')
      } else {
        const created = await createItem.mutateAsync({
          user_id: user.id,
          title: form.title,
          content_type: form.content_type as ContentType,
          status: form.status,
          notes: form.notes || null,
          client_id: form.client_id,
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time || null,
          content_id: null,
          asset_id: linkedAsset?.id ?? null,
          approval_status: null,
          client_feedback: null,
          reviewed_at: null,
          reviewed_by: null,
        })
        // Vincular mídia do arsenal como anexo
        if (linkedAsset?.media_url) {
          const ext = linkedAsset.media_url.split('.').pop()?.split('?')[0] || 'file'
          await supabase.from('planner_attachments').insert({
            planner_id: created.id,
            user_id: user.id,
            file_name: `${linkedAsset.title}.${ext}`,
            file_type: guessMediaType(linkedAsset.media_url),
            file_url: linkedAsset.media_url,
            file_size: null,
          })
        }
        for (const file of pendingFiles) {
          const ext = file.name.split('.').pop() || 'bin'
          const path = `${user.id}/${created.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
          const { error: upErr } = await supabase.storage.from('planner-attachments').upload(path, file)
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('planner-attachments').getPublicUrl(path)
            await supabase.from('planner_attachments').insert({
              planner_id: created.id, user_id: user.id,
              file_name: file.name, file_type: file.type || 'application/octet-stream',
              file_url: publicUrl, file_size: file.size,
            })
          }
        }
        if (pendingLinks.length > 0) {
          await supabase.from('planner_links').insert(
            pendingLinks.map(url => ({ planner_id: created.id, user_id: user.id, url, label: null }))
          )
        }
        toast('Item adicionado ao planejamento!', 'success')
      }
      qc.invalidateQueries({ queryKey: ['planner'] })
      setOpen(false)
      resetForm()
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  // ── Selecionar conteúdo do arsenal ────────────────────────────────────────

  const handleAssetSelect = (asset: ContentAsset) => {
    setLinkedAsset(asset)
    set('title', asset.title)
    set('content_type', asset.content_type)
    if (asset.caption) set('notes', asset.caption)
    if (asset.link_url) setPendingLinks(prev => {
      if (prev.includes(asset.link_url!)) return prev
      return [...prev, asset.link_url!]
    })
  }

  // ── Hover handler ──────────────────────────────────────────────────────────

  const handleDayMouseEnter = (e: React.MouseEvent<HTMLDivElement>, dayItems: PlannerItem[]) => {
    if (dayItems.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const tooltipWidth = 268
    const left = rect.right + 8 + tooltipWidth > window.innerWidth
      ? rect.left - tooltipWidth - 4
      : rect.right + 8
    const estimatedHeight = Math.min(dayItems.length * 130, 380)
    const top = Math.min(rect.top, window.innerHeight - estimatedHeight - 16)
    setHover({ items: dayItems, top, left })
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header
        title="Planejamento"
        subtitle="Calendário editorial"
        action={
          <Button
            onClick={() => {
              resetForm()
              setForm(prev => ({
                ...prev,
                scheduled_date: format(new Date(), 'yyyy-MM-dd'),
                client_id: selectedClientFilter ?? null,
              }))
              setOpen(true)
            }}
            size="sm"
            variant="premium"
          >
            <Plus className="w-4 h-4" /> Novo post
          </Button>
        }
      />

      <div className="p-4 md:p-6">
        {/* Filtro por cliente */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setSelectedClientFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedClientFilter === null
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/8'
            }`}
          >
            Geral
          </button>
          {(clients || []).map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedClientFilter(c.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedClientFilter === c.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/8'
              }`}
            >
              {c.logo_url ? (
                <img src={c.logo_url} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-blue-500/40 to-purple-500/40 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                  {c.company_name[0].toUpperCase()}
                </span>
              )}
              {c.company_name}
            </button>
          ))}
        </div>

        {/* Filtro por status de aprovação */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {([
            { key: 'todos',              label: 'Todos',             dot: 'bg-gray-500' },
            { key: 'pendente_aprovacao', label: 'Pendentes',          dot: 'bg-yellow-400' },
            { key: 'aprovado',           label: 'Aprovados',          dot: 'bg-green-400' },
            { key: 'ajuste_solicitado',  label: 'Ajuste solicitado',  dot: 'bg-orange-400' },
            { key: 'ajuste_realizado',   label: 'Ajuste realizado',   dot: 'bg-blue-400' },
            { key: 'reprovado',          label: 'Reprovados',         dot: 'bg-red-400' },
          ] as const).map(({ key, label, dot }) => (
            <button
              key={key}
              onClick={() => setSelectedApprovalFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedApprovalFilter === key
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/8'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
              {label}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white capitalize">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
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

        {/* Calendar grid */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="w-full max-w-full min-w-0">
            <div className="grid grid-cols-7 mb-1 sm:mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-center text-[9px] sm:text-xs font-semibold text-[#0f0f0f] py-1 sm:py-2 truncate">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {days.map(day => {
                const dayItems = getItemsForDay(day)
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isCurrentDay = isToday(day)
                const hasItems = dayItems.length > 0

                return (
                  <DroppableDay
                    key={day.toISOString()}
                    day={day}
                    isCurrentMonth={isCurrentMonth}
                    isCurrentDay={isCurrentDay}
                    hasItems={hasItems}
                    dragging={!!draggingItem}
                    onDayClick={() => handleDayClick(day, dayItems)}
                    onMouseEnter={e => { cancelHideTimer(); handleDayMouseEnter(e, dayItems) }}
                    onMouseLeave={() => { if (!draggingItem) startHideTimer() }}
                  >
                    {/* Número do dia */}
                    <div className={`
                      text-[10px] sm:text-xs font-semibold mb-0.5 sm:mb-1 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full flex-shrink-0
                      ${isCurrentDay ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-[#0f0f0f]' : 'text-gray-400'}
                    `}>
                      {format(day, 'd')}
                    </div>

                    {/* Mini cards — máx 2, altura fixa, sem crescer */}
                    <div className="space-y-0.5 sm:space-y-1 overflow-hidden">
                      {dayItems.slice(0, 2).map(item => (
                        <CalendarCard
                          key={item.id}
                          item={item}
                          disabled={isMobile}
                          onOpen={() => openItemView(item)}
                        />
                      ))}
                      {dayItems.length > 2 && (
                        <p className="hidden sm:block text-[8px] text-gray-400 font-medium pl-0.5 leading-tight">
                          +{dayItems.length - 2} mais
                        </p>
                      )}
                    </div>
                  </DroppableDay>
                )
              })}
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Overlay visual durante o drag */}
        <DragOverlay dropAnimation={null}>
          {draggingItem ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#13131f] border border-white/20 shadow-xl text-[10px] text-white max-w-[160px]">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColors[draggingItem.status as PlannerStatus]}`} />
              <span className="truncate">{draggingItem.title}</span>
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>

        {/* Legend — cores de aprovação */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {([
            { label: 'Pendente',         color: '#eab308' },
            { label: 'Aprovado',         color: '#22c55e' },
            { label: 'Ajuste solicitado',color: '#f97316' },
            { label: 'Ajuste realizado', color: '#3b82f6' },
            { label: 'Reprovado',        color: '#ef4444' },
            { label: 'Publicado',        color: '#10b981' },
          ]).map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hover && (
          <DayTooltip
            state={hover}
            onMouseEnter={cancelHideTimer}
            onMouseLeave={startHideTimer}
            onOpenItem={item => { setHover(null); openItemView(item) }}
          />
        )}
      </AnimatePresence>

      {/* ── Modal: Detalhes do Dia ── */}
      <Dialog open={dayDetailsOpen} onOpenChange={setDayDetailsOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              <DialogTitle>
                {selectedDayDate && format(selectedDayDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </DialogTitle>
            </div>
            {selectedDayDate && (() => {
              const count = getItemsForDay(selectedDayDate).length
              return (
                <p className="text-xs text-gray-500 mt-0.5 ml-6">
                  {count} {count === 1 ? 'post planejado' : 'posts planejados'} · clique em um para ver detalhes
                </p>
              )
            })()}
          </DialogHeader>

          <div className="space-y-3 my-1 min-w-0 w-full max-w-full overflow-x-hidden">
            {selectedDayDate && getItemsForDay(selectedDayDate).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">Nenhum post neste dia.</p>
                <p className="text-xs text-gray-600 mt-1">Use o botão abaixo para adicionar.</p>
              </div>
            ) : (
              selectedDayDate && getItemsForDay(selectedDayDate).map(item => (
                <DayItemCard
                  key={item.id}
                  item={item}
                  onView={() => openItemView(item)}
                  onEdit={() => openEdit(item)}
                  onDelete={() => deleteItem.mutateAsync(item.id)}
                />
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="premium"
              onClick={() => {
                setDayDetailsOpen(false)
                resetForm()
                setForm(prev => ({
                  ...prev,
                  scheduled_date: selectedDayDate ? format(selectedDayDate, 'yyyy-MM-dd') : prev.scheduled_date,
                }))
                setOpen(true)
              }}
            >
              <Plus className="w-4 h-4" /> Adicionar novo post neste dia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Content Picker (Arsenal) ── */}
      {form.client_id && (
        <ContentPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          clientId={form.client_id}
          onSelect={handleAssetSelect}
        />
      )}

      {/* ── Modal: Visualização Completa do Evento ── */}
      {selectedPlannerItem && (
        <PlannerItemView
          item={selectedPlannerItem}
          open={itemViewOpen}
          onClose={closeItemView}
          onEdit={() => openEdit(selectedPlannerItem)}
        />
      )}

      {/* ── Modal: Criar / Editar Post ── */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Post' : 'Adicionar ao Planejamento'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 min-w-0 w-full max-w-full overflow-x-hidden">
            <Input label="Título *" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Post sobre tendências..." />

            <div className="grid grid-cols-1 xs:grid-cols-[1fr_140px] sm:grid-cols-[1fr_140px] gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Data *</label>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={e => set('scheduled_date', e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Hora (opcional)</label>
                <input
                  type="time"
                  value={form.scheduled_time}
                  onChange={e => set('scheduled_time', e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Tipo</label>
                <Select value={form.content_type} onValueChange={v => set('content_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(contentTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Status</label>
                <Select value={form.status} onValueChange={v => set('status', v as PlannerStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ideia">Ideia</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                    <SelectItem value="revisao">Revisão</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Cliente</label>
              <Select value={form.client_id || '__none__'} onValueChange={v => set('client_id', v === '__none__' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem cliente</SelectItem>
                  {(clients || []).map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Usar conteúdo do arsenal — só ao criar, quando cliente selecionado */}
            {!editingItem && form.client_id && (
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Arsenal do cliente</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPickerOpen(true)}
                  >
                    <ImageIcon className="w-3 h-3" />
                    {linkedAsset ? 'Trocar conteúdo' : 'Selecionar conteúdo'}
                  </Button>
                </div>
                {linkedAsset ? (
                  <div className="flex items-center gap-2.5 p-2 rounded-md bg-white/[0.04] border border-white/[0.08]">
                    {linkedAsset.media_url && /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(linkedAsset.media_url) ? (
                      <img
                        src={linkedAsset.media_url}
                        alt=""
                        className="w-10 h-10 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-4 h-4 text-zinc-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-zinc-200 truncate">{linkedAsset.title}</p>
                      <p className="text-[10px] text-zinc-600">{contentTypeLabels[linkedAsset.content_type as ContentType]}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLinkedAsset(null)}
                      className="text-zinc-500 hover:text-zinc-300 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-600">
                    Selecione um conteúdo para preencher título, legenda e mídia automaticamente.
                  </p>
                )}
              </div>
            )}

            <Textarea label="Notas" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Contexto, referências..." />

            {/* Anexos */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Anexos</label>
              {existingAttachments.length > 0 && (
                <div className="mb-2 space-y-1">
                  {existingAttachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5">
                      <FileTypeIcon type={att.file_type} />
                      <span className="truncate flex-1">{att.file_name}</span>
                      {att.file_size && <span className="text-gray-600 flex-shrink-0 text-[10px]">{formatFileSize(att.file_size)}</span>}
                      <button type="button" onClick={() => markAttachmentForDeletion(att)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 w-full h-9 px-3 rounded-md border border-dashed border-white/15 bg-white/3 text-gray-400 text-xs hover:border-white/30 hover:bg-white/5 transition-colors">
                <Paperclip className="w-3.5 h-3.5" /> Clique para anexar arquivos
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" className="hidden" onChange={handleFileSelect} />
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5">
                      <FileTypeIcon type={f.type} />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-gray-600 flex-shrink-0 text-[10px]">{formatFileSize(f.size)}</span>
                      <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Links */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Links de referência</label>
              {existingLinks.length > 0 && (
                <div className="mb-2 space-y-1">
                  {existingLinks.map(link => (
                    <div key={link.id} className="flex items-center gap-2 text-xs bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5">
                      <Link2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="truncate flex-1 text-blue-300 text-[11px]">{link.url}</span>
                      <button type="button" onClick={() => markLinkForDeletion(link)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://..."
                  value={linkInput}
                  onChange={e => setLinkInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                  className="flex-1 h-9 px-3 rounded-md border border-white/10 bg-white/5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button type="button" size="sm" variant="outline" onClick={addLink} disabled={!linkInput.trim()} className="flex-shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {pendingLinks.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pendingLinks.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5">
                      <Link2 className="w-3 h-3 text-blue-400 flex-shrink-0" />
                      <span className="truncate flex-1 text-blue-300 text-[11px]">{url}</span>
                      <button type="button" onClick={() => setPendingLinks(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancelar</Button>
            <Button variant="premium" onClick={handleSave} disabled={createItem.isPending || updateItem.isPending || isUploading || !form.title.trim()}>
              {isUploading ? (
                <><Upload className="w-4 h-4 animate-pulse" /> Enviando...</>
              ) : editingItem ? (
                <><Save className="w-4 h-4" /> Salvar alterações</>
              ) : (
                <><Save className="w-4 h-4" /> Adicionar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
