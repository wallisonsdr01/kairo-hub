import { useState } from 'react'
import {
  TrendingUp, Users, Eye, Heart, BarChart3,
  DollarSign, BookOpen, FileText, Link2, File, ExternalLink, ImageIcon,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePortalReports } from '@/hooks/usePortal'
import type { ClientReport, ReportAttachment } from '@/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function monthLabel(month: number, year: number) {
  return `${MONTHS[month - 1]} ${year}`
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtBRL(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(n)
}

function followerDiff(r: ClientReport): string {
  if (r.followers_start == null || r.followers_end == null) return fmt(r.followers_end)
  const diff = r.followers_end - r.followers_start
  return diff >= 0 ? `+${fmt(diff)}` : fmt(diff)
}

function hasPaid(r: ClientReport) {
  return r.paid_investment != null || r.paid_leads != null || r.paid_cpl != null
    || r.paid_conversions != null || r.paid_roas != null
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2.5 ${accent}`}>
      <div className="opacity-60">{icon}</div>
      <div>
        <p className="text-[11px] text-[#737373]">{label}</p>
        <p className="text-[20px] font-bold text-[#0f0f0f] leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Attachment item (read-only) ──────────────────────────────────────────────

function AttachmentItem({ att }: { att: ReportAttachment }) {
  const [imgOpen, setImgOpen] = useState(false)
  const isImg = att.type === 'imagem'

  return (
    <>
      <div
        onClick={() => isImg && setImgOpen(true)}
        className={`group flex items-center gap-3 p-3 rounded-xl border border-[#e8e8e8] bg-white transition-all ${isImg ? 'cursor-pointer hover:bg-[#f5f5f5] hover:border-[#d0d0d0]' : ''}`}
      >
        <div className="w-10 h-10 rounded-lg bg-[#f0f0f0] border border-[#e8e8e8] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {isImg && att.file_url
            ? <img src={att.file_url} alt={att.title} className="w-full h-full object-cover" />
            : att.type === 'pdf' ? <FileText className="w-4 h-4 text-red-400" />
            : att.type === 'link' ? <Link2 className="w-4 h-4 text-sky-400" />
            : <File className="w-4 h-4 text-gray-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-[#0f0f0f] truncate">{att.title}</p>
          {att.description && <p className="text-[10px] text-gray-500 truncate mt-0.5">{att.description}</p>}
          <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wide">
            {att.type === 'imagem' ? 'Imagem' : att.type === 'pdf' ? 'PDF' : 'Link'}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {att.type === 'link' && att.link_url && (
            <a href={att.link_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-[#0f0f0f] hover:bg-[#f0f0f0] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {att.file_url && att.type !== 'link' && (
            <a href={att.file_url} download target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-[#0f0f0f] hover:bg-[#f0f0f0] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {isImg && imgOpen && att.file_url && (
        <Dialog open={imgOpen} onOpenChange={setImgOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="truncate">{att.title}</DialogTitle></DialogHeader>
            <img src={att.file_url} alt={att.title} className="w-full rounded-xl" />
            <DialogFooter>
              <a href={att.file_url} download target="_blank" rel="noopener noreferrer">
                <Button size="sm"><ExternalLink className="w-3.5 h-3.5" /> Baixar</Button>
              </a>
              <Button variant="outline" size="sm" onClick={() => setImgOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// ─── Report view (client read-only) ──────────────────────────────────────────

function ReportView({ report }: { report: ClientReport }) {
  const atts = report.attachments ?? []

  return (
    <div className="space-y-6">

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={<Users className="w-4 h-4 text-green-400" />}
          label="Crescimento de seguidores" value={followerDiff(report)}
          sub={report.followers_end != null ? `${fmt(report.followers_end)} total` : undefined}
          accent="border-green-500/20 bg-green-500/[0.05]" />
        <MetricCard icon={<Eye className="w-4 h-4 text-blue-400" />}
          label="Alcance" value={fmt(report.reach)}
          accent="border-blue-500/20 bg-blue-500/[0.05]" />
        <MetricCard icon={<Heart className="w-4 h-4 text-pink-400" />}
          label="Engajamento" value={report.engagement != null ? `${report.engagement}%` : '—'}
          accent="border-pink-500/20 bg-pink-500/[0.05]" />
        <MetricCard icon={<BarChart3 className="w-4 h-4 text-purple-400" />}
          label="Publicados" value={report.posts_published != null ? String(report.posts_published) : '—'}
          sub="conteúdos no mês" accent="border-purple-500/20 bg-purple-500/[0.05]" />
      </div>

      {/* Social metrics */}
      <section className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8e8e8] flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-[13px] font-semibold text-[#0f0f0f]">Redes sociais</p>
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
          {([
            ['Seguidores (início)', fmt(report.followers_start)],
            ['Seguidores (fim)', fmt(report.followers_end)],
            ['Alcance', fmt(report.reach)],
            ['Engajamento', report.engagement != null ? `${report.engagement}%` : '—'],
            ['Impressões', fmt(report.impressions)],
            ['Posts publicados', fmt(report.posts_published)],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-[15px] font-semibold text-[#0f0f0f]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Paid traffic — only if has data */}
      {hasPaid(report) && (
        <section className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e8e8e8] flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-[13px] font-semibold text-[#0f0f0f]">Tráfego pago</p>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
            {([
              ['Investimento', fmtBRL(report.paid_investment)],
              ['Leads', fmt(report.paid_leads)],
              ['CPL', fmtBRL(report.paid_cpl)],
              ['Conversões', fmt(report.paid_conversions)],
              ['ROAS', report.paid_roas != null ? `${report.paid_roas}x` : '—'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-[15px] font-semibold text-[#0f0f0f]">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Analysis */}
      {report.analysis_text && (
        <section className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] overflow-hidden">
          <div className="px-5 py-4 border-b border-indigo-500/[0.12] flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <p className="text-[13px] font-semibold text-[#0f0f0f]">Análise do mês</p>
          </div>
          <div className="p-5">
            <p className="text-[13px] text-[#737373] leading-relaxed whitespace-pre-wrap">{report.analysis_text}</p>
          </div>
        </section>
      )}

      {/* Attachments */}
      {atts.length > 0 && (
        <section className="rounded-2xl border border-[#e8e8e8] bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#e8e8e8]">
            <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-[13px] font-semibold text-[#0f0f0f]">Anexos</p>
            <span className="text-[11px] text-gray-600">{atts.length}</span>
          </div>
          <div className="p-5 space-y-2">
            {atts.map(att => <AttachmentItem key={att.id} att={att} />)}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Main Portal Tab ──────────────────────────────────────────────────────────

export function PortalResultadosTab() {
  const { data: reports = [], isLoading } = usePortalReports()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const typedReports = reports as ClientReport[]

  // Auto-select latest
  const selected = selectedId
    ? typedReports.find(r => r.id === selectedId) ?? typedReports[0] ?? null
    : typedReports[0] ?? null

  if (isLoading) {
    return <div className="py-12 text-center text-[12px] text-gray-600">Carregando resultados...</div>
  }

  if (typedReports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-xl border border-[#e8e8e8] bg-[#f0f0f0] flex items-center justify-center mb-4">
          <BarChart3 className="w-5 h-5 text-gray-600" />
        </div>
        <p className="text-[14px] font-medium text-[#737373]">Nenhum relatório disponível</p>
        <p className="text-[12px] text-gray-600 mt-1 max-w-xs">
          Quando a agência publicar os resultados do mês, eles aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Month selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {typedReports.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all ${
              r.id === (selected?.id)
                ? 'bg-[#1a1a2e] text-white border border-[#1a1a2e]'
                : 'text-[#737373] hover:text-[#0f0f0f] hover:bg-[#f0f0f0] border border-transparent'
            }`}
          >
            {monthLabel(r.month, r.year)}
          </button>
        ))}
      </div>

      {selected && (
        <>
          <div className="mb-2">
            <h3 className="text-[15px] font-semibold text-[#0f0f0f]">{monthLabel(selected.month, selected.year)}</h3>
            <p className="text-[11px] text-gray-600 mt-0.5">Relatório de performance</p>
          </div>
          <ReportView key={selected.id} report={selected} />
        </>
      )}
    </div>
  )
}
