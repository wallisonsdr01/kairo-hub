import { useState, useRef, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Pencil, Check, X, ChevronDown, Upload,
  Images, GripVertical, Instagram, Copy, Link2,
  Save, ArrowLeft, LayoutGrid,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useClients } from '@/hooks/useClients'
import { useContentAssets } from '@/hooks/useContentAssets'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import { supabase } from '@/integrations/supabase/client'
import type { ContentAsset, Client } from '@/types'

// ─── arrayMove (local) ────────────────────────────────────────────────────────

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedPost {
  id: string
  image_url: string
  caption?: string
  asset_id?: string
}

interface FeedVersion {
  id: string
  client_id: string
  name: string
  posts: FeedPost[]
  created_at: string
  updated_at: string
}

interface FeedClientMeta {
  bio: string
  link: string
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'kairohub_feed_v1'
const META_KEY    = 'kairohub_feed_meta_v1'

function loadAll(): Record<string, FeedVersion[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function saveAll(data: Record<string, FeedVersion[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
function loadVersions(userId: string, clientId: string): FeedVersion[] {
  return loadAll()[`${userId}__${clientId}`] || []
}
function persistVersions(userId: string, clientId: string, versions: FeedVersion[]) {
  const all = loadAll()
  all[`${userId}__${clientId}`] = versions
  saveAll(all)
}
function loadMeta(userId: string, clientId: string): FeedClientMeta {
  try {
    const all = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    return all[`${userId}__${clientId}`] || { bio: '', link: '' }
  } catch { return { bio: '', link: '' } }
}
function persistMeta(userId: string, clientId: string, meta: FeedClientMeta) {
  try {
    const all = JSON.parse(localStorage.getItem(META_KEY) || '{}')
    all[`${userId}__${clientId}`] = meta
    localStorage.setItem(META_KEY, JSON.stringify(all))
  } catch {}
}

// ─── Mini Feed Preview (gallery card) ────────────────────────────────────────

function MiniFeedPreview({ posts }: { posts: FeedPost[] }) {
  const cells = Array.from({ length: 9 }, (_, i) => posts[i] ?? null)

  return (
    <div className="grid grid-cols-3 gap-[1.5px] bg-[#e8e8e8] rounded-lg overflow-hidden">
      {cells.map((post, i) => (
        <div key={i} className="aspect-square bg-[#f5f5f5]">
          {post ? (
            <img src={post.image_url} alt="" className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full bg-[#f0f0f0]" />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Gallery card (one per client with feed) ──────────────────────────────────

function FeedGalleryCard({
  client, versions, onEdit,
}: {
  client: Client
  versions: FeedVersion[]
  onEdit: () => void
}) {
  const activeVersion = versions[0] ?? null
  const posts = activeVersion?.posts ?? []
  const initial = client.company_name.charAt(0).toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden hover:shadow-md hover:border-[#d0d0d0] transition-all duration-200"
    >
      {/* Client header */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <div className="w-8 h-8 rounded-full p-[1.5px] flex-shrink-0"
          style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
          <div className="w-full h-full rounded-full bg-white p-[1.5px]">
            {client.logo_url ? (
              <img src={client.logo_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-[#f0f0f0] flex items-center justify-center">
                <span className="text-[11px] font-bold text-[#737373]">{initial}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#0f0f0f] truncate">{client.company_name}</p>
          <p className="text-[10px] text-[#a0a0a0] truncate">
            {versions.length} {versions.length === 1 ? 'versão' : 'versões'} · {posts.length} posts
          </p>
        </div>
      </div>

      {/* Mini grid preview */}
      <div className="px-3 pb-2">
        <MiniFeedPreview posts={posts} />
      </div>

      {/* Version chips */}
      <div className="px-3 pb-2 flex gap-1 flex-wrap">
        {versions.slice(0, 3).map((v, i) => (
          <span key={v.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            i === 0 ? '' : 'text-[#737373] bg-[#f0f0f0]'
          }`} style={i === 0 ? { background: '#1a1a2e', color: '#ffffff' } : undefined}>
            {v.name}
          </span>
        ))}
        {versions.length > 3 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full text-[#a0a0a0] bg-[#f0f0f0]">
            +{versions.length - 3}
          </span>
        )}
      </div>

      {/* Edit button */}
      <div className="border-t border-[#f5f5f5] px-3 py-2">
        <button
          onClick={onEdit}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
          style={{ background: '#1a1a2e', color: '#ffffff' }}
        >
          <Pencil className="w-3 h-3" /> Editar feed
        </button>
      </div>
    </motion.div>
  )
}

// ─── Instagram Profile Header ─────────────────────────────────────────────────

function InstagramHeader({
  client, postsCount, meta, onMetaChange,
}: {
  client: Client
  postsCount: number
  meta: FeedClientMeta
  onMetaChange: (m: FeedClientMeta) => void
}) {
  const [editingBio, setEditingBio] = useState(false)
  const [bioValue,   setBioValue]   = useState(meta.bio)
  const [linkValue,  setLinkValue]  = useState(meta.link)
  const initial = client.company_name.charAt(0).toUpperCase()

  const saveBio = () => {
    onMetaChange({ bio: bioValue.trim(), link: linkValue.trim() })
    setEditingBio(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm px-6 py-5">
      <div className="flex items-start gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-20 h-20 rounded-full p-[2px]"
            style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
            <div className="w-full h-full rounded-full bg-white p-[2px]">
              {client.logo_url ? (
                <img src={client.logo_url} alt={client.company_name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-[#f0f0f0] flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#737373]">{initial}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[15px] font-semibold text-[#0f0f0f] leading-none">
              {client.instagram
                ? client.instagram.replace(/^@/, '')
                : client.company_name.toLowerCase().replace(/\s+/g, '_')}
            </h2>
            {!editingBio && (
              <button
                onClick={() => { setEditingBio(true); setBioValue(meta.bio); setLinkValue(meta.link) }}
                className="flex items-center gap-1 text-[11px] text-[#737373] hover:text-[#0f0f0f] transition-colors"
              >
                <Pencil className="w-3 h-3" /> Editar bio
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6">
            {[
              { label: 'posts',     value: postsCount },
              { label: 'seguidores', value: '—' },
              { label: 'seguindo',  value: '—' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[13px] font-semibold text-[#0f0f0f]">{s.value}</p>
                <p className="text-[11px] text-[#737373]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bio */}
          {editingBio ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={bioValue}
                onChange={e => setBioValue(e.target.value)}
                placeholder="Escreva a bio do cliente..."
                rows={3}
                className="w-full text-sm text-[#0f0f0f] border border-[#e8e8e8] rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e] placeholder:text-[#c0c0c0]"
              />
              <input
                value={linkValue}
                onChange={e => setLinkValue(e.target.value)}
                placeholder="Link (ex: linktr.ee/cliente)"
                className="w-full text-sm text-[#0f0f0f] border border-[#e8e8e8] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e] placeholder:text-[#c0c0c0]"
              />
              <div className="flex items-center gap-2">
                <button onClick={saveBio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
                  style={{ background: '#1a1a2e', color: '#ffffff' }}>
                  <Check className="w-3.5 h-3.5" /> Salvar
                </button>
                <button onClick={() => setEditingBio(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#737373] border border-[#e8e8e8] hover:bg-[#f5f5f5] transition-colors">
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {meta.bio ? (
                <p className="text-sm text-[#0f0f0f] leading-relaxed whitespace-pre-wrap">{meta.bio}</p>
              ) : (
                <p className="text-sm text-[#c0c0c0] cursor-pointer hover:text-[#a0a0a0] transition-colors"
                  onClick={() => setEditingBio(true)}>
                  Clique em "Editar bio" para adicionar uma descrição...
                </p>
              )}
              {meta.link && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Link2 className="w-3 h-3 text-[#e94560]" />
                  <a href={meta.link.startsWith('http') ? meta.link : `https://${meta.link}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[12px] text-[#1a1a2e] font-medium hover:underline">
                    {meta.link.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {client.niche && (
        <div className="mt-3 pt-3 border-t border-[#f5f5f5]">
          <span className="inline-flex items-center gap-1 text-[11px] text-[#737373] bg-[#f5f5f5] px-2.5 py-1 rounded-full">
            <Instagram className="w-3 h-3 text-[#e94560]" /> {client.niche}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── DnD: Draggable card ──────────────────────────────────────────────────────

function DraggableCard({ post, index, onRemove, isActive }: {
  post: FeedPost; index: number; onRemove: () => void; isActive: boolean
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: post.id, data: { post, index } })
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `cell-${index}` })
  const [hover, setHover] = useState(false)

  return (
    <div
      ref={el => { setNodeRef(el); dropRef(el) }}
      className={`relative aspect-square rounded-[2px] overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-150 select-none
        ${isDragging ? 'opacity-0 scale-95' : ''}
        ${isOver && !isActive ? 'ring-2 ring-blue-400 ring-inset scale-[1.03]' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...listeners} {...attributes}
    >
      <img src={post.image_url} alt={post.caption || `Post ${index + 1}`}
        className="w-full h-full object-cover pointer-events-none" draggable={false} />
      <AnimatePresence>
        {hover && !isDragging && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 flex items-start justify-end p-1.5">
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
        <span className="text-[9px] text-white font-bold">{index + 1}</span>
      </div>
    </div>
  )
}

function EmptySlot({ index, onAdd }: { index: number; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${index}` })
  return (
    <div ref={setNodeRef} onClick={onAdd}
      className={`aspect-square rounded-[2px] border-2 border-dashed flex items-center justify-center cursor-pointer transition-all duration-150
        ${isOver ? 'border-blue-400 bg-blue-50 scale-[1.03]' : 'border-[#e0e0e0] hover:border-[#c0c0c0] hover:bg-[#fafafa]'}`}>
      <Plus className={`w-5 h-5 ${isOver ? 'text-blue-400' : 'text-[#c0c0c0]'}`} />
    </div>
  )
}

// ─── Version chip ─────────────────────────────────────────────────────────────

function VersionChip({ version, isActive, onClick, onRename, onDelete, onDuplicate }: {
  version: FeedVersion; isActive: boolean; onClick: () => void
  onRename: (name: string) => void; onDelete: () => void; onDuplicate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState(version.name)
  const [menu,    setMenu]    = useState(false)
  const save = () => { const t = value.trim(); if (t) onRename(t); setEditing(false) }

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer transition-all whitespace-nowrap
          ${isActive ? 'shadow-sm' : 'bg-[#f0f0f0] text-[#737373] hover:bg-[#e8e8e8]'}`}
        style={isActive ? { background: '#1a1a2e', color: '#ffffff' } : undefined}
        onClick={onClick}
      >
        {editing ? (
          <input autoFocus value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={save} onClick={e => e.stopPropagation()}
            className="bg-transparent outline-none w-20 text-[12px]" style={{ color: '#ffffff' }} />
        ) : <span>{version.name}</span>}
        <button onClick={e => { e.stopPropagation(); setMenu(m => !m) }}
          className={`rounded-full p-0.5 ${isActive ? 'hover:bg-white/20' : 'hover:bg-[#d0d0d0]'}`}>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      <AnimatePresence>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <motion.div initial={{ opacity: 0, y: -4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }} transition={{ duration: 0.1 }}
              className="absolute top-full left-0 mt-1 z-20 bg-white border border-[#e8e8e8] rounded-xl shadow-lg py-1 min-w-[140px]">
              <button onClick={() => { setEditing(true); setMenu(false); onClick() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#0f0f0f] hover:bg-[#f5f5f5]">
                <Pencil className="w-3.5 h-3.5 text-[#737373]" /> Renomear
              </button>
              <button onClick={() => { onDuplicate(); setMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#0f0f0f] hover:bg-[#f5f5f5]">
                <Copy className="w-3.5 h-3.5 text-[#737373]" /> Duplicar
              </button>
              <div className="border-t border-[#f0f0f0] my-1" />
              <button onClick={() => { onDelete(); setMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Asset picker dialog ──────────────────────────────────────────────────────

function AssetPickerDialog({ open, onClose, clientId, onSelect, onUpload }: {
  open: boolean; onClose: () => void; clientId: string | null
  onSelect: (asset: ContentAsset) => void; onUpload: (file: File) => void
}) {
  const { data: allAssets } = useContentAssets()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'arsenal' | 'upload'>('arsenal')

  const assets = (allAssets || []).filter(a => {
    const isImage = a.media_url && (
      ['post', 'carousel', 'story', 'reels'].includes(a.content_type) ||
      /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(a.media_url)
    )
    if (!isImage) return false
    if (clientId) return a.client_id === clientId
    return true
  })

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>Adicionar post ao feed</DialogTitle></DialogHeader>
        <div className="flex gap-1 p-1 bg-[#f5f5f5] rounded-xl mb-4">
          {[{ id: 'arsenal', label: 'Arsenal de conteúdo', icon: Images }, { id: 'upload', label: 'Upload de imagem', icon: Upload }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all
                ${tab === t.id ? 'bg-white text-[#0f0f0f] shadow-sm' : 'text-[#737373] hover:text-[#0f0f0f]'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        {tab === 'arsenal' ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            {assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#a0a0a0]">
                <Images className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Nenhuma imagem no arsenal</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {assets.map(asset => (
                  <button key={asset.id} onClick={() => { onSelect(asset); onClose() }}
                    className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[#1a1a2e] transition-all hover:scale-[1.02] group relative">
                    <img src={asset.media_url!} alt={asset.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-end p-2 opacity-0 group-hover:opacity-100">
                      <span className="text-[10px] text-white font-medium line-clamp-2">{asset.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            <div onClick={() => fileRef.current?.click()}
              className="w-full max-w-sm aspect-video border-2 border-dashed border-[#e0e0e0] rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#1a1a2e] hover:bg-[#fafafa] transition-all">
              <Upload className="w-8 h-8 text-[#c0c0c0]" />
              <div className="text-center">
                <p className="text-sm text-[#737373] font-medium">Clique para selecionar</p>
                <p className="text-xs text-[#a0a0a0] mt-0.5">JPG, PNG, WEBP — máx. 10 MB</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { onUpload(f); onClose() } }} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type AppView = 'gallery' | 'editor'

export function FeedOrganizer() {
  const { user }  = useAuth()
  const { toast } = useToast()
  const { data: clients } = useClients()

  // ── View state ─────────────────────────────────────────────────────────────
  const [view,            setView]           = useState<AppView>('gallery')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // ── Editor state ───────────────────────────────────────────────────────────
  const [clientMenuOpen, setClientMenuOpen] = useState(false)
  const [versions,       setVersions]       = useState<FeedVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [activeDragId,   setActiveDragId]   = useState<string | null>(null)
  const [pickerOpen,     setPickerOpen]     = useState(false)
  const [isUploading,    setIsUploading]    = useState(false)
  const [clientMeta,     setClientMeta]     = useState<FeedClientMeta>({ bio: '', link: '' })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // ── Load / open client feed ────────────────────────────────────────────────

  const openEditor = useCallback((clientId: string) => {
    if (!user) return
    const vv   = loadVersions(user.id, clientId)
    const meta = loadMeta(user.id, clientId)
    setVersions(vv)
    setActiveVersionId(vv[0]?.id ?? null)
    setClientMeta(meta)
    setSelectedClientId(clientId)
    setView('editor')
  }, [user])

  const handleSaveAndBack = () => {
    toast('Feed salvo com sucesso!', 'success')
    setView('gallery')
  }

  // ── Meta ───────────────────────────────────────────────────────────────────

  const handleMetaChange = (meta: FeedClientMeta) => {
    if (!user || !selectedClientId) return
    setClientMeta(meta)
    persistMeta(user.id, selectedClientId, meta)
  }

  // ── Versions ───────────────────────────────────────────────────────────────

  const persist = (newVersions: FeedVersion[]) => {
    if (!user || !selectedClientId) return
    setVersions(newVersions)
    persistVersions(user.id, selectedClientId, newVersions)
  }

  const createVersion = () => {
    if (!selectedClientId || !user) return
    const newV: FeedVersion = {
      id: crypto.randomUUID(), client_id: selectedClientId,
      name: `Versão ${versions.length + 1}`, posts: [],
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    const updated = [...versions, newV]
    persist(updated)
    setActiveVersionId(newV.id)
  }

  const renameVersion = (id: string, name: string) =>
    persist(versions.map(v => v.id === id ? { ...v, name, updated_at: new Date().toISOString() } : v))

  const deleteVersion = (id: string) => {
    const updated = versions.filter(v => v.id !== id)
    persist(updated)
    if (activeVersionId === id) setActiveVersionId(updated[0]?.id ?? null)
  }

  const duplicateVersion = (id: string) => {
    const src = versions.find(v => v.id === id)
    if (!src) return
    const newV: FeedVersion = { ...src, id: crypto.randomUUID(), name: `${src.name} (cópia)`,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    persist([...versions, newV])
    setActiveVersionId(newV.id)
  }

  // ── Posts ──────────────────────────────────────────────────────────────────

  const activeVersion = versions.find(v => v.id === activeVersionId) ?? null
  const posts = activeVersion?.posts ?? []

  const updatePosts = (newPosts: FeedPost[]) =>
    persist(versions.map(v =>
      v.id === activeVersionId ? { ...v, posts: newPosts, updated_at: new Date().toISOString() } : v
    ))

  const addPostFromAsset = (asset: ContentAsset) => {
    if (!asset.media_url) return
    updatePosts([...posts, { id: crypto.randomUUID(), image_url: asset.media_url, caption: asset.title, asset_id: asset.id }])
  }

  const addPostFromUpload = async (file: File) => {
    if (!user) return
    setIsUploading(true)
    try {
      const ext  = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/feed/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('content-assets').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('content-assets').getPublicUrl(path)
      updatePosts([...posts, { id: crypto.randomUUID(), image_url: publicUrl }])
      toast('Imagem adicionada!', 'success')
    } catch (err: any) {
      toast(err.message || 'Erro no upload.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const removePost = (id: string) => updatePosts(posts.filter(p => p.id !== id))

  // ── DnD ───────────────────────────────────────────────────────────────────

  const handleDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id))
  const handleDragEnd   = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveDragId(null)
    if (!over) return
    const from = posts.findIndex(p => p.id === active.id)
    const to   = parseInt(String(over.id).replace('cell-', ''), 10)
    if (from === -1 || isNaN(to) || from === to) return
    updatePosts(arrayMove(posts, from, Math.min(to, posts.length - 1)))
  }

  const gridCells = Array.from({ length: posts.length + 3 }, (_, i) => ({ index: i, post: posts[i] ?? null }))
  const activeDragPost = activeDragId ? posts.find(p => p.id === activeDragId) : null
  const selectedClient = clients?.find(c => c.id === selectedClientId)

  // ── Gallery: clients that have feeds ──────────────────────────────────────

  const clientsWithFeeds = (clients || []).filter(c => {
    if (!user) return false
    const vv = loadVersions(user.id, c.id)
    return vv.length > 0
  })

  const clientsWithoutFeeds = (clients || []).filter(c => {
    if (!user) return false
    const vv = loadVersions(user.id, c.id)
    return vv.length === 0
  })

  // ══════════════════════════════════════════════════════════════════════════
  // GALLERY VIEW
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'gallery') {
    return (
      <div className="flex flex-col h-full bg-[#f7f7f7]">
        <Header title="Feed do Perfil" />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

            {/* Top bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[#0f0f0f]">Feeds criados</h2>
                <p className="text-xs text-[#a0a0a0] mt-0.5">
                  {clientsWithFeeds.length === 0
                    ? 'Nenhum feed criado ainda'
                    : `${clientsWithFeeds.length} cliente${clientsWithFeeds.length > 1 ? 's' : ''} com feed organizado`}
                </p>
              </div>

              {/* New feed dropdown */}
              <div className="relative">
                <button
                  onClick={() => setClientMenuOpen(m => !m)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-colors"
                  style={{ background: '#1a1a2e', color: '#ffffff' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Novo feed
                </button>

                <AnimatePresence>
                  {clientMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setClientMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full right-0 mt-1 z-20 bg-white border border-[#e8e8e8] rounded-xl shadow-lg py-1 min-w-[220px] max-h-64 overflow-y-auto"
                      >
                        <p className="px-3 py-1.5 text-[10px] text-[#a0a0a0] uppercase tracking-wide font-medium">
                          Selecionar cliente
                        </p>
                        {(clients || []).length === 0 ? (
                          <p className="px-3 py-2 text-sm text-[#a0a0a0]">Nenhum cliente cadastrado</p>
                        ) : (
                          (clients || []).map(c => (
                            <button key={c.id} onClick={() => { setClientMenuOpen(false); openEditor(c.id) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0f0f0f] hover:bg-[#f5f5f5] transition-colors">
                              {c.logo_url ? (
                                <img src={c.logo_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#e8e8e8] flex items-center justify-center text-[10px] font-bold text-[#737373] flex-shrink-0">
                                  {c.company_name.charAt(0)}
                                </div>
                              )}
                              <span className="truncate">{c.company_name}</span>
                            </button>
                          ))
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Clients WITH feeds */}
            {clientsWithFeeds.length > 0 && (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {clientsWithFeeds.map(c => {
                    const vv = user ? loadVersions(user.id, c.id) : []
                    return (
                      <FeedGalleryCard
                        key={c.id}
                        client={c}
                        versions={vv}
                        onEdit={() => openEditor(c.id)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {clientsWithFeeds.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-[#a0a0a0]">
                <div className="w-20 h-20 rounded-full mb-5 flex items-center justify-center"
                  style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
                  <LayoutGrid className="w-9 h-9 text-white" />
                </div>
                <p className="text-base font-semibold text-[#737373]">Nenhum feed criado ainda</p>
                <p className="text-sm mt-1 text-center max-w-xs">
                  Clique em "Novo feed" e selecione um cliente para começar a organizar o feed do Instagram.
                </p>
              </div>
            )}

            {/* Clients without feeds (suggestion row) */}
            {clientsWithoutFeeds.length > 0 && clientsWithFeeds.length > 0 && (
              <div>
                <p className="text-[11px] text-[#a0a0a0] uppercase tracking-wide font-medium mb-3">
                  Clientes sem feed
                </p>
                <div className="flex flex-wrap gap-2">
                  {clientsWithoutFeeds.map(c => (
                    <button key={c.id} onClick={() => openEditor(c.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-[#e8e8e8] rounded-xl text-[12px] text-[#737373] hover:border-[#1a1a2e] hover:text-[#0f0f0f] transition-colors shadow-sm">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#e8e8e8] flex items-center justify-center text-[9px] font-bold text-[#737373]">
                          {c.company_name.charAt(0)}
                        </div>
                      )}
                      {c.company_name}
                      <Plus className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EDITOR VIEW
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-[#f7f7f7]">
      {/* Editor top bar */}
      <div className="flex items-center justify-between h-14 px-4 sm:px-6 bg-[#1a1a2e] border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={handleSaveAndBack}
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-[13px]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-2">
            {selectedClient?.logo_url ? (
              <img src={selectedClient.logo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                {selectedClient?.company_name.charAt(0)}
              </div>
            )}
            <span className="text-sm font-semibold text-white">{selectedClient?.company_name}</span>
            {activeVersion && (
              <span className="text-[11px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                {activeVersion.name}
              </span>
            )}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSaveAndBack}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium text-[#1a1a2e] bg-white hover:bg-white/90 transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          Salvar e voltar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {selectedClient && (
            <>
              {/* Instagram header */}
              <InstagramHeader
                client={selectedClient}
                postsCount={posts.length}
                meta={clientMeta}
                onMetaChange={handleMetaChange}
              />

              {/* Version chips */}
              <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-[#a0a0a0] uppercase tracking-wide font-medium mr-1">Versões</span>
                  {versions.length === 0 && <span className="text-sm text-[#a0a0a0]">Nenhuma versão criada</span>}
                  {versions.map(v => (
                    <VersionChip key={v.id} version={v} isActive={v.id === activeVersionId}
                      onClick={() => setActiveVersionId(v.id)}
                      onRename={name => renameVersion(v.id, name)}
                      onDelete={() => deleteVersion(v.id)}
                      onDuplicate={() => duplicateVersion(v.id)} />
                  ))}
                  <button onClick={createVersion}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium text-[#737373] border border-dashed border-[#d0d0d0] hover:border-[#1a1a2e] hover:text-[#1a1a2e] transition-colors">
                    <Plus className="w-3 h-3" /> Nova versão
                  </button>
                </div>
              </div>

              {/* No version */}
              {!activeVersion && (
                <div className="flex flex-col items-center justify-center py-16">
                  <GripVertical className="w-10 h-10 mb-3 text-[#d0d0d0]" />
                  <p className="text-sm font-medium text-[#737373]">Crie uma versão para começar</p>
                  <button onClick={createVersion}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium"
                    style={{ background: '#1a1a2e', color: '#ffffff' }}>
                    <Plus className="w-3.5 h-3.5" /> Criar Versão 1
                  </button>
                </div>
              )}

              {/* Grid */}
              {activeVersion && (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-[#e94560]" />
                      <span className="text-sm font-semibold text-[#0f0f0f]">{activeVersion.name}</span>
                      <span className="text-xs text-[#a0a0a0] bg-[#f5f5f5] px-2 py-0.5 rounded-full">
                        3 colunas · {posts.length} posts
                      </span>
                    </div>
                    <button onClick={() => setPickerOpen(true)} disabled={isUploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium disabled:opacity-60"
                      style={{ background: '#1a1a2e', color: '#ffffff' }}>
                      {isUploading
                        ? <><Upload className="w-3.5 h-3.5 animate-pulse" /> Enviando...</>
                        : <><Plus className="w-3.5 h-3.5" /> Adicionar post</>}
                    </button>
                  </div>

                  <div className="px-4 py-2 bg-[#fafafa] border-b border-[#f0f0f0]">
                    <p className="text-[11px] text-[#a0a0a0] flex items-center gap-1.5">
                      <GripVertical className="w-3 h-3" />
                      Arraste os posts para reorganizar a ordem do feed
                    </p>
                  </div>

                  <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-3 gap-[2px] p-[2px] bg-[#f0f0f0]">
                      {gridCells.map(({ index, post }) =>
                        post ? (
                          <DraggableCard key={post.id} post={post} index={index}
                            onRemove={() => removePost(post.id)} isActive={activeDragId === post.id} />
                        ) : (
                          <EmptySlot key={`empty-${index}`} index={index} onAdd={() => setPickerOpen(true)} />
                        )
                      )}
                    </div>
                    <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
                      {activeDragPost ? (
                        <div className="rounded-[2px] overflow-hidden shadow-2xl ring-2 ring-blue-400 opacity-95"
                          style={{ width: 160, height: 160 }}>
                          <img src={activeDragPost.image_url} alt="" className="w-full h-full object-cover" draggable={false} />
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>

                  {posts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Images className="w-10 h-10 mb-3 text-[#d0d0d0]" />
                      <p className="text-sm font-medium text-[#737373]">Feed vazio</p>
                      <button onClick={() => setPickerOpen(true)}
                        className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium"
                        style={{ background: '#1a1a2e', color: '#ffffff' }}>
                        <Plus className="w-3.5 h-3.5" /> Adicionar primeiro post
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AssetPickerDialog
        open={pickerOpen} onClose={() => setPickerOpen(false)}
        clientId={selectedClientId} onSelect={addPostFromAsset} onUpload={addPostFromUpload}
      />
    </div>
  )
}
