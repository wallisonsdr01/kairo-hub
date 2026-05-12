import { useState, useRef, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

// arrayMove não está nesta versão do @dnd-kit/utilities — implementação local
function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Pencil, Check, X, ChevronDown, Upload,
  Images, GripVertical, Instagram, Copy,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useClients } from '@/hooks/useClients'
import { useContentAssets } from '@/hooks/useContentAssets'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import { supabase } from '@/integrations/supabase/client'
import type { ContentAsset } from '@/types'

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

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'kairohub_feed_v1'

function loadAll(): Record<string, FeedVersion[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, FeedVersion[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function loadVersions(userId: string, clientId: string): FeedVersion[] {
  const key = `${userId}__${clientId}`
  return loadAll()[key] || []
}

function persistVersions(userId: string, clientId: string, versions: FeedVersion[]) {
  const all = loadAll()
  all[`${userId}__${clientId}`] = versions
  saveAll(all)
}

// ─── DnD: Post card (draggable) ───────────────────────────────────────────────

function DraggableCard({
  post, index, onRemove, isActive,
}: {
  post: FeedPost
  index: number
  onRemove: () => void
  isActive: boolean
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: post.id,
    data: { post, index },
  })
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `cell-${index}` })
  const [hover, setHover] = useState(false)

  return (
    <div
      ref={el => { setNodeRef(el); dropRef(el) }}
      className={`
        relative aspect-square rounded-[2px] overflow-hidden cursor-grab active:cursor-grabbing
        transition-all duration-150 select-none
        ${isDragging ? 'opacity-0 scale-95' : ''}
        ${isOver && !isActive ? 'ring-2 ring-blue-400 ring-inset scale-[1.03]' : ''}
      `}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...listeners}
      {...attributes}
    >
      <img
        src={post.image_url}
        alt={post.caption || `Post ${index + 1}`}
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      {/* Hover overlay */}
      <AnimatePresence>
        {hover && !isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 flex items-start justify-end p-1.5"
          >
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors"
              title="Remover"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Position number */}
      <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
        <span className="text-[9px] text-white font-bold">{index + 1}</span>
      </div>
    </div>
  )
}

// ─── DnD: Empty slot (droppable) ─────────────────────────────────────────────

