import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, ChevronLeft, ChevronRight, Trash2,
  User, CalendarDays, AlertCircle, LayoutList, Clock, Pencil,
} from 'lucide-react'
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, addWeeks, subWeeks, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { useClients } from '@/hooks/useClients'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import { formatDate, isOverdue } from '@/utils/formatters'
import type { Task, TaskStatus, TaskPriority } from '@/types'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<TaskStatus, { label: string; bg: string; text: string; dot: string }> = {
  a_fazer:      { label: 'A fazer',      bg: 'bg-[#f0f0f0]',  text: 'text-[#737373]',   dot: 'bg-[#c0c0c0]'   },
  em_andamento: { label: 'Em andamento', bg: 'bg-blue-50',    text: 'text-blue-600',    dot: 'bg-blue-400'    },
  revisao:      { label: 'Revisão',      bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400'   },
  concluido:    { label: 'Concluído',    bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
}

const PRIORITY_CFG: Record<TaskPriority, { label: string; color: string }> = {
  baixa:   { label: 'Baixa',   color: '#a0a0a0' },
  media:   { label: 'Média',   color: '#3b82f6' },
  alta:    { label: 'Alta',    color: '#f59e0b' },
  urgente: { label: 'Urgente', color: '#ef4444' },
}

// ─── Status pill with inline dropdown ────────────────────────────────────────

function StatusPill({
  status, onChange,
}: {
  status: TaskStatus
  onChange: (s: TaskStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CFG[status]

  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity ${cfg.bg} ${cfg.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full mb-1.5 left-0 z-20 w-36 bg-white border border-[#e8e8e8] rounded-xl shadow-lg overflow-hidden py-1"
            >
              {(Object.entries(STATUS_CFG) as [TaskStatus, typeof STATUS_CFG[TaskStatus]][]).map(([s, c]) => (
                <button
                  key={s}
                  onClick={e => { e.stopPropagation(); onChange(s); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[#f5f5f5] transition-colors text-left ${s === status ? 'font-semibold' : ''}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                  <span className={c.text}>{c.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
  onDelete,
  onEdit,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  onStatusChange: (id: string, s: TaskStatus) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  dragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
}) {
  const overdueAndOpen = task.due_date
    ? isOverdue(task.due_date) && task.status !== 'concluido'
    : false

  const clientName = (task.client as any)?.company_name
  const priCfg = PRIORITY_CFG[task.priority]

  return (
    <div
      draggable
      onDragStart={(e: React.DragEvent<HTMLDivElement>) => { e.dataTransfer.setData('taskId', task.id); onDragStart(task.id) }}
      onDragEnd={onDragEnd}
      className={`
        bg-white rounded-xl border select-none cursor-grab active:cursor-grabbing
        transition-all duration-150 hover:shadow-md group
        ${overdueAndOpen
          ? 'border-red-200 border-l-[3px] border-l-red-400'
          : 'border-[#e8e8e8] hover:border-[#d0d0d0]'}
        ${dragging ? 'opacity-40 scale-[0.97]' : 'opacity-100'}
      `}
    >
      <div className="p-2.5">
        {/* Time badge — shown at top if present */}
        {task.due_time && (
          <div className="flex items-center gap-1 mb-1.5">
            <Clock className="w-3 h-3 text-[#c0c0c0] flex-shrink-0" />
            <span className="text-[11px] font-semibold text-[#0f0f0f] tabular-nums">
              {task.due_time}
            </span>
          </div>
        )}

        {/* Top row: title + actions */}
        <div className="flex items-start gap-1.5">
          <p className="text-[12px] font-semibold text-[#0f0f0f] leading-snug flex-1 min-w-0">
            {task.title}
          </p>
          {/* Action buttons — visible on hover */}
          <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onEdit(task) }}
              className="text-[#c0c0c0] hover:text-[#0f0f0f] transition-colors p-0.5"
              title="Editar"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(task.id) }}
              className="text-[#d0d0d0] hover:text-red-400 transition-colors p-0.5"
              title="Excluir"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Client */}
        {clientName && (
          <p className="text-[10px] text-blue-500 font-medium mt-1 truncate">{clientName}</p>
        )}

        {/* Description */}
        {task.description && (
          <p className="text-[10px] text-[#a0a0a0] mt-1 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Overdue warning */}
        {overdueAndOpen && (
          <div className="flex items-center gap-1 mt-1.5">
            <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
            <span className="text-[10px] text-red-400 font-medium">
              Atrasada {task.due_date ? `· ${formatDate(task.due_date)}` : ''}
            </span>
          </div>
        )}

        {/* Assignee */}
        {task.assignee && (
          <div className="flex items-center gap-1 mt-1.5">
            <User className="w-3 h-3 text-[#c0c0c0] flex-shrink-0" />
            <span className="text-[10px] text-[#a0a0a0] truncate">{task.assignee}</span>
          </div>
        )}

        {/* Bottom: priority + status pill */}
        <div className="flex items-center justify-between mt-2 gap-1">
          <span
            className="text-[9px] font-semibold uppercase tracking-wide"
            style={{ color: priCfg.color }}
          >
            {priCfg.label}
          </span>
          <StatusPill
            status={task.status}
            onChange={s => onStatusChange(task.id, s)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Day column ───────────────────────────────────────────────────────────────

function DayColumn({
  day, tasks, draggingId,
  onDrop, onDragStart, onDragEnd,
  onStatusChange, onDelete, onEdit, onAddTask,
}: {
  day: Date
  tasks: Task[]
  draggingId: string | null
  onDrop: (taskId: string, day: Date) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onStatusChange: (id: string, s: TaskStatus) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onAddTask: (day: Date) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const today    = isToday(day)
  const dayLabel = format(day, 'EEE', { locale: ptBR })
  const dayNum   = format(day, 'd')
  const monthAbbr = format(day, 'MMM', { locale: ptBR })

  return (
    <div
      className="flex flex-col flex-1 min-w-[170px]"
      onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
      }}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const id = e.dataTransfer.getData('taskId')
        if (id) onDrop(id, day)
      }}
    >
      {/* Column header */}
      <div className={`
        rounded-xl border px-3 py-2.5 mb-2 transition-all
        ${today ? 'bg-[#1a1a2e] border-[#1a1a2e]' : 'bg-white border-[#e8e8e8]'}
      `}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${today ? 'text-white/60' : 'text-[#a0a0a0]'}`}>
              {dayLabel}
            </p>
            <p className={`text-[20px] font-bold leading-tight tabular-nums ${today ? 'text-white' : 'text-[#0f0f0f]'}`}>
              {dayNum}
              <span className={`text-[10px] font-normal ml-1 ${today ? 'text-white/50' : 'text-[#b0b0b0]'}`}>
                {monthAbbr}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {tasks.length > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                today ? 'bg-white/20 text-white' : 'bg-[#f0f0f0] text-[#737373]'
              }`}>
                {tasks.length}
              </span>
            )}
            <button
              onClick={() => onAddTask(day)}
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                today
                  ? 'bg-white/20 hover:bg-white/30 text-white'
                  : 'bg-[#f0f0f0] hover:bg-[#e0e0e0] text-[#737373] hover:text-[#0f0f0f]'
              }`}
              title={`Nova tarefa para ${format(day, 'dd/MM')}`}
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div className={`
        flex-1 rounded-xl border-2 border-dashed min-h-[420px] p-2 transition-all duration-150
        ${isDragOver ? 'border-[#0f0f0f] bg-[#f5f5f5]' : 'border-transparent bg-transparent'}
      `}>
        <div className="space-y-2">
          <AnimatePresence>
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                dragging={draggingId === task.id}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onEdit={onEdit}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
          </AnimatePresence>
        </div>

        {tasks.length === 0 && !isDragOver && (
          <div className="flex items-center justify-center h-20 mt-2">
            <p className="text-[10px] text-[#d8d8d8] text-center leading-relaxed">
              Arraste tarefas<br />para cá
            </p>
          </div>
        )}
        {isDragOver && (
          <div className="flex items-center justify-center h-16 mt-2 rounded-lg border border-dashed border-[#0f0f0f]/20">
            <p className="text-[11px] text-[#737373] font-medium">Soltar aqui</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── No-date section ──────────────────────────────────────────────────────────

function NoDateSection({
  tasks, draggingId,
  onStatusChange, onDelete, onEdit, onDragStart, onDragEnd,
}: {
  tasks: Task[]
  draggingId: string | null
  onStatusChange: (id: string, s: TaskStatus) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
}) {
  const [open, setOpen] = useState(true)
  if (tasks.length === 0) return null

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 mb-3 group"
      >
        <LayoutList className="w-3.5 h-3.5 text-[#a0a0a0]" />
        <p className="text-[12px] font-semibold text-[#737373] group-hover:text-[#0f0f0f] transition-colors">
          Sem data definida
        </p>
        <span className="text-[10px] text-[#b0b0b0] bg-[#f0f0f0] px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
        <ChevronLeft className={`w-3 h-3 text-[#c0c0c0] transition-transform ${open ? '-rotate-90' : 'rotate-0'}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  dragging={draggingId === task.id}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Task dialog (create + edit) ──────────────────────────────────────────────

const blankForm = {
  title:       '',
  description: '',
  due_date:    '',
  due_time:    '',           // ← new
  priority:    'media' as TaskPriority,
  status:      'a_fazer' as TaskStatus,
  assignee:    '',
  client_id:   null as string | null,
}

type TaskForm = typeof blankForm

function TaskDialog({
  open, onClose, prefillDate, clients, editingTask, onCreate, onUpdate,
}: {
  open: boolean
  onClose: () => void
  prefillDate: string
  clients: { id: string; company_name: string }[]
  editingTask: Task | null
  onCreate: (form: TaskForm) => Promise<void>
  onUpdate: (id: string, form: TaskForm) => Promise<void>
}) {
  const [form, setForm] = useState<TaskForm>(blankForm)
  const [saving, setSaving] = useState(false)
  const isEdit = !!editingTask

  const set = (k: keyof TaskForm, v: unknown) =>
    setForm(p => ({ ...p, [k]: v }))

  // ── Sync form whenever the dialog opens or the target task changes ──────────
  // Radix UI does NOT call onOpenChange(true) when the parent sets open=true
  // programmatically, so we use useEffect instead of onOpenChange for init.
  useEffect(() => {
    if (!open) return

    if (editingTask) {
      // Edit mode — fill every field from the existing task
      setForm({
        title:       editingTask.title,
        description: editingTask.description || '',
        due_date:    editingTask.due_date    || '',
        due_time:    editingTask.due_time    || '',
        priority:    editingTask.priority,
        status:      editingTask.status,
        assignee:    editingTask.assignee    || '',
        client_id:   editingTask.client_id,
      })
    } else {
      // Create mode — blank form, optionally pre-fill date from column "+"
      setForm({ ...blankForm, due_date: prefillDate })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTask?.id])
  // ── editingTask?.id as dep: re-runs when a DIFFERENT task is selected,
  //    but NOT on every render (avoids resetting while user types)

  const handleClose = () => {
    onClose()
    setForm(blankForm)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      if (isEdit && editingTask) {
        await onUpdate(editingTask.id, form)
      } else {
        await onCreate(form)
      }
      setForm(blankForm)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <Input
            label="Título *"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Descrição da tarefa..."
          />

          <Textarea
            label="Descrição"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={2}
            placeholder="Detalhes opcionais..."
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#737373] mb-1.5 uppercase tracking-wide">
                Prioridade
              </label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#737373] mb-1.5 uppercase tracking-wide">
                Status
              </label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_fazer">A fazer</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="revisao">Revisão</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date + Time on the same row */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data"
              type="date"
              value={form.due_date}
              onChange={e => set('due_date', e.target.value)}
            />
            <div>
              <label className="block text-[11px] font-medium text-[#737373] mb-1.5 uppercase tracking-wide">
                Horário
              </label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#c0c0c0] pointer-events-none" />
                <input
                  type="time"
                  value={form.due_time}
                  onChange={e => set('due_time', e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-[#e0e0e0] bg-white text-[13px] text-[#0f0f0f] focus:outline-none focus:border-[#b0b0b0] tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Responsável"
              value={form.assignee}
              onChange={e => set('assignee', e.target.value)}
              placeholder="Nome..."
            />
            <div>
              <label className="block text-[11px] font-medium text-[#737373] mb-1.5 uppercase tracking-wide">
                Cliente (opcional)
              </label>
              <Select
                value={form.client_id || '__none__'}
                onValueChange={v => set('client_id', v === '__none__' ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem cliente</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !form.title.trim()}
          >
            {saving
              ? (isEdit ? 'Salvando...' : 'Criando...')
              : (isEdit ? 'Salvar alterações' : 'Criar tarefa')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Tasks() {
  const { user } = useAuth()
  const { data: tasks = [], isLoading } = useTasks()
  const { data: clients = [] } = useClients()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { toast } = useToast()

  // Week navigation
  const [weekBase, setWeekBase]   = useState(() => new Date())
  const weekStart = startOfWeek(weekBase, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(weekBase,   { weekStartsOn: 1 })
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Dialog state — handles both create and edit
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [prefillDate, setPrefillDate] = useState('')

  const weekLabel = `${format(weekStart, "d 'de' MMM", { locale: ptBR })} – ${format(weekEnd, "d 'de' MMM", { locale: ptBR })}`

  // Tasks by day — sorted by due_time (nulls last)
  const tasksByDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    return tasks
      .filter(t => t.due_date?.startsWith(dayStr))
      .sort((a, b) => {
        if (!a.due_time && !b.due_time) return 0
        if (!a.due_time) return 1
        if (!b.due_time) return -1
        return a.due_time.localeCompare(b.due_time)
      })
  }

  const tasksWithoutDate = tasks.filter(t => !t.due_date)

  // Drag and drop — updates due_date
  const handleDropOnDay = async (taskId: string, day: Date) => {
    const task = tasks.find(t => t.id === taskId)
    const dateStr = format(day, 'yyyy-MM-dd')
    if (!task || task.due_date?.startsWith(dateStr)) return
    try {
      await updateTask.mutateAsync({ id: taskId, due_date: dateStr })
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  // Status change from card pill
  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status })
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  // Delete
  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync(taskId)
      toast('Tarefa removida.', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  // Open create dialog pre-filled to a day
  const handleAddTask = (day: Date) => {
    setEditingTask(null)
    setPrefillDate(format(day, 'yyyy-MM-dd'))
    setDialogOpen(true)
  }

  // Open create dialog without a day
  const handleNewTask = () => {
    setEditingTask(null)
    setPrefillDate('')
    setDialogOpen(true)
  }

  // Open edit dialog from card pencil
  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  // Create
  const handleCreate = async (form: TaskForm) => {
    if (!form.title.trim() || !user) return
    try {
      await createTask.mutateAsync({
        ...form,
        user_id:     user.id,
        client_id:   form.client_id || null,
        due_date:    form.due_date || null,
        due_time:    form.due_time || null,
        assignee:    form.assignee || null,
        description: form.description || null,
      })
      toast('Tarefa criada!', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
      throw err
    }
  }

  // Update
  const handleUpdate = async (taskId: string, form: TaskForm) => {
    try {
      await updateTask.mutateAsync({
        id:          taskId,
        title:       form.title.trim(),
        description: form.description || null,
        due_date:    form.due_date || null,
        due_time:    form.due_time || null,
        priority:    form.priority,
        status:      form.status,
        assignee:    form.assignee || null,
        client_id:   form.client_id || null,
      })
      toast('Tarefa atualizada!', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
      throw err
    }
  }

  const overdueCount = tasks.filter(
    t => isOverdue(t.due_date) && t.status !== 'concluido'
  ).length

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Tarefas"
        subtitle="Calendário semanal"
        action={
          <Button size="sm" onClick={handleNewTask}>
            <Plus className="w-3.5 h-3.5" /> Nova tarefa
          </Button>
        }
      />

      <div className="p-4 md:p-6 flex-1 overflow-hidden flex flex-col min-h-0">
        {/* ── Week navigation ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5 flex-shrink-0">
          <button
            onClick={() => setWeekBase(d => subWeeks(d, 1))}
            className="w-8 h-8 rounded-lg border border-white/10 bg-white/10 flex items-center justify-center text-white/50 hover:border-white/20 hover:text-white transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-white/40" />
            <span className="text-[13px] font-semibold text-white capitalize">
              {weekLabel}
            </span>
          </div>

          <button
            onClick={() => setWeekBase(d => addWeeks(d, 1))}
            className="w-8 h-8 rounded-lg border border-white/10 bg-white/10 flex items-center justify-center text-white/50 hover:border-white/20 hover:text-white transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Hoje — only shown when the current week is not visible */}
          {!days.some(d => isToday(d)) && (
            <button
              onClick={() => setWeekBase(new Date())}
              className="px-2.5 py-1 text-[11px] font-medium text-white/70 border border-white/10 bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
            >
              Hoje
            </button>
          )}

          {/* Summary */}
          <div className="ml-auto flex items-center gap-4 text-[11px] text-white/40">
            <span>{tasks.length} tarefa{tasks.length !== 1 ? 's' : ''}</span>
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <AlertCircle className="w-3 h-3" />
                {overdueCount} atrasada{overdueCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Weekly columns ──────────────────────────────────────────────── */}
        <div className="overflow-x-auto flex-1 min-h-0">
          <div className="flex gap-3 h-full" style={{ minWidth: '1190px' }}>
            {days.map(day => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                tasks={tasksByDay(day)}
                draggingId={draggingId}
                onDrop={handleDropOnDay}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onEdit={handleEditTask}
                onAddTask={handleAddTask}
              />
            ))}
          </div>
        </div>

        {/* ── Tasks without date ──────────────────────────────────────────── */}
        <NoDateSection
          tasks={tasksWithoutDate}
          draggingId={draggingId}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onEdit={handleEditTask}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId(null)}
        />
      </div>

      {/* Unified create/edit dialog */}
      <TaskDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTask(null) }}
        prefillDate={prefillDate}
        clients={clients}
        editingTask={editingTask}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
