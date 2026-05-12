import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { PlannerItem } from '@/types'

export function usePlanner(clientId?: string) {
  return useQuery({
    queryKey: ['planner', clientId],
    queryFn: async () => {
      let q = supabase
        .from('planner')
        .select('*, client:clients(id,company_name), attachments:planner_attachments(id,file_name,file_type,file_url,file_size,created_at), links:planner_links(id,url,label,created_at)')
        .order('scheduled_date', { ascending: true })
      if (clientId) q = q.eq('client_id', clientId)
      const { data, error } = await q
      if (error) throw error
      return data as PlannerItem[]
    },
  })
}

export function useCreatePlannerItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: Omit<PlannerItem, 'id' | 'created_at' | 'updated_at' | 'client'>) => {
      const { data, error } = await supabase.from('planner').insert(item as any).select().single()
      if (error) throw error
      return data as PlannerItem
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planner'] }),
  })
}

export function useUpdatePlannerItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlannerItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('planner')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PlannerItem
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planner'] }),
  })
}

export function useDeletePlannerItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Busca os anexos para deletar do storage também
      const { data: attachments } = await supabase
        .from('planner_attachments')
        .select('id, file_url')
        .eq('planner_id', id)

      // 2. Remove arquivos do storage
      if (attachments && attachments.length > 0) {
        const paths = attachments
          .map(a => {
            try {
              const url = new URL(a.file_url)
              // extrai o path após "/object/public/planner-attachments/"
              const match = url.pathname.match(/\/object\/public\/planner-attachments\/(.+)/)
              return match ? match[1] : null
            } catch { return null }
          })
          .filter(Boolean) as string[]

        if (paths.length > 0) {
          await supabase.storage.from('planner-attachments').remove(paths)
        }
      }

      // 3. Deleta registros filhos (links, anexos, comentários)
      await supabase.from('planner_links').delete().eq('planner_id', id)
      await supabase.from('planner_attachments').delete().eq('planner_id', id)
      await supabase.from('planner_comments').delete().eq('planner_id', id)

      // 4. Deleta o item principal
      const { error } = await supabase.from('planner').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planner'] }),
  })
}
