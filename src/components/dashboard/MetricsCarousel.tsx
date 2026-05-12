import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { contentTypeLabels } from '@/utils/formatters'
import type { ContentType } from '@/types'

// ─── Label / colour maps ──────────────────────────────────────────────────────

const typePalette = [
  '#1a1a2e', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#10b981', '#ef4444', '#ec4899', '#14b8a6',
]

const tooltipStyle = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e8e8e8',
    borderRadius: 8,
    color: '#0f0f0f',
    fontSize: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
}

// ─── Mini stat pill ───────────────────────────────────────────────────────────

function StatPill({
  label, value, color,
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 min-w-0">
      <p className="text-[10px] text-gray-400 truncate">{label}</p>
      <p
        className="text-[17px] font-semibold tabular-nums leading-tight"
        style={{ color: color ?? '#1a1a2e' }}
      >
        {value}
      </p>
    </div>
  )
}

// ─── View 1 — Planejamento ────────────────────────────────────────────────────

function PlannerBarChart({
  data,
}: {
  data: { label: string; value: number; color: string }[]
}) {
  // Filtra apenas status com valor > 0 para evitar barras invisíveis e espaço vazio
  const activeData = data.filter(d => d.value > 0)
  const hasData    = activeData.length > 0
  const total      = data.reduce((s, d) => s + d.value, 0)

  // Categoria com mais itens
  const top = activeData.reduce<{ label: string; value: number; color: string } | null>(
    (best, d) => (best === null || d.value > best.value ? d : best),
    null,
  )

  // Contagem de revisão e produção
  const emRevisao  = data.find(d => d.label === 'Revisão')?.value  ?? 0
  const emProducao = data.find(d => d.label === 'Produção')?.value ?? 0

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-2" style={{ height: 196 }}>
        <p className="text-[12px] text-[#b0b0b0] text-center">
          Nenhum item no planejamento ainda.
          <br />
          <span className="text-[11px]">Crie posts em Planejamento.</span>
        </p>
      </div>
    )
  }

  const chartData = activeData.map(d => ({ name: d.label, value: d.value, fill: d.color }))
  // Barra mais larga quando há menos categorias ativas
  const barSize = activeData.length <= 3 ? 36 : activeData.length <= 4 ? 28 : 22

  return (
    <div className="space-y-3">
      {/* Gráfico compacto */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} barSize={barSize} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#a0a0a0', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#a0a0a0', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={20}
          />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          />
          <Bar dataKey="value" radius={[5, 5, 0, 0]} name="Itens">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Mini stat pills */}
      <div className="flex gap-2">
        <StatPill label="Total" value={total} />
        {top && (
          <StatPill label="Maior" value={top.label} color={top.color} />
        )}
        <StatPill label="Produção" value={emProducao} color="#3b82f6" />
        <StatPill label="Revisão"  value={emRevisao}  color="#f59e0b" />
      </div>
    </div>
  )
}

// ─── View 2 — Generated contents (bar by day) ────────────────────────────────

function GeneratedChart({
  data, summary,
}: {
  data: { day: string; conteudos: number }[]
  summary: string
}) {
  const total = data.reduce((s, d) => s + d.conteudos, 0)
  const topDay = data.reduce<{ day: string; conteudos: number } | null>(
    (best, d) => (best === null || d.conteudos > best.conteudos ? d : best),
    null,
  )

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barSize={28} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: '#a0a0a0', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#a0a0a0', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={20}
          />
          <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Bar dataKey="conteudos" fill="#1a1a2e" radius={[4, 4, 0, 0]} name="Gerados" />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex gap-2">
        <StatPill label="Total" value={total} />
        <StatPill label="Pico"  value={topDay ? `${topDay.conteudos} (${topDay.day})` : '—'} />
        {summary && (
          <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex items-center">
            <p className="text-[10px] text-gray-400 leading-snug">{summary}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── View 3 — Arsenal assets (donut by content type) ─────────────────────────

function AssetsDonut({
  data, summary,
}: {
  data: { type: string; count: number }[]
  summary: string
}) {
  const chartData = data.map(d => ({
    name: contentTypeLabels[d.type as ContentType] ?? d.type,
    value: d.count,
  }))
  const total = data.reduce((s, d) => s + d.count, 0)

  if (!chartData.some(d => d.value > 0)) {
    return (
      <div className="flex items-center justify-center" style={{ height: 196 }}>
        <p className="text-[12px] text-[#b0b0b0] text-center">
          Nenhum conteúdo no arsenal ainda.
          <br />
          <span className="text-[11px]">Adicione conteúdos pela Biblioteca.</span>
        </p>
      </div>
    )
  }

  const top = data.reduce<{ type: string; count: number } | null>(
    (best, d) => (best === null || d.count > best.count ? d : best),
    null,
  )

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={62}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={typePalette[i % typePalette.length]} />
            ))}
          </Pie>
          <Legend
            iconType="circle"
            iconSize={6}
            formatter={value => (
              <span style={{ fontSize: 10, color: '#737373' }}>{value}</span>
            )}
          />
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex gap-2">
        <StatPill label="Total" value={total} />
        {top && (
          <StatPill
            label="Mais frequente"
            value={contentTypeLabels[top.type as ContentType] ?? top.type}
            color="#1a1a2e"
          />
        )}
        {summary && (
          <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex items-center">
            <p className="text-[10px] text-gray-400 leading-snug">{summary}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Slide transition variants ────────────────────────────────────────────────

const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ?  48 : -48, opacity: 0 }),
  center: {
    x: 0, opacity: 1,
    transition: { duration: 0.22, ease: 'easeOut' as const },
  },
  exit:   (dir: number) => ({
    x: dir > 0 ? -48 : 48, opacity: 0,
    transition: { duration: 0.14, ease: 'easeIn' as const },
  }),
}

