import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Edit, Sparkles, Instagram, Mail, Globe, Phone, ArrowLeft, Save, Brain,
  Plus, Trash2, ImageIcon, X, Upload, Eye, Pencil, Link2, ExternalLink,
  DollarSign, CalendarDays, CheckCircle2, AlertCircle, Clock, Ban, ChevronDown,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useClient, useBrandDNA, useUpsertBrandDNA, useUpdateClient, useRegisterPayment } from '@/hooks/useClients'
import { useContents } from '@/hooks/useContents'
import { useTasks } from '@/hooks/useTasks'
import { usePlanner } from '@/hooks/usePlanner'
import { useContentAssets, useCreateContentAsset, useUpdateContentAsset, useDeleteContentAsset } from '@/hooks/useContentAssets'
import { useAuth } from '@/hooks/useAuth'
import { OnboardingTab } from './tabs/OnboardingTab'
import { MaterialsTab } from './tabs/MaterialsTab'
import { SupportTab } from './tabs/SupportTab'
import { PlannerItemViewModal } from '@/components/PlannerItemViewModal'
import { ReportsTab } from './tabs/ReportsTab'
import { useToast } from '@/components/ui/toast'
import { formatDate, formatRelative, contentTypeLabels } from '@/utils/formatters'
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { calcFinancialStatus, financialStatusLabel, getFinancialAuxText } from '@/utils/financial'
import type { FinancialStatus } from '@/types'
import { supabase } from '@/integrations/supabase/client'
import { useState, useEffect, useRef } from 'react'
import type { ContentAsset, ContentType, PlannerItem } from '@/types'

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  onEdit,
  onDelete,
  onView,
}: {
  asset: ContentAsset
  onEdit: () => void
  onDelete: () => void
  onView: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const isImage = asset.media_url && /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(asset.media_url)

  return (
    <div className="group relative rounded-lg border border-white/[0.06] overflow-hidden bg-[#111113]">
      {/* Preview */}
      <div
        className="aspect-square overflow-hidden bg-white/[0.03] cursor-pointer"
        onClick={onView}
      >
        {isImage ? (
          <img
            src={asset.media_url!}
            alt={asset.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : asset.media_url ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
            <ImageIcon className="w-7 h-7 text-zinc-600" />
            <span className="text-[10px] text-zinc-600">
              {asset.media_url.split('.').pop()?.split('?')[0]?.toUpperCase() || 'ARQUIVO'}
            </span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-7 h-7 text-zinc-700" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2.5 pt-2 pb-1.5">
        <p className="text-[12px] font-normal text-zinc-200 truncate">{asset.title}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{contentTypeLabels[asset.content_type]}</p>
      </div>

      {/* Actions */}
      {confirming ? (
        <div className="px-2 pb-2 flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 flex-1">Excluir?</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setConfirming(false)}>
            Não
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
            onClick={() => { setConfirming(false); onDelete() }}
          >
            Sim
          </Button>
        </div>
      ) : (
        <div className="px-2 pb-2 flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-200"
            onClick={onView}
          >
            <Eye className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-zinc-500 hover:text-zinc-200"
            onClick={onEdit}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400 ml-auto"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Asset View Dialog ────────────────────────────────────────────────────────

function AssetViewDialog({
  asset,
  open,
  onClose,
  onEdit,
}: {
  asset: ContentAsset | null
  open: boolean
  onClose: () => void
  onEdit: () => void
}) {
  if (!asset) return null
  const isImage = asset.media_url && /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(asset.media_url)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-[14px] break-words">{asset.title}</DialogTitle>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {contentTypeLabels[asset.content_type]} · {formatDate(asset.created_at)}
          </p>
        </DialogHeader>
        <div className="space-y-3 mt-1 min-w-0 w-full max-w-full overflow-x-hidden">
          {asset.media_url && (
            isImage ? (
              <a href={asset.media_url} target="_blank" rel="noopener noreferrer" className="block w-full max-w-full overflow-hidden">
                <img
                  src={asset.media_url}
                  alt={asset.title}
                  className="w-full max-w-full max-h-[60vh] rounded-lg border border-white/[0.06] object-contain"
                />
              </a>
            ) : (
              <a
                href={asset.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-3 rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-zinc-500" />
                <span className="text-[12px] text-zinc-300 flex-1 truncate">Abrir arquivo</span>
              </a>
            )
          )}
          {asset.caption && (
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Legenda</p>
              <p className="text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">{asset.caption}</p>
            </div>
          )}
          {asset.observations && (
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Observações</p>
              <p className="text-[13px] text-zinc-400 leading-relaxed break-words">{asset.observations}</p>
            </div>
          )}
          {asset.link_url && (
            <a
              href={asset.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-3 rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors min-w-0 max-w-full overflow-hidden"
            >
              <Link2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-[12px] text-blue-300 flex-1 min-w-0 break-all">{asset.link_url}</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
            </a>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          <Button size="sm" onClick={onEdit}><Pencil className="w-3 h-3" /> Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Financial Status Card ────────────────────────────────────────────────────

const financialBadgeStyles: Record<FinancialStatus, { bg: string; text: string; dot: string; icon: React.ReactNode }> = {
  ativo:         { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> },
  vence_em_breve:{ bg: 'bg-amber-500/10 border-amber-500/20',    text: 'text-amber-400',   dot: 'bg-amber-400',   icon: <Clock className="w-3 h-3" /> },
  atrasado:      { bg: 'bg-red-500/10 border-red-500/20',         text: 'text-red-400',     dot: 'bg-red-400',     icon: <AlertCircle className="w-3 h-3" /> },
  cancelado:     { bg: 'bg-zinc-500/10 border-zinc-500/20',       text: 'text-zinc-400',    dot: 'bg-zinc-500',    icon: <Ban className="w-3 h-3" /> },
}

function FinancialCard({ client }: { client: import('@/types').Client }) {
  const updateClient = useUpdateClient()
  const registerPayment = useRegisterPayment()
  const { toast } = useToast()

  const [overrideOpen, setOverrideOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const computedStatus = calcFinancialStatus(client)
  const styles = financialBadgeStyles[computedStatus]
  const auxText = getFinancialAuxText(client, computedStatus)

  const hasFinancialData = client.valor_mensal != null || client.dia_vencimento != null

  const handleRegisterPayment = async () => {
    try {
      await registerPayment.mutateAsync(client.id)
      toast('Pagamento registrado com sucesso!', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const handleManualStatus = async (status: FinancialStatus) => {
    setSaving(true)
    try {
      await updateClient.mutateAsync({
        id: client.id,
        financial_status: status,
        manual_status_override: status === 'cancelado',
      })
      toast('Status financeiro atualizado.', 'success')
      setOverrideOpen(false)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!hasFinancialData) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="flex flex-col gap-3 mb-6 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
    >
      {/* Ícone + dados — ficam na mesma linha no mobile */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
          <DollarSign className="w-4 h-4 text-zinc-400" />
        </div>

        {/* Main info */}
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3 flex-1 min-w-0">
          {client.valor_mensal != null && (
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Mensalidade</p>
              <p className="text-[14px] font-semibold text-zinc-100 break-words whitespace-normal">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.valor_mensal)}
              </p>
            </div>
          )}

          {client.dia_vencimento != null && (
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Vencimento</p>
              <p className="text-[13px] font-medium text-zinc-300 flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                Dia {client.dia_vencimento}
              </p>
            </div>
          )}

          {/* Status badge */}
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Status financeiro</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${styles.bg} ${styles.text}`}>
              {styles.icon}
              {financialStatusLabel(computedStatus)}
            </span>
          </div>

          {/* Aux text */}
          {auxText && (
            <div className="min-w-0 hidden sm:block">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Info</p>
              <p className={`text-[12px] font-medium break-words whitespace-normal ${
                computedStatus === 'atrasado' ? 'text-red-400' :
                computedStatus === 'vence_em_breve' ? 'text-amber-400' : 'text-zinc-400'
              }`}>{auxText}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions — coluna no mobile, linha no desktop */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:flex-shrink-0">
        {computedStatus !== 'cancelado' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegisterPayment}
            disabled={registerPayment.isPending}
            className="text-[11px] h-7 px-3 w-full sm:w-auto justify-center"
          >
            <CheckCircle2 className="w-3 h-3" />
            {registerPayment.isPending ? 'Salvando...' : 'Registrar pagamento'}
          </Button>
        )}

        {/* Manual override dropdown */}
        <div className="relative w-full sm:w-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOverrideOpen(o => !o)}
            className="text-[11px] h-7 px-2.5 text-zinc-500 hover:text-zinc-200 w-full sm:w-auto justify-center"
          >
            <ChevronDown className="w-3 h-3" /> Alterar
          </Button>
          {overrideOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOverrideOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-white/[0.08] bg-[#111113] shadow-xl overflow-hidden">
                {(['ativo', 'vence_em_breve', 'atrasado', 'cancelado'] as FinancialStatus[]).map(s => {
                  const st = financialBadgeStyles[s]
                  return (
                    <button
                      key={s}
                      disabled={saving}
                      onClick={() => handleManualStatus(s)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors hover:bg-white/[0.05] ${st.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                      {financialStatusLabel(s)}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Planner Week View ────────────────────────────────────────────────────────

type WeekGroup = {
  key: string
  label: string
  dateRange: string
  items: PlannerItem[]
}

function groupPlannerByWeek(items: PlannerItem[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>()
  items.forEach(item => {
    const date = parseISO(item.scheduled_date)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
    const key = format(weekStart, 'yyyy-MM-dd')
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: '',
        dateRange: `${format(weekStart, 'dd MMM', { locale: ptBR })} - ${format(weekEnd, 'dd MMM', { locale: ptBR })}`,
        items: [],
      })
    }
    map.get(key)!.items.push(item)
  })
  const sorted = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
  sorted.forEach((w, i) => { w.label = `Semana ${i + 1}` })
  return sorted
}

function getPlannerBadge(item: PlannerItem): { label: string; cls: string } {
  if (item.status === 'publicado') return { label: 'Publicado', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' }
  switch (item.approval_status) {
    case 'aprovado':         return { label: 'Aprovado',    cls: 'bg-green-500/15 text-green-400 border border-green-500/20' }
    case 'reprovado':        return { label: 'Reprovado',   cls: 'bg-red-500/15 text-red-400 border border-red-500/20' }
    case 'ajuste_solicitado':return { label: 'Ajuste',      cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/20' }
    case 'ajuste_realizado': return { label: 'Ajuste Feito',cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/20' }
    default:                 return { label: 'Em Aprovação',cls: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20' }
  }
}

function getCardAccentColor(item: PlannerItem): string {
  if (item.status === 'publicado') return '#10b981'  // emerald
  switch (item.approval_status) {
    case 'aprovado':          return '#4ade80'  // green-400
    case 'reprovado':         return '#f87171'  // red-400
    case 'ajuste_solicitado': return '#fb923c'  // orange-400
    case 'ajuste_realizado':  return '#60a5fa'  // blue-400
    default:                  return '#facc15'  // yellow-400 (pendente)
  }
}

function getWeekSummaryBadge(items: PlannerItem[]): { label: string; cls: string } {
  const hasAjuste    = items.some(i => i.approval_status === 'ajuste_solicitado')
  const hasReprovado = items.some(i => i.approval_status === 'reprovado')
  const allPublished = items.length > 0 && items.every(i => i.status === 'publicado')
  const allApproved  = items.length > 0 && items.every(i => i.approval_status === 'aprovado' || i.status === 'publicado')
  if (hasReprovado)  return { label: 'Reprovado',    cls: 'bg-red-500/15 text-red-400' }
  if (hasAjuste)     return { label: 'Ajuste',       cls: 'bg-orange-500/15 text-orange-400' }
  if (allPublished)  return { label: 'Publicado',    cls: 'bg-emerald-500/15 text-emerald-400' }
  if (allApproved)   return { label: 'Aprovado',     cls: 'bg-green-500/15 text-green-400' }
  return               { label: 'Em Aprovação',  cls: 'bg-yellow-500/15 text-yellow-400' }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClientProfile() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: client, isLoading } = useClient(id!)
  const { data: dna } = useBrandDNA(id!)
  const { data: contents } = useContents(id)
  const { data: tasks } = useTasks(id)
  const { data: planner } = usePlanner(id)
  const { data: assets } = useContentAssets(id)
  const upsertDNA = useUpsertBrandDNA()
  const createAsset = useCreateContentAsset()
  const updateAsset = useUpdateContentAsset()
  const deleteAsset = useDeleteContentAsset()
  const { toast } = useToast()

  const assetFileRef = useRef<HTMLInputElement>(null)

  // ── Planner item view ────────────────────────────────────────────────────────
  const [selectedPlannerItem, setSelectedPlannerItem] = useState<PlannerItem | null>(null)
  const [plannerItemOpen, setPlannerItemOpen] = useState(false)

  // ── DNA form ────────────────────────────────────────────────────────────────
  const [dnaForm, setDnaForm] = useState({
    how_brand_speaks: '', how_brand_not_speaks: '', positioning: '',
    ideal_language: '', mental_triggers: '', communication_style: '',
  })

  useEffect(() => {
    if (dna) setDnaForm(dna as any)
  }, [dna])

  const handleSaveDNA = async () => {
    try {
      await upsertDNA.mutateAsync({ client_id: id!, ...dnaForm })
      toast('DNA da marca salvo!', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  // ── Asset modal state ───────────────────────────────────────────────────────
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<ContentAsset | null>(null)
  const [viewingAsset, setViewingAsset] = useState<ContentAsset | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [assetForm, setAssetForm] = useState({
    title: '',
    caption: '',
    content_type: 'post' as ContentType,
    observations: '',
    link_url: '',
  })
  const [assetFile, setAssetFile] = useState<File | null>(null)
  const [assetUploading, setAssetUploading] = useState(false)

  const resetAssetForm = () => {
    setAssetForm({ title: '', caption: '', content_type: 'post', observations: '', link_url: '' })
    setAssetFile(null)
    setEditingAsset(null)
  }

  const openCreateAsset = () => {
    resetAssetForm()
    setAssetModalOpen(true)
  }

  const openEditAsset = (asset: ContentAsset) => {
    setViewOpen(false)
    setEditingAsset(asset)
    setAssetForm({
      title: asset.title,
      caption: asset.caption || '',
      content_type: asset.content_type,
      observations: asset.observations || '',
      link_url: asset.link_url || '',
    })
    setAssetFile(null)
    setAssetModalOpen(true)
  }

  const openViewAsset = (asset: ContentAsset) => {
    setViewingAsset(asset)
    setViewOpen(true)
  }

  const handleSaveAsset = async () => {
    if (!assetForm.title.trim() || !user || !id) return
    setAssetUploading(true)
    try {
      let media_url: string | null = editingAsset?.media_url ?? null

      if (assetFile) {
        const ext = assetFile.name.split('.').pop() || 'bin'
        const path = `${user.id}/${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('content-assets')
          .upload(path, assetFile)
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage
          .from('content-assets')
          .getPublicUrl(path)
        media_url = publicUrl
      }

      const payload = {
        title: assetForm.title.trim(),
        caption: assetForm.caption.trim() || null,
        content_type: assetForm.content_type,
        observations: assetForm.observations.trim() || null,
        media_url,
        link_url: assetForm.link_url.trim() || null,
        category: null as string | null,
      }

      if (editingAsset) {
        await updateAsset.mutateAsync({ id: editingAsset.id, ...payload })
        toast('Conteúdo atualizado!', 'success')
      } else {
        await createAsset.mutateAsync({
          user_id: user.id,
          client_id: id,
          ...payload,
        })
        toast('Conteúdo adicionado ao arsenal!', 'success')
      }

      setAssetModalOpen(false)
      resetAssetForm()
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setAssetUploading(false)
    }
  }

  const handleDeleteAsset = async (asset: ContentAsset) => {
    try {
      await deleteAsset.mutateAsync({
        id: asset.id,
        clientId: asset.client_id,
        mediaUrl: asset.media_url,
      })
      toast('Conteúdo removido do arsenal.', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  // ── Loading / not found ─────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  )

  if (!client) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-zinc-500 text-sm">Cliente não encontrado.</p>
    </div>
  )

  return (
    <div>
      <Header
        title={client.company_name}
        subtitle={client.niche}
        action={
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/clients"><ArrowLeft className="w-3.5 h-3.5" /></Link>
            </Button>
            <Button asChild size="sm">
              <Link to={`/content?client=${id}`}><Sparkles className="w-3.5 h-3.5" /> Gerar conteúdo</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/clients/${id}/edit`}><Edit className="w-3.5 h-3.5" /> Editar</Link>
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-6">
        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 mb-6 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]"
        >
          {client.logo_url ? (
            <img
              src={client.logo_url}
              alt={client.company_name}
              className="w-14 h-14 rounded-lg object-cover border border-white/[0.08] flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-xl font-medium text-zinc-300 flex-shrink-0">
              {client.company_name[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[15px] font-medium text-zinc-100">{client.company_name}</h2>
              <Badge status={client.status} />
            </div>
            <p className="text-zinc-500 text-[12px] mt-0.5">{client.responsible_name} · {client.niche}</p>
            <div className="flex flex-wrap gap-3 mt-1.5">
              {client.instagram && <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Instagram className="w-3 h-3" /> @{client.instagram.replace('@', '')}</span>}
              {client.email && <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Mail className="w-3 h-3" /> {client.email}</span>}
              {client.whatsapp && <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Phone className="w-3 h-3" /> {client.whatsapp}</span>}
              {client.website && <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Globe className="w-3 h-3" /> {client.website}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-zinc-600">Desde</p>
            <p className="text-[12px] font-medium text-zinc-400">{formatDate(client.entry_date)}</p>
          </div>
        </motion.div>

        {/* Financial card — only renders when financial data exists */}
        <FinancialCard client={client} />

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1 overflow-x-auto max-w-full">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="dna">DNA da Marca</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="contents">Conteúdos ({(contents?.length || 0) + (assets?.length || 0)})</TabsTrigger>
            <TabsTrigger value="planner">Planejamento ({planner?.length || 0})</TabsTrigger>
            <TabsTrigger value="tasks">Tarefas ({tasks?.length || 0})</TabsTrigger>
            <TabsTrigger value="materials">Materiais</TabsTrigger>
            <TabsTrigger value="support">Suporte</TabsTrigger>
            <TabsTrigger value="results">Resultados</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Objetivo Principal', value: client.main_objective },
                { label: 'Público-alvo', value: client.target_audience },
                { label: 'Tom de Voz', value: client.tone_of_voice },
                { label: 'Estilo de Comunicação', value: client.communication_style },
                { label: 'Diferenciais', value: client.differentials },
                { label: 'Serviços Oferecidos', value: client.services_offered },
                { label: 'Palavras Proibidas', value: client.forbidden_words },
                { label: 'Observações', value: client.observations },
              ].map(({ label, value }) => value && (
                <Card key={label}>
                  <CardHeader className="pb-2"><CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wide">{label}</CardTitle></CardHeader>
                  <CardContent className="pt-0"><p className="text-[13px] text-zinc-300">{value}</p></CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* DNA */}
          <TabsContent value="dna">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-zinc-400" />
                  <CardTitle>DNA da Marca</CardTitle>
                </div>
                <Button onClick={handleSaveDNA} size="sm" disabled={upsertDNA.isPending}>
                  <Save className="w-3 h-3" /> {upsertDNA.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Textarea label="Como a marca fala" value={dnaForm.how_brand_speaks} onChange={e => setDnaForm(p => ({ ...p, how_brand_speaks: e.target.value }))} placeholder="Ex: De forma descontraída..." rows={4} />
                <Textarea label="Como NÃO deve falar" value={dnaForm.how_brand_not_speaks} onChange={e => setDnaForm(p => ({ ...p, how_brand_not_speaks: e.target.value }))} placeholder="Ex: Sem jargões técnicos..." rows={4} />
                <Textarea label="Posicionamento" value={dnaForm.positioning} onChange={e => setDnaForm(p => ({ ...p, positioning: e.target.value }))} placeholder="Ex: A academia mais personalizada..." rows={4} />
                <Textarea label="Linguagem Ideal" value={dnaForm.ideal_language} onChange={e => setDnaForm(p => ({ ...p, ideal_language: e.target.value }))} placeholder="Ex: Informal, com emoji..." rows={4} />
                <Textarea label="Gatilhos Mentais" value={dnaForm.mental_triggers} onChange={e => setDnaForm(p => ({ ...p, mental_triggers: e.target.value }))} placeholder="Ex: Urgência, prova social..." rows={4} />
                <Textarea label="Estilo de Comunicação" value={dnaForm.communication_style} onChange={e => setDnaForm(p => ({ ...p, communication_style: e.target.value }))} placeholder="Ex: Storytelling + dicas + CTA" rows={4} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onboarding */}
          <TabsContent value="onboarding">
            <OnboardingTab client={client} />
          </TabsContent>

          {/* Contents — AI + Arsenal */}
          <TabsContent value="contents">
            <div className="space-y-8">

              {/* ── Gerados com IA ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">Gerados com IA</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{contents?.length || 0} conteúdos</p>
                  </div>
                  <Button asChild size="sm">
                    <Link to={`/content?client=${id}`}><Sparkles className="w-3 h-3" /> Gerar conteúdo</Link>
                  </Button>
                </div>
                <div className="space-y-2">
                  {(contents || []).map(c => (
                    <Link key={c.id} to={`/history/${c.id}`}>
                      <Card className="hover:border-white/[0.10] transition-colors">
                        <CardContent className="p-3.5 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-normal text-zinc-200 truncate">{c.title || c.term}</p>
                            <p className="text-[11px] text-zinc-600">{formatRelative(c.created_at)}</p>
                          </div>
                          <Badge status={c.status} />
                          <span className="text-[11px] text-zinc-600">{contentTypeLabels[c.content_type]}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                  {(!contents || contents.length === 0) && (
                    <div className="text-center py-8 border border-dashed border-white/[0.06] rounded-lg">
                      <Sparkles className="w-6 h-6 text-zinc-700 mx-auto mb-1.5" />
                      <p className="text-[12px] text-zinc-600">Nenhum conteúdo gerado ainda.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* ── Arsenal Manual ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">Arsenal Manual</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{assets?.length || 0} conteúdos armazenados</p>
                  </div>
                  <Button size="sm" onClick={openCreateAsset}>
                    <Plus className="w-3 h-3" /> Adicionar conteúdo
                  </Button>
                </div>

                {(!assets || assets.length === 0) ? (
                  <div className="text-center py-10 border border-dashed border-white/[0.06] rounded-lg">
                    <ImageIcon className="w-6 h-6 text-zinc-700 mx-auto mb-1.5" />
                    <p className="text-[12px] text-zinc-600">Nenhum conteúdo no arsenal ainda.</p>
                    <p className="text-[11px] text-zinc-700 mt-0.5">Adicione imagens, vídeos e legendas prontos para usar.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {assets.map(asset => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        onView={() => openViewAsset(asset)}
                        onEdit={() => openEditAsset(asset)}
                        onDelete={() => handleDeleteAsset(asset)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Planner */}
          <TabsContent value="planner">
            {(() => {
              const weeks = groupPlannerByWeek(planner || [])
              if (weeks.length === 0) {
                return (
                  <div className="text-center py-14 border border-dashed border-white/[0.06] rounded-xl">
                    <CalendarDays className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                    <p className="text-[12px] text-zinc-600">Nenhum planejamento ainda.</p>
                  </div>
                )
              }
              return (
                <div className="overflow-x-auto pb-2">
                  <div className="flex" style={{ minWidth: `${Math.max(weeks.length * 272, 544)}px` }}>
                    {weeks.map((week, wi) => {
                      const summary = getWeekSummaryBadge(week.items)
                      const isLast = wi === weeks.length - 1
                      return (
                        <div
                          key={week.key}
                          className={`flex-shrink-0 w-[272px] px-4 ${!isLast ? 'border-r border-white/[0.07]' : ''}`}
                          style={{ paddingLeft: wi === 0 ? 0 : undefined, paddingRight: isLast ? 0 : undefined }}
                        >
                          {/* Week header */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-[13px] font-semibold text-zinc-200">{week.label}</p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">{week.dateRange}</p>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5 ${summary.cls}`}>
                              {summary.label}
                            </span>
                          </div>

                          {/* Cards column */}
                          <div className="space-y-2">
                            {week.items.map(item => {
                              const badge = getPlannerBadge(item)
                              const accent = getCardAccentColor(item)
                              const thumb = item.attachments?.find(a => a.file_type.startsWith('image/'))
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => { setSelectedPlannerItem(item); setPlannerItemOpen(true) }}
                                  className="w-full text-left rounded-xl border border-white/[0.08] bg-[#13131f] hover:bg-[#1c1c30] hover:border-white/[0.15] transition-all group overflow-hidden"
                                >
                                  {/* Colored accent bar + content wrapper */}
                                  <div className="flex">
                                    {/* Left accent bar */}
                                    <div className="w-[4px] flex-shrink-0 rounded-l-xl" style={{ backgroundColor: accent }} />

                                    {/* Card content */}
                                    <div className="flex-1 min-w-0 p-3">
                                      {/* Thumb (se houver) */}
                                      {thumb && (
                                        <img
                                          src={thumb.file_url}
                                          alt=""
                                          className="w-full h-28 object-cover rounded-lg mb-2.5 border border-white/[0.06]"
                                        />
                                      )}

                                      {/* Date */}
                                      <p className="text-[10px] text-zinc-500 mb-1 font-medium tracking-wide">
                                        {format(parseISO(item.scheduled_date), "dd MMM", { locale: ptBR }).replace('.', '')} · 18:00
                                      </p>

                                      {/* Title */}
                                      <p className="text-[12px] font-semibold text-zinc-100 leading-snug mb-2.5 line-clamp-2">
                                        {item.title}
                                      </p>

                                      {/* Bottom row: platform + type + status */}
                                      <div className="flex items-center gap-1.5">
                                        {/* Instagram icon */}
                                        <div
                                          className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0"
                                          style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}
                                        >
                                          <Instagram className="w-2.5 h-2.5 text-white" />
                                        </div>

                                        {/* Content type */}
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-zinc-400 font-medium">
                                          {contentTypeLabels[item.content_type] || item.content_type}
                                        </span>

                                        {/* Status badge — pushed right */}
                                        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${badge.cls}`}>
                                          {badge.label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {selectedPlannerItem && (
              <PlannerItemViewModal
                item={selectedPlannerItem}
                open={plannerItemOpen}
                onClose={() => { setPlannerItemOpen(false); setSelectedPlannerItem(null) }}
                showAgencyActions
              />
            )}
          </TabsContent>

          {/* Materials */}
          <TabsContent value="materials">
            <MaterialsTab clientId={id!} />
          </TabsContent>

          {/* Support */}
          <TabsContent value="support">
            <SupportTab clientId={id!} />
          </TabsContent>

          {/* Results */}
          <TabsContent value="results">
            <ReportsTab clientId={id!} />
          </TabsContent>

          {/* Tasks */}
          <TabsContent value="tasks">
            <div className="space-y-2">
              {(tasks || []).map(t => (
                <Card key={t.id}>
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-normal text-zinc-200 truncate">{t.title}</p>
                      {t.description && <p className="text-[11px] text-zinc-600 truncate">{t.description}</p>}
                    </div>
                    <Badge status={t.priority} />
                    <Badge status={t.status} />
                  </CardContent>
                </Card>
              ))}
              {(!tasks || tasks.length === 0) && (
                <div className="text-center py-10 text-[12px] text-zinc-600">
                  Nenhuma tarefa ainda.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Asset View Dialog ── */}
      <AssetViewDialog
        asset={viewingAsset}
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewingAsset(null) }}
        onEdit={() => viewingAsset && openEditAsset(viewingAsset)}
      />

      {/* ── Asset Create / Edit Modal ── */}
      <Dialog open={assetModalOpen} onOpenChange={v => { setAssetModalOpen(v); if (!v) resetAssetForm() }}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Editar conteúdo' : 'Adicionar ao Arsenal'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-1 min-w-0 w-full max-w-full overflow-x-hidden">
            <Input
              label="Título *"
              value={assetForm.title}
              onChange={e => setAssetForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Post de lançamento do produto..."
            />

            <div>
              <label className="block text-[12px] font-normal text-zinc-500 mb-1.5">Tipo</label>
              <Select
                value={assetForm.content_type}
                onValueChange={v => setAssetForm(p => ({ ...p, content_type: v as ContentType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(contentTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Textarea
              label="Legenda"
              value={assetForm.caption}
              onChange={e => setAssetForm(p => ({ ...p, caption: e.target.value }))}
              placeholder="Texto pronto para publicar..."
              rows={4}
            />

            {/* Mídia */}
            <div>
              <label className="block text-[12px] font-normal text-zinc-500 mb-1.5">Mídia</label>

              {/* Preview da mídia existente (edição) */}
              {editingAsset?.media_url && !assetFile && (() => {
                const isImg = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(editingAsset.media_url!)
                return (
                  <div className="mb-2 relative">
                    {isImg ? (
                      <img
                        src={editingAsset.media_url!}
                        alt=""
                        className="w-full max-h-32 object-cover rounded-md border border-white/[0.06]"
                      />
                    ) : (
                      <div className="flex items-center gap-2 p-2.5 rounded-md border border-white/[0.06] bg-white/[0.03]">
                        <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-[12px] text-zinc-400 truncate flex-1">Arquivo atual</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-zinc-300 hover:text-white"
                      onClick={() => setEditingAsset(prev => prev ? { ...prev, media_url: null } : prev)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })()}

              {/* Arquivo selecionado novo */}
              {assetFile ? (
                <div className="flex items-center gap-2 p-2.5 rounded-md border border-white/[0.08] bg-white/[0.03]">
                  <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[12px] text-zinc-300 truncate flex-1">{assetFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setAssetFile(null)}
                    className="text-zinc-500 hover:text-red-400 flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => assetFileRef.current?.click()}
                  className="flex items-center gap-2 w-full h-9 px-3 rounded-md border border-dashed border-white/[0.12] bg-white/[0.02] text-zinc-500 text-[12px] hover:border-white/[0.22] hover:bg-white/[0.04] transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Clique para selecionar imagem ou vídeo
                </button>
              )}
              <input
                ref={assetFileRef}
                type="file"
                accept="image/*,video/*,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) setAssetFile(f)
                  e.target.value = ''
                }}
              />
            </div>

            <Textarea
              label="Observações (opcional)"
              value={assetForm.observations}
              onChange={e => setAssetForm(p => ({ ...p, observations: e.target.value }))}
              placeholder="Notas internas, contexto..."
              rows={2}
            />

            <Input
              label="Link externo (opcional)"
              value={assetForm.link_url}
              onChange={e => setAssetForm(p => ({ ...p, link_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAssetModalOpen(false); resetAssetForm() }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAsset}
              disabled={assetUploading || !assetForm.title.trim()}
            >
              {assetUploading ? (
                <><Upload className="w-3 h-3 animate-pulse" /> Enviando...</>
              ) : editingAsset ? (
                <><Save className="w-3 h-3" /> Salvar</>
              ) : (
                <><Plus className="w-3 h-3" /> Adicionar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
