import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Users, Instagram, Trash2, ChevronDown, Palette } from 'lucide-react'
import { useClients, useDeleteClient } from '@/hooks/useClients'
import { useToast } from '@/components/ui/toast'
import { supabase } from '@/integrations/supabase/client'

// ─── Gradientes disponíveis para o banner ────────────────────────────────────

const GRADIENTS = [
  { id: 'pink-purple',   value: 'linear-gradient(135deg, #f9a8d4 0%, #c084fc 100%)',   preview: ['#f9a8d4', '#c084fc'] },
  { id: 'yellow-green',  value: 'linear-gradient(135deg, #fde68a 0%, #86efac 100%)',   preview: ['#fde68a', '#86efac'] },
  { id: 'blue-purple',   value: 'linear-gradient(135deg, #93c5fd 0%, #a78bfa 100%)',   preview: ['#93c5fd', '#a78bfa'] },
  { id: 'orange-pink',   value: 'linear-gradient(135deg, #fdba74 0%, #f9a8d4 100%)',   preview: ['#fdba74', '#f9a8d4'] },
  { id: 'cyan-indigo',   value: 'linear-gradient(135deg, #67e8f9 0%, #818cf8 100%)',   preview: ['#67e8f9', '#818cf8'] },
  { id: 'amber-orange',  value: 'linear-gradient(135deg, #fcd34d 0%, #fb923c 100%)',   preview: ['#fcd34d', '#fb923c'] },
  { id: 'teal-sky',      value: 'linear-gradient(135deg, #6ee7b7 0%, #38bdf8 100%)',   preview: ['#6ee7b7', '#38bdf8'] },
  { id: 'fuchsia-indigo',value: 'linear-gradient(135deg, #f0abfc 0%, #818cf8 100%)',   preview: ['#f0abfc', '#818cf8'] },
  { id: 'rose-amber',    value: 'linear-gradient(135deg, #fda4af 0%, #fbbf24 100%)',   preview: ['#fda4af', '#fbbf24'] },
  { id: 'lime-cyan',     value: 'linear-gradient(135deg, #bef264 0%, #67e8f9 100%)',   preview: ['#bef264', '#67e8f9'] },
  { id: 'navy-blue',     value: 'linear-gradient(135deg, #1a1a2e 0%, #3b82f6 100%)',   preview: ['#1a1a2e', '#3b82f6'] },
  { id: 'coral-sunset',  value: 'linear-gradient(135deg, #e94560 0%, #fcd34d 100%)',   preview: ['#e94560', '#fcd34d'] },
]

const DEFAULT_GRADIENT_ID = 'pink-purple'

function loadBannerGradient(clientId: string): string {
  try {
    const saved = localStorage.getItem(`banner_${clientId}`)
    const found = GRADIENTS.find(g => g.id === saved)
    return found ? found.value : GRADIENTS[0].value
  } catch { return GRADIENTS[0].value }
}

function saveBannerGradient(clientId: string, gradientId: string) {
  try { localStorage.setItem(`banner_${clientId}`, gradientId) } catch {}
}

