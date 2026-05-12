import { useState, useRef, useEffect } from 'react'
import {
  Plus, NotebookPen, Trash2, Check, X, GripVertical, StickyNote,
  Filter, Building2, Tag,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useNotes, useCreateNote, useUpdateNote, useDeleteNote,
  type NotesFilter, type CreateNotePayload, type UpdateNotePayload,
} from '@/hooks/useNotes'
import { useClients } from '@/hooks/useClients'
import { useToast } from '@/components/ui/toast'
import type { Note, NoteChecklistItem, NoteType, NoteOrigin } from '@/types'

// ─── Configs ──────────────────────────────────────────────────────────────────

const typeLabels: Record<NoteType, string> = {
  interna:    'Interna',
  ideia:      'Ideia',
  solicitacao: 'Solicitação',
}
const typeBadgeColors: Record<NoteType, string> = {
  interna:    'bg-[#f0f0f0] text-[#737373]',
  ideia:      'bg-amber-50 text-amber-600',
  solicitacao: 'bg-blue-50 text-blue-600',
}
const originLabels: Record<NoteOrigin, string> = {
  agency: 'Agência',
  client: 'Cliente',
}

function newItem(text = ''): NoteChecklistItem {
  return { id: crypto.randomUUID(), text, done: false }
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const doneCount = note.checklist.filter(i => i.done).length
  const preview = note.content?.slice(0, 100) || ''

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onClick={onOpen}
      className="group bg-white border border-[#e8e8e8] rounded-2xl p-4 cursor-pointer hover:border-[#c8c8c8] hover:shadow-sm transition-all duration-150 select-none"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-[13px] font-semibold text-[#0f0f0f] leading-snug line-clamp-2 flex-1">
          {note.title || 'Sem título'}
        </h3>
        <NotebookPen className="w-3.5 h-3.5 text-[#a0a0a0] flex-shrink-0 mt-0.5" />
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${typeBadgeColors[note.type]}`}>
          {typeLabels[note.type]}
        </span>
        {note.client && (
          <span className="text-[10px] text-[#737373] bg-[#f5f5f5] px-1.5 py-0.5 rounded-md flex items-center gap-1">
            <Building2 className="w-2.5 h-2.5" />
            {note.client.company_name}
          </span>
        )}
        {note.origin === 'client' && (
          <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md">
            do cliente
          </span>
        )}
      </div>

      {preview && (
        <p className="text-[12px] text-[#737373] leading-relaxed line-clamp-2 mb-2 whitespace-pre-wrap">
          {preview}
        </p>
      )}

      {note.checklist.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="h-1 flex-1 rounded-full bg-[#f0f0f0] overflow-hidden">
            <div
              className="h-full bg-[#1a1a2e] rounded-full transition-all"
              style={{ width: `${(doneCount / note.checklist.length) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-[#a0a0a0] flex-shrink-0">
            {doneCount}/{note.checklist.length}
          </span>
        </div>
      )}

      <p className="text-[11px] text-[#b0b0b0]">
        {formatDistanceToNow(parseISO(note.updated_at), { addSuffix: true, locale: ptBR })}
      </p>
    </motion.div>
  )
}

// ─── ChecklistEditor ──────────────────────────────────────────────────────────