const headerVariants = {
  enter:  { opacity: 0, y: -5 },
  center: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  exit:   { opacity: 0, y:  5, transition: { duration: 0.12 } },
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MetricsCarouselProps {
  weeklyData:        { day: string; conteudos: number }[]
  assetTypes:        { type: string; count: number }[]
  plannerStatuses:   { status: string; count: number }[]
  plannerChartData?: { label: string; value: number; color: string }[]
  contentsThisWeek:  number
  totalAssets:       number
  totalPlanner:      number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MetricsCarousel({
  weeklyData,
  assetTypes,
  plannerStatuses,
  plannerChartData = [],
  contentsThisWeek,
  totalAssets,
  totalPlanner,
}: MetricsCarouselProps) {
  const [[activeIdx, dir], setSlide] = useState<[number, number]>([0, 0])

  const navigate = (d: 1 | -1) =>
    setSlide(([curr]) => [(curr + d + 3) % 3, d])

  const goTo = (i: number) =>
    setSlide(([curr]) => [i, i > curr ? 1 : -1])

  const slides = useMemo(() => [
    // ── Slide 1: Planejamento ──
    {
      title:    'Planejamento',
      subtitle: 'Status geral dos conteúdos',
      content: <PlannerBarChart data={plannerChartData} />,
    },
    // ── Slide 2: Conteúdos gerados ──
    {
      title:    'Conteúdos gerados',
      subtitle: 'Período selecionado por dia',
      content: (
        <GeneratedChart
          data={weeklyData}
          summary={
            contentsThisWeek > 0
              ? `${contentsThisWeek} gerado${contentsThisWeek !== 1 ? 's' : ''} no período`
              : 'Nenhum conteúdo gerado no período'
          }
        />
      ),
    },
    // ── Slide 3: Arsenal ──
    {
      title:    'Arsenal de conteúdos',
      subtitle: 'Distribuição por tipo',
      content: (
        <AssetsDonut
          data={assetTypes}
          summary={
            totalAssets > 0
              ? `${totalAssets} conteúdo${totalAssets !== 1 ? 's' : ''} no arsenal`
              : ''
          }
        />
      ),
    },
  ], [weeklyData, assetTypes, plannerChartData, contentsThisWeek, totalAssets, totalPlanner])

  const slide = slides[activeIdx]

  return (
    // Sem h-full: altura determinada pelo conteúdo, não pela coluna vizinha
    <Card className="lg:col-span-2 rounded-3xl border-gray-100 shadow-sm">
      {/* ── Header com setas ───────────────────────────────────────────────── */}
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-shrink-0 w-7 h-7 rounded-lg border border-[#e8e8e8] bg-white flex items-center justify-center text-[#a0a0a0] hover:border-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white transition-all"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 text-center min-w-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIdx}
                variants={headerVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <p className="text-[13px] font-semibold text-[#0f0f0f] leading-snug">
                  {slide.title}
                </p>
                {slide.subtitle && (
                  <p className="text-[10px] text-[#a0a0a0] mt-0.5">{slide.subtitle}</p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            onClick={() => navigate(1)}
            className="flex-shrink-0 w-7 h-7 rounded-lg border border-[#e8e8e8] bg-white flex items-center justify-center text-[#a0a0a0] hover:border-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white transition-all"
            aria-label="Próximo"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dots do carrossel */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-200 ${
                i === activeIdx
                  ? 'w-4 h-1.5 bg-[#1a1a2e]'
                  : 'w-1.5 h-1.5 bg-[#e0e0e0] hover:bg-[#b8b8b8]'
              }`}
              aria-label={`Ir para slide ${i + 1}`}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="overflow-hidden pt-0 pb-4 px-5">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={activeIdx}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {slide.content}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