function EmptySlot({ index, onAdd }: { index: number; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${index}` })

  return (
    <div
      ref={setNodeRef}
      onClick={onAdd}
      className={`
        aspect-square rounded-[2px] border-2 border-dashed flex items-center justify-center
        cursor-pointer transition-all duration-150
        ${isOver ? 'border-blue-400 bg-blue-50 scale-[1.03]' : 'border-[#e0e0e0] hover:border-[#c0c0c0] hover:bg-[#fafafa]'}
      `}
    >
      <Plus className={`w-5 h-5 ${isOver ? 'text-blue-400' : 'text-[#c0c0c0]'}`} />
    </div>
  )
}

// ─── Version chip ─────────────────────────────────────────────────────────────

function VersionChip({
  version, isActive, onClick, onRename, onDelete, onDuplicate,
}: {
  version: FeedVersion
  isActive: boolean
  onClick: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(version.name)
  const [menu, setMenu] = useState(false)

  const save = () => {
    const trimmed = value.trim()
    if (trimmed) onRename(trimmed)
    setEditing(false)
  }

  return (
    <div className="relative">
      <div
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer
          transition-all duration-150 whitespace-nowrap
          ${isActive
            ? 'text-white shadow-sm'
            : 'bg-[#f0f0f0] text-[#737373] hover:bg-[#e8e8e8]'}
        `}
        style={isActive ? { background: '#1a1a2e' } : undefined}
        onClick={onClick}
      >
        {editing ? (
          <input
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={save}
            onClick={e => e.stopPropagation()}
            className="bg-transparent outline-none w-20 text-[12px]"
          />
        ) : (
          <span>{version.name}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); setMenu(m => !m) }}
          className={`rounded-full p-0.5 transition-colors ${isActive ? 'hover:bg-white/20' : 'hover:bg-[#d0d0d0]'}`}
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <AnimatePresence>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute top-full left-0 mt-1 z-20 bg-white border border-[#e8e8e8] rounded-xl shadow-lg py-1 min-w-[140px]"
            >
              <button
                onClick={() => { setEditing(true); setMenu(false); onClick() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#0f0f0f] hover:bg-[#f5f5f5] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-[#737373]" /> Renomear
              </button>
              <button
                onClick={() => { onDuplicate(); setMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#0f0f0f] hover:bg-[#f5f5f5] transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-[#737373]" /> Duplicar
              </button>
              <div className="border-t border-[#f0f0f0] my-1" />
              <button
                onClick={() => { onDelete(); setMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors"
              >
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

function AssetPickerDialog({
  open, onClose, clientId, onSelect, onUpload,
}: {
  open: boolean
  onClose: () => void
  clientId: string | null
  onSelect: (asset: ContentAsset) => void
  onUpload: (file: File) => void
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
        <DialogHeader>
          <DialogTitle>Adicionar post ao feed</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#f5f5f5] rounded-xl mb-4">
          {[
            { id: 'arsenal', label: 'Arsenal de conteúdo', icon: Images },
            { id: 'upload', label: 'Upload de imagem', icon: Upload },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all ${
                tab === t.id ? 'bg-white text-[#0f0f0f] shadow-sm' : 'text-[#737373] hover:text-[#0f0f0f]'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'arsenal' ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            {assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#a0a0a0]">
                <Images className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">Nenhuma imagem no arsenal</p>
                <p className="text-xs mt-1">
                  {clientId ? 'Adicione imagens na Biblioteca para este cliente.' : 'Selecione um cliente ou adicione imagens na Biblioteca.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {assets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => { onSelect(asset); onClose() }}
                    className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-[#1a1a2e] transition-all hover:scale-[1.02] group relative"
                  >
                    <img
                      src={asset.media_url!}
                      alt={asset.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
                      <span className="text-[10px] text-white font-medium line-clamp-2 leading-tight">
                        {asset.title}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full max-w-sm aspect-video border-2 border-dashed border-[#e0e0e0] rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#1a1a2e] hover:bg-[#fafafa] transition-all"
            >
              <Upload className="w-8 h-8 text-[#c0c0c0]" />
              <div className="text-center">
                <p className="text-sm text-[#737373] font-medium">Clique para selecionar</p>
                <p className="text-xs text-[#a0a0a0] mt-0.5">JPG, PNG, WEBP — máx. 10 MB</p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { onUpload(file); onClose() }
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FeedOrganizer() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: clients } = useClients()

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clientMenuOpen, setClientMenuOpen] = useState(false)
  const [versions, setVersions] = useState<FeedVersion[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // ── Load versions when client changes ──────────────────────────────────────

  const loadClientVersions = useCallback((clientId: string) => {
    if (!user) return
    const vv = loadVersions(user.id, clientId)
    setVersions(vv)
    setActiveVersionId(vv[0]?.id ?? null)
    setHasLoaded(true)
  }, [user])

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId)
    setClientMenuOpen(false)
    setHasLoaded(false)
    loadClientVersions(clientId)
  }

  // ── Version helpers ────────────────────────────────────────────────────────

  const persist = (newVersions: FeedVersion[]) => {
    if (!user || !selectedClientId) return
    setVersions(newVersions)
    persistVersions(user.id, selectedClientId, newVersions)
  }

  const createVersion = () => {
    if (!selectedClientId || !user) return
    const count = versions.length + 1
    const newV: FeedVersion = {
      id: crypto.randomUUID(),
      client_id: selectedClientId,
      name: `Versão ${count}`,
      posts: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const updated = [...versions, newV]
    persist(updated)
    setActiveVersionId(newV.id)
  }

  const renameVersion = (id: string, name: string) => {
    persist(versions.map(v => v.id === id ? { ...v, name, updated_at: new Date().toISOString() } : v))
  }

  const deleteVersion = (id: string) => {
    const updated = versions.filter(v => v.id !== id)
    persist(updated)
    if (activeVersionId === id) setActiveVersionId(updated[0]?.id ?? null)
  }

  const duplicateVersion = (id: string) => {
    const src = versions.find(v => v.id === id)
    if (!src) return
    const newV: FeedVersion = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} (cópia)`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const updated = [...versions, newV]
    persist(updated)
    setActiveVersionId(newV.id)
  }

  // ── Post helpers ───────────────────────────────────────────────────────────

  const activeVersion = versions.find(v => v.id === activeVersionId) ?? null
  const posts = activeVersion?.posts ?? []

  const updatePosts = (newPosts: FeedPost[]) => {
    persist(versions.map(v =>
      v.id === activeVersionId
        ? { ...v, posts: newPosts, updated_at: new Date().toISOString() }
        : v
    ))
  }

  const addPostFromAsset = (asset: ContentAsset) => {
    if (!asset.media_url) return
    const newPost: FeedPost = {
      id: crypto.randomUUID(),
      image_url: asset.media_url,
      caption: asset.title,
      asset_id: asset.id,
    }
    updatePosts([...posts, newPost])
  }

  const addPostFromUpload = async (file: File) => {
    if (!user) return
    setIsUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/feed/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('content-assets').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('content-assets').getPublicUrl(path)
      const newPost: FeedPost = {
        id: crypto.randomUUID(),
        image_url: publicUrl,
      }
      updatePosts([...posts, newPost])
      toast('Imagem adicionada ao feed!', 'success')
    } catch (err: any) {
      toast(err.message || 'Erro ao fazer upload.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const removePost = (postId: string) => {
    updatePosts(posts.filter(p => p.id !== postId))
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over) return

    const fromIndex = posts.findIndex(p => p.id === active.id)
    const overId = String(over.id) // "cell-N"
    const toIndex = parseInt(overId.replace('cell-', ''), 10)

    if (fromIndex === -1 || fromIndex === toIndex || isNaN(toIndex)) return

    // If dropping on an empty slot beyond posts, move to end
    const finalIndex = toIndex >= posts.length ? posts.length - 1 : toIndex
    updatePosts(arrayMove(posts, fromIndex, finalIndex))
  }

  // ── Grid: show posts + 3 empty slots at the end ────────────────────────────

  const EMPTY_SLOTS = 3
  const totalCells = posts.length + EMPTY_SLOTS
  const gridCells = Array.from({ length: totalCells }, (_, i) => ({
    index: i,
    post: posts[i] ?? null,
  }))

  const activeDragPost = activeDragId ? posts.find(p => p.id === activeDragId) : null

  // ── Client name lookup ─────────────────────────────────────────────────────

  const selectedClient = clients?.find(c => c.id === selectedClientId)

  return (
    <div className="flex flex-col h-full bg-[#f7f7f7]">
      <Header title="Feed do Perfil" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ── Client selector ── */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setClientMenuOpen(m => !m)}
                className="flex items-center gap-2.5 h-10 px-4 bg-white border border-[#e8e8e8] rounded-xl text-sm text-[#0f0f0f] hover:border-[#d0d0d0] transition-colors shadow-sm min-w-[200px] justify-between"
              >
                <div className="flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-[#e94560]" />
                  <span className={selectedClient ? 'text-[#0f0f0f]' : 'text-[#a0a0a0]'}>
                    {selectedClient?.company_name ?? 'Selecionar cliente'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-[#a0a0a0]" />
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
                      className="absolute top-full left-0 mt-1 z-20 bg-white border border-[#e8e8e8] rounded-xl shadow-lg py-1 min-w-full max-h-64 overflow-y-auto"
                    >
                      {(clients || []).length === 0 ? (
                        <p className="px-3 py-2 text-sm text-[#a0a0a0]">Nenhum cliente cadastrado</p>
                      ) : (
                        (clients || []).map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleSelectClient(c.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors
                              ${selectedClientId === c.id
                                ? 'bg-[#f0f0f0] text-[#0f0f0f] font-medium'
                                : 'text-[#0f0f0f] hover:bg-[#f5f5f5]'}
                            `}
                          >
                            {c.logo_url ? (
                              <img src={c.logo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#e8e8e8] flex items-center justify-center text-[10px] font-bold text-[#737373]">
                                {c.company_name.charAt(0)}
                              </div>
                            )}
                            {c.company_name}
                            {selectedClientId === c.id && <Check className="w-3.5 h-3.5 ml-auto text-[#1a1a2e]" />}
                          </button>
                        ))
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {selectedClient && (
              <p className="text-xs text-[#a0a0a0]">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'} na versão atual
              </p>
            )}
          </div>

          {/* ── No client selected ── */}
          {!selectedClientId && (
            <div className="flex flex-col items-center justify-center py-24 text-[#a0a0a0]">
              <Instagram className="w-14 h-14 mb-4 opacity-20" />
              <p className="text-base font-medium text-[#737373]">Selecione um cliente para começar</p>
              <p className="text-sm mt-1">Organize o feed do Instagram do seu cliente de forma visual.</p>
            </div>
          )}

          {selectedClientId && (
            <>
              {/* ── Version chips ── */}
              <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-[#a0a0a0] uppercase tracking-wide font-medium mr-1">Versões</span>

                  {versions.length === 0 && (
                    <span className="text-sm text-[#a0a0a0]">Nenhuma versão criada</span>
                  )}

                  {versions.map(v => (
                    <VersionChip
                      key={v.id}
                      version={v}
                      isActive={v.id === activeVersionId}
                      onClick={() => setActiveVersionId(v.id)}
                      onRename={name => renameVersion(v.id, name)}
                      onDelete={() => deleteVersion(v.id)}
                      onDuplicate={() => duplicateVersion(v.id)}
                    />
                  ))}

                  <button
                    onClick={createVersion}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium text-[#737373] border border-dashed border-[#d0d0d0] hover:border-[#1a1a2e] hover:text-[#1a1a2e] transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nova versão
                  </button>
                </div>
              </div>

              {/* ── No version selected ── */}
              {!activeVersion && (
                <div className="flex flex-col items-center justify-center py-20 text-[#a0a0a0]">
                  <GripVertical className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium text-[#737373]">Crie uma versão para começar</p>
                  <p className="text-xs mt-1">Você pode ter várias versões do feed e comparar.</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={createVersion}>
                    <Plus className="w-3.5 h-3.5" /> Criar Versão 1
                  </Button>
                </div>
              )}

              {/* ── Grid ── */}
              {activeVersion && (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden">
                  {/* Grid header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
                    <div className="flex items-center gap-2">
                      <Instagram className="w-4 h-4 text-[#e94560]" />
                      <span className="text-sm font-semibold text-[#0f0f0f]">{activeVersion.name}</span>
                      <span className="text-xs text-[#a0a0a0] bg-[#f5f5f5] px-2 py-0.5 rounded-full">
                        3 colunas · {posts.length} posts
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setPickerOpen(true)}
                      disabled={isUploading}
                      style={{ background: '#1a1a2e', color: '#fff' }}
                    >
                      {isUploading ? (
                        <><Upload className="w-3.5 h-3.5 animate-pulse" /> Enviando...</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5" /> Adicionar post</>
                      )}
                    </Button>
                  </div>

                  {/* Hint */}
                  <div className="px-4 py-2 bg-[#fafafa] border-b border-[#f0f0f0]">
                    <p className="text-[11px] text-[#a0a0a0] flex items-center gap-1.5">
                      <GripVertical className="w-3 h-3" />
                      Arraste os posts para reorganizar a ordem do feed
                    </p>
                  </div>

                  {/* 3-col Instagram grid */}
                  <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="grid grid-cols-3 gap-[2px] p-[2px] bg-[#f0f0f0]">
                      {gridCells.map(({ index, post }) =>
                        post ? (
                          <DraggableCard
                            key={post.id}
                            post={post}
                            index={index}
                            onRemove={() => removePost(post.id)}
                            isActive={activeDragId === post.id}
                          />
                        ) : (
                          <EmptySlot
                            key={`empty-${index}`}
                            index={index}
                            onAdd={() => setPickerOpen(true)}
                          />
                        )
                      )}
                    </div>

                    <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
                      {activeDragPost ? (
                        <div className="aspect-square rounded-[2px] overflow-hidden shadow-2xl ring-2 ring-blue-400 opacity-95"
                          style={{ width: 160, height: 160 }}>
                          <img
                            src={activeDragPost.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>

                  {posts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-[#a0a0a0]">
                      <Images className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm font-medium text-[#737373]">Feed vazio</p>
                      <p className="text-xs mt-1">Adicione posts do arsenal ou faça upload de imagens.</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => setPickerOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Adicionar primeiro post
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Asset picker dialog ── */}
      <AssetPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        clientId={selectedClientId}
        onSelect={addPostFromAsset}
        onUpload={addPostFromUpload}
      />
    </div>
  )
}