function getDefaultGradientId(clientId: string): string {
  try {
    const saved = localStorage.getItem(`banner_${clientId}`)
    return GRADIENTS.find(g => g.id === saved) ? saved! : DEFAULT_GRADIENT_ID
  } catch { return DEFAULT_GRADIENT_ID }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  ativo:      { label: 'Ativo',      dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  pausado:    { label: 'Pausado',    dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-600 border-amber-200'   },
  encerrado:  { label: 'Encerrado', dot: 'bg-red-400',     badge: 'bg-red-50 text-red-500 border-red-200'         },
  lead:       { label: 'Lead',       dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-600 border-blue-200'      },
  proposta:   { label: 'Proposta',   dot: 'bg-violet-400',  badge: 'bg-violet-50 text-violet-600 border-violet-200'},
  fechado:    { label: 'Fechado',    dot: 'bg-teal-400',    badge: 'bg-teal-50 text-teal-600 border-teal-200'     },
  onboarding: { label: 'Onboarding',dot: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-600 border-orange-200'},
}

const SORT_OPTIONS = [
  { value: 'nome_az',  label: 'Nome (A-Z)' },
  { value: 'nome_za',  label: 'Nome (Z-A)' },
  { value: 'recente',  label: 'Mais recentes' },
  { value: 'antigo',   label: 'Mais antigos' },
]

// ─── Tipos de stats ───────────────────────────────────────────────────────────

interface ClientStats {
  pendentes:        number
  aprovados:        number
  ajuste_solicitado: number
  reprovado:        number
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ClientList() {
  const { data: clients = [], isLoading } = useClients()
  const deleteClient = useDeleteClient()
  const { toast } = useToast()
  const navigate  = useNavigate()

  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'ativo' | 'pausado' | 'encerrado'>('all')
  const [sort, setSort]         = useState('nome_az')
  const [showSort, setShowSort] = useState(false)
  const [stats, setStats]       = useState<Record<string, ClientStats>>({})

  // Gradiente por client id (salvo no localStorage)
  const [banners, setBanners]   = useState<Record<string, string>>({})
  const [pickerOpen, setPickerOpen] = useState<string | null>(null) // clientId com picker aberto

  // ── Carrega gradientes salvos quando clients chegam ───────────────────────
  useEffect(() => {
    if (!clients.length) return
    const map: Record<string, string> = {}
    clients.forEach(c => { map[c.id] = loadBannerGradient(c.id) })
    setBanners(map)
  }, [clients.map(c => c.id).join()])

  // ── Carrega stats do planner por cliente ──────────────────────────────────
  useEffect(() => {
    if (!clients.length) return
    async function fetchStats() {
      const { data } = await supabase
        .from('planner')
        .select('client_id, approval_status')
        .in('client_id', clients.map(c => c.id))

      if (!data) return
      const map: Record<string, ClientStats> = {}
      clients.forEach(c => {
        map[c.id] = { pendentes: 0, aprovados: 0, ajuste_solicitado: 0, reprovado: 0 }
      })
      data.forEach((row: any) => {
        if (!row.client_id || !map[row.client_id]) return
        const as = row.approval_status
        if (!as || as === 'pendente_aprovacao' || as === 'ajuste_realizado') {
          map[row.client_id].pendentes++
        } else if (as === 'aprovado') {
          map[row.client_id].aprovados++
        } else if (as === 'ajuste_solicitado') {
          map[row.client_id].ajuste_solicitado++
        } else if (as === 'reprovado') {
          map[row.client_id].reprovado++
        }
      })
      setStats(map)
    }
    fetchStats()
  }, [clients.map(c => c.id).join()])

  // ── Troca gradiente ───────────────────────────────────────────────────────
  function changeBanner(clientId: string, gradientId: string) {
    const found = GRADIENTS.find(g => g.id === gradientId)
    if (!found) return
    saveBannerGradient(clientId, gradientId)
    setBanners(prev => ({ ...prev, [clientId]: found.value }))
    setPickerOpen(null)
  }

  // ── Filtragem e ordenação ─────────────────────────────────────────────────
  const filtered = clients
    .filter(c => {
      const q = search.toLowerCase()
      const matchSearch =
        c.company_name.toLowerCase().includes(q) ||
        c.responsible_name.toLowerCase().includes(q) ||
        c.niche.toLowerCase().includes(q) ||
        (c.instagram || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      const matchFilter = filter === 'all' || c.status === filter
      return matchSearch && matchFilter
    })
    .sort((a, b) => {
      if (sort === 'nome_az') return a.company_name.localeCompare(b.company_name)
      if (sort === 'nome_za') return b.company_name.localeCompare(a.company_name)
      if (sort === 'recente') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'antigo')  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return 0
    })

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return
    await deleteClient.mutateAsync(id)
    toast('Cliente excluído.', 'success')
  }

  const sortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label || 'Nome (A-Z)'

  return (
    <div className="min-h-full" style={{ background: '#f5f5f7' }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0f0f0f]">Todos os clientes</h1>
            <p className="text-[13px] text-[#737373] mt-0.5">Gerencie todos os clientes e seus conteúdos</p>
          </div>
          <Link
            to="/clients/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white transition-colors"
            style={{ background: '#1a1a2e' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#252550')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1a1a2e')}
          >
            <Plus className="w-4 h-4" /> Novo Cliente
          </Link>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a0a0]" />
            <input
              type="text"
              placeholder="Buscar por nome, @handle, segmento ou email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#e8e8e8] bg-white text-[13px] text-[#0f0f0f] placeholder:text-[#b0b0b0] outline-none focus:border-[#1a1a2e] transition-colors"
            />
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setShowSort(o => !o)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#e8e8e8] bg-white text-[13px] text-[#0f0f0f] hover:border-[#c0c0c0] transition-colors"
            >
              {sortLabel} <ChevronDown className="w-3.5 h-3.5 text-[#a0a0a0]" />
            </button>
            {showSort && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white border border-[#e8e8e8] rounded-xl shadow-lg overflow-hidden py-1">
                  {SORT_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => { setSort(o.value); setShowSort(false) }}
                      className={`w-full text-left px-4 py-2 text-[13px] hover:bg-[#f5f5f5] transition-colors ${sort === o.value ? 'font-semibold text-[#1a1a2e]' : 'text-[#0f0f0f]'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Filter pills ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-4">
          {([
            { value: 'all',       label: 'Todos' },
            { value: 'ativo',     label: 'Ativos' },
            { value: 'pausado',   label: 'Pausados' },
            { value: 'encerrado', label: 'Encerrados' },
          ] as const).map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all border ${
                filter === f.value
                  ? 'bg-[#1a1a2e] text-white border-[#1a1a2e]'
                  : 'bg-white text-[#737373] border-[#e0e0e0] hover:border-[#c0c0c0] hover:text-[#0f0f0f]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="px-6 pb-10">

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-[#e8e8e8] animate-pulse">
                <div className="h-24 bg-[#f0f0f0]" />
                <div className="p-5 pt-8 space-y-3">
                  <div className="h-4 bg-[#f0f0f0] rounded w-3/4" />
                  <div className="h-3 bg-[#f0f0f0] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-[#e8e8e8] flex items-center justify-center shadow-sm">
              <Users className="w-8 h-8 text-[#d0d0d0]" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-[#0f0f0f]">
                {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              </p>
              <p className="text-[13px] text-[#a0a0a0] mt-1">
                {search ? 'Tente outra busca' : 'Cadastre seu primeiro cliente agora'}
              </p>
            </div>
            {!search && (
              <Link
                to="/clients/new"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white mt-2"
                style={{ background: '#1a1a2e' }}
              >
                <Plus className="w-4 h-4" /> Novo Cliente
              </Link>
            )}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence>
              {filtered.map(client => {
                const cfg       = STATUS_CFG[client.status] || STATUS_CFG.ativo
                const initials  = client.company_name.slice(0, 2).toUpperCase()
                const banner    = banners[client.id] || GRADIENTS[0].value
                const clientStats = stats[client.id] || { pendentes: 0, aprovados: 0, ajuste_solicitado: 0, reprovado: 0 }
                const isPickerOpen = pickerOpen === client.id
                const savedGradientId = getDefaultGradientId(client.id)

                return (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden group relative"
                  >
                    {/* ── Banner ──────────────────────────────────────────── */}
                    <div
                      className="relative h-24 flex-shrink-0"
                      style={{ background: banner }}
                    >
                      {/* Botão paleta de cores */}
                      <button
                        onClick={e => { e.stopPropagation(); setPickerOpen(isPickerOpen ? null : client.id) }}
                        className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/30 hover:bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        title="Mudar cor do banner"
                      >
                        <Palette className="w-3.5 h-3.5 text-white" />
                      </button>

                      {/* Botão deletar */}
                      <button
                        onClick={e => handleDelete(e, client.id, client.company_name)}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/30 hover:bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>

                      {/* Picker de gradiente */}
                      {isPickerOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={e => { e.stopPropagation(); setPickerOpen(null) }}
                          />
                          <div
                            className="absolute top-10 left-3 z-40 bg-white rounded-2xl shadow-xl border border-[#e8e8e8] p-3"
                            onClick={e => e.stopPropagation()}
                          >
                            <p className="text-[10px] font-semibold text-[#a0a0a0] uppercase tracking-wide mb-2">Cor do banner</p>
                            <div className="grid grid-cols-6 gap-1.5">
                              {GRADIENTS.map(g => (
                                <button
                                  key={g.id}
                                  onClick={e => { e.stopPropagation(); changeBanner(client.id, g.id) }}
                                  className="w-7 h-7 rounded-full transition-transform hover:scale-110 relative"
                                  style={{ background: `linear-gradient(135deg, ${g.preview[0]} 0%, ${g.preview[1]} 100%)` }}
                                  title={g.id}
                                >
                                  {savedGradientId === g.id && (
                                    <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-[#1a1a2e]" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Avatar */}
                      <div className="absolute -bottom-6 left-5">
                        {client.logo_url ? (
                          <img
                            src={client.logo_url}
                            alt={client.company_name}
                            className="w-14 h-14 rounded-full object-cover border-[3px] border-white shadow-md"
                          />
                        ) : (
                          <div
                            className="w-14 h-14 rounded-full border-[3px] border-white shadow-md flex items-center justify-center text-white font-bold text-lg"
                            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)' }}
                          >
                            {initials}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Body ────────────────────────────────────────────── */}
                    <div className="pt-9 px-5 pb-5">

                      {/* Nome + status */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-[14px] font-semibold text-[#0f0f0f] leading-snug flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          {client.company_name}
                        </h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Handle */}
                      {client.instagram && (
                        <p className="text-[12px] text-[#737373] flex items-center gap-1 mb-2 ml-3.5">
                          <Instagram className="w-3 h-3 text-pink-400 flex-shrink-0" />
                          @{client.instagram.replace('@', '')}
                        </p>
                      )}

                      {/* Nicho */}
                      <div className="ml-3.5 mb-4">
                        <span className="inline-block text-[11px] font-medium text-[#737373] bg-[#f5f5f5] border border-[#ebebeb] px-2.5 py-0.5 rounded-full">
                          {client.niche}
                        </span>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[#f0f0f0] mb-3" />

                      {/* Stats grid — dados reais do planner */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#a0a0a0]">Pendentes</span>
                          <span className="text-[11px] font-semibold text-amber-500">{clientStats.pendentes}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#a0a0a0]">Aprovados</span>
                          <span className="text-[11px] font-semibold text-emerald-500">{clientStats.aprovados}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#a0a0a0]">Aj. Solicitado</span>
                          <span className="text-[11px] font-semibold text-orange-500">{clientStats.ajuste_solicitado}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#a0a0a0]">Reprovado</span>
                          <span className="text-[11px] font-semibold text-red-400">{clientStats.reprovado}</span>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