function ChecklistEditor({
  items,
  onChange,
}: {
  items: NoteChecklistItem[]
  onChange: (items: NoteChecklistItem[]) => void
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  function toggle(id: string) {
    onChange(items.map(i => i.id === id ? { ...i, done: !i.done } : i))
  }
  function updateText(id: string, text: string) {
    onChange(items.map(i => i.id === id ? { ...i, text } : i))
  }
  function remove(id: string) {
    onChange(items.filter(i => i.id !== id))
  }
  function addAfter(index: number) {
    const item = newItem()
    const next = [...items]
    next.splice(index + 1, 0, item)
    onChange(next)
    setTimeout(() => inputRefs.current[index + 1]?.focus(), 30)
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addAfter(index)
    } else if (e.key === 'Backspace' && items[index].text === '' && items.length > 1) {
      e.preventDefault()
      remove(items[index].id)
      setTimeout(() => inputRefs.current[Math.max(0, index - 1)]?.focus(), 30)
    }
  }

  return (
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2 group/item">
          <GripVertical className="w-3.5 h-3.5 text-[#d0d0d0] flex-shrink-0 cursor-grab" />
          <button
            type="button"
            onClick={() => toggle(item.id)}
            className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
              item.done ? 'bg-[#1a1a2e] border-[#1a1a2e]' : 'border-[#d0d0d0] hover:border-[#a0a0a0]'
            }`}
          >
            {item.done && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
          <input
            ref={el => { inputRefs.current[idx] = el }}
            value={item.text}
            onChange={e => updateText(item.id, e.target.value)}
            onKeyDown={e => handleKeyDown(e, idx)}
            placeholder="Item da lista..."
            className={`flex-1 text-[13px] bg-transparent outline-none placeholder:text-[#c0c0c0] ${
              item.done ? 'line-through text-[#a0a0a0]' : 'text-[#0f0f0f]'
            }`}
          />
          <button
            type="button"
            onClick={() => remove(item.id)}
            className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-[#f0f0f0]"
          >
            <X className="w-3 h-3 text-[#a0a0a0]" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => { onChange([...items, newItem()]); setTimeout(() => inputRefs.current[items.length]?.focus(), 30) }}
        className="flex items-center gap-1.5 text-[12px] text-[#a0a0a0] hover:text-[#0f0f0f] transition-colors mt-1"
      >
        <Plus className="w-3.5 h-3.5" /> Adicionar item
      </button>
    </div>
  )
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({
  note,
  clients,
  defaultClientId,
  onClose,
}: {
  note: Note | null
  clients: { id: string; company_name: string }[]
  defaultClientId?: string | null
  onClose: () => void
}) {
  const isNew = !note
  const [title, setTitle]         = useState(note?.title ?? '')
  const [content, setContent]     = useState(note?.content ?? '')
  const [checklist, setChecklist] = useState<NoteChecklistItem[]>(note?.checklist ?? [])
  const [clientId, setClientId]   = useState<string>(note?.client_id ?? defaultClientId ?? '')
  const [type, setType]           = useState<NoteType>(note?.type ?? 'interna')
  const [tab, setTab]             = useState<'texto' | 'checklist'>(
    note && note.checklist.length > 0 ? 'checklist' : 'texto'
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const { toast } = useToast()
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50) }, [])

  const saving = createNote.isPending || updateNote.isPending

  async function handleSave() {
    if (!title.trim() && !content.trim() && checklist.filter(i => i.text.trim()).length === 0) {
      onClose()
      return
    }
    try {
      const payload = {
        title:     title.trim(),
        content:   content.trim() || null,
        checklist: checklist.filter(i => i.text.trim() !== ''),
        client_id: clientId || null,
        type,
      }
      if (isNew) {
        await createNote.mutateAsync(payload as CreateNotePayload)
      } else {
        await updateNote.mutateAsync({ id: note!.id, ...payload } as UpdateNotePayload)
      }
      toast(isNew ? 'Nota criada!' : 'Nota salva!', 'success')
      onClose()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function handleDelete() {
    try {
      await deleteNote.mutateAsync(note!.id)
      toast('Nota excluída.', 'success')
      onClose()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleSave} />

      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#e8e8e8] flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-[#f0f0f0]">
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Título da nota..."
            className="flex-1 text-[16px] font-semibold text-[#0f0f0f] bg-transparent outline-none placeholder:text-[#c0c0c0] placeholder:font-normal"
          />
          <button onClick={handleSave} className="p-1.5 rounded-lg hover:bg-[#f0f0f0] transition-colors">
            <X className="w-4 h-4 text-[#737373]" />
          </button>
        </div>

        {/* Meta row: tipo + cliente */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-1 flex-wrap">
          {/* Tipo */}
          <div className="flex items-center gap-1">
            <Tag className="w-3 h-3 text-[#a0a0a0]" />
            <select
              value={type}
              onChange={e => setType(e.target.value as NoteType)}
              className="text-[12px] text-[#0f0f0f] bg-transparent outline-none border-none cursor-pointer"
            >
              <option value="interna">Interna</option>
              <option value="ideia">Ideia</option>
              <option value="solicitacao">Solicitação</option>
            </select>
          </div>

          <span className="text-[#e0e0e0]">·</span>

          {/* Cliente */}
          <div className="flex items-center gap-1">
            <Building2 className="w-3 h-3 text-[#a0a0a0]" />
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="text-[12px] text-[#0f0f0f] bg-transparent outline-none border-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="">Sem cliente</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 px-5 pt-2">
          {(['texto', 'checklist'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                tab === t ? 'bg-[#f0f0f0] text-[#0f0f0f]' : 'text-[#a0a0a0] hover:text-[#0f0f0f]'
              }`}
            >
              {t === 'texto' ? 'Texto' : 'Checklist'}
              {t === 'checklist' && checklist.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-[#1a1a2e] text-white rounded-full px-1.5 py-0.5">
                  {checklist.filter(i => i.done).length}/{checklist.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'texto' ? (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Escreva sua nota aqui..."
              rows={10}
              className="w-full text-[13px] text-[#0f0f0f] bg-transparent outline-none resize-none placeholder:text-[#c0c0c0] leading-relaxed"
            />
          ) : (
            checklist.length === 0 ? (
              <button
                type="button"
                onClick={() => setChecklist([newItem()])}
                className="flex items-center gap-2 text-[13px] text-[#a0a0a0] hover:text-[#0f0f0f] transition-colors"
              >
                <Plus className="w-4 h-4" /> Adicionar primeiro item
              </button>
            ) : (
              <ChecklistEditor items={checklist} onChange={setChecklist} />
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#f0f0f0]">
          {!isNew ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#737373]">Excluir nota?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[12px] px-2.5 py-1 rounded-lg border border-[#e0e0e0] text-[#737373] hover:bg-[#f8f8f8] transition-colors"
                >
                  Não
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteNote.isPending}
                  className="text-[12px] px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors"
                >
                  Sim, excluir
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-[12px] text-[#a0a0a0] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            )
          ) : (
            <div />
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl bg-[#1a1a2e] hover:bg-[#252550] text-white transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

function FilterBar({
  filter,
  clients,
  onChange,
}: {
  filter: NotesFilter
  clients: { id: string; company_name: string }[]
  onChange: (f: NotesFilter) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="w-3.5 h-3.5 text-[#a0a0a0]" />

      {/* Por cliente */}
      <select
        value={filter.client_id ?? ''}
        onChange={e => onChange({ ...filter, client_id: e.target.value || null })}
        className="text-[12px] text-[#0f0f0f] bg-white border border-[#e8e8e8] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-[#c0c0c0] transition-colors"
      >
        <option value="">Todos os clientes</option>
        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
      </select>

      {/* Por tipo */}
      <select
        value={filter.type ?? ''}
        onChange={e => onChange({ ...filter, type: (e.target.value as NoteType) || null })}
        className="text-[12px] text-[#0f0f0f] bg-white border border-[#e8e8e8] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-[#c0c0c0] transition-colors"
      >
        <option value="">Todos os tipos</option>
        <option value="interna">Interna</option>
        <option value="ideia">Ideia</option>
        <option value="solicitacao">Solicitação</option>
      </select>

      {/* Por origem */}
      <select
        value={filter.origin ?? ''}
        onChange={e => onChange({ ...filter, origin: (e.target.value as NoteOrigin) || null })}
        className="text-[12px] text-[#0f0f0f] bg-white border border-[#e8e8e8] rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-[#c0c0c0] transition-colors"
      >
        <option value="">Qualquer origem</option>
        <option value="agency">Agência</option>
        <option value="client">Cliente</option>
      </select>

      {/* Limpar filtros */}
      {(filter.client_id || filter.type || filter.origin) && (
        <button
          onClick={() => onChange({})}
          className="flex items-center gap-1 text-[12px] text-[#a0a0a0] hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" /> Limpar
        </button>
      )}
    </div>
  )
}

// ─── Notes page ───────────────────────────────────────────────────────────────

export function Notes() {
  const [filter, setFilter] = useState<NotesFilter>({})
  const { data: notes = [], isLoading } = useNotes(filter)
  const { data: allClients = [] } = useClients()
  const [selected, setSelected] = useState<Note | null | 'new'>(null)

  const open = selected !== null
  const modalNote = selected === 'new' ? null : selected

  const clients = allClients.map(c => ({ id: c.id, company_name: c.company_name }))

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0] bg-white gap-4 flex-wrap">
        <div>
          <h1 className="text-[18px] font-bold text-[#0f0f0f]">Notas</h1>
          <p className="text-[12px] text-[#a0a0a0] mt-0.5">
            {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <FilterBar filter={filter} clients={clients} onChange={setFilter} />
          <button
            onClick={() => setSelected('new')}
            className="flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-xl bg-[#1a1a2e] hover:bg-[#252550] text-white transition-colors"
          >
            <Plus className="w-4 h-4 text-white" />
            Nova nota
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#f8f8f8] rounded-2xl h-36 animate-pulse" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
              <StickyNote className="w-8 h-8 text-white/30" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-white mb-1">
                {(filter.client_id || filter.type || filter.origin)
                  ? 'Nenhuma nota encontrada com esses filtros'
                  : 'Nenhuma nota ainda'}
              </p>
              <p className="text-[13px] text-white/50">
                {(filter.client_id || filter.type || filter.origin)
                  ? 'Tente alterar ou limpar os filtros'
                  : 'Crie sua primeira nota clicando em "Nova nota"'}
              </p>
            </div>
            {!(filter.client_id || filter.type || filter.origin) && (
              <button
                onClick={() => setSelected('new')}
                className="flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-xl bg-[#1a1a2e] hover:bg-[#252550] text-white transition-colors mt-2"
              >
                <Plus className="w-4 h-4 text-white" />
                Criar nota
              </button>
            )}
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence>
              {notes.map(note => (
                <NoteCard key={note.id} note={note} onOpen={() => setSelected(note)} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <NoteModal
            note={modalNote}
            clients={clients}
            defaultClientId={filter.client_id}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
