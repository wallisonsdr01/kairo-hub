import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Users, Instagram, Trash2, ChevronDown } from 'lucide-react'
import { useClients, useDeleteClient } from '@/hooks/useClients'
import { useToast } from '@/components/ui/toast'

// ─── Gradientes por índice (cíclico) ─────────────────────────────────────────

const BANNER_GRADIENTS = [
  'linear-gradient(135deg, #f9a8d4 0%, #c084fc 100%)',
  'linear-gradient(135deg, #fde68a 0%, #86efac 100%)',
  'linear-gradient(135deg, #93c5fd 0%, #a78bfa 100%)',
  'linear-gradient(135deg, #fdba74 0%, #f9a8d4 100%)',
  'linear-gradient(135deg, #67e8f9 0%, #818cf8 100%)',
  'linear-gradient(135deg, #fcd34d 0%, #fb923c 100%)',
  'linear-gradient(135deg, #6ee7b7 0%, #38bdf8 100%)',
  'linear-gradient(135deg, #f0abfc 0%, #818cf8 100%)',
]

function getBanner(index: number) {
  return BANNER_GRADIENTS[index % BANNER_GRADIENTS.length]
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
  { value: 'nome_az',   label: 'Nome (A-Z)' },
  { value: 'nome_za',   label: 'Nome (Z-A)' },
  { value: 'recente',   label: 'Mais recentes' },
  { value: 'antigo',    label: 'Mais antigos' },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export function ClientList() {
  const { data: clients = [], isLoading } = useClients()
  const deleteClient = useDeleteClient()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'ativo' | 'pausado' | 'encerrado'>('all')
  const [sort, setSort]       = useState('nome_az')
  const [showSort, setShowSort] = useState(false)

  const filtered = (clients)
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
      if (sort === 'nome_az')  return a.company_name.localeCompare(b.company_name)
      if (sort === 'nome_za')  return b.company_name.localeCompare(a.company_name)
      if (sort === 'recente')  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'antigo')   return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
          {/* Search */}
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

          {/* Sort dropdown */}
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

        {/* Loading */}
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

        {/* Empty */}
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

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence>
              {filtered.map((client, i) => {
                const cfg = STATUS_CFG[client.status] || STATUS_CFG.ativo
                const initials = client.company_name.slice(0, 2).toUpperCase()

                return (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden group"
                  >
                    {/* Banner */}
                    <div
                      className="relative h-24 flex-shrink-0"
                      style={{ background: getBanner(i) }}
                    >
                      {/* Delete button */}
                      <button
                        onClick={e => handleDelete(e, client.id, client.company_name)}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/30 hover:bg-white/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#0f0f0f]" />
                      </button>

                      {/* Avatar overlapping banner */}
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

                    {/* Body */}
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

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#a0a0a0]">Rascunho</span>
                          <span className="text-[11px] font-semibold text-[#737373]">0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#a0a0a0]">Ajuste</span>
                          <span className="text-[11px] font-semibold text-orange-500">0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#a0a0a0]">Aprovação</span>
                          <span className="text-[11px] font-semibold text-amber-500">0</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#a0a0a0]">Aprovados</span>
                          <span className="text-[11px] font-semibold text-emerald-500">0</span>
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
