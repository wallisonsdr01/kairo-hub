import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from './useAuth'
import type { Client, PlannerItem, Content, ApprovalStatus, ClientMaterial, ClientSupportContact, ContentAsset, BrandDNA } from '@/types'
import type { ClientPayment } from './usePayments'

function useIsPortalClient() {
  const { profile } = useAuth()
  return profile?.role === 'client' && !!profile?.linked_client_id
}

export function usePortalClient() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-client', profile?.linked_client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', profile!.linked_client_id!)
        .single()
      if (error) throw error
      return data as Client
    },
    enabled: isClient,
  })
}

export function usePortalPlanner() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-planner', profile?.linked_client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planner')
        .select(
          '*, client:clients(id,company_name), attachments:planner_attachments(id,file_name,file_type,file_url,file_size,created_at), links:planner_links(id,url,label,created_at)'
        )
        .eq('client_id', profile!.linked_client_id!)
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return data as PlannerItem[]
    },
    enabled: isClient,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
}

export function usePortalContents() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-contents', profile?.linked_client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contents')
        .select('*')
        .eq('client_id', profile!.linked_client_id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Content[]
    },
    enabled: isClient,
  })
}

export function usePortalContentAssets() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-content-assets', profile?.linked_client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_assets')
        .select('*')
        .eq('client_id', profile!.linked_client_id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ContentAsset[]
    },
    enabled: isClient,
  })
}

export function usePortalBrandDNA() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-brand-dna', profile?.linked_client_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('brand_dna')
        .select('*')
        .eq('client_id', profile!.linked_client_id!)
        .maybeSingle()
      return data as BrandDNA | null
    },
    enabled: isClient,
  })
}

export function usePortalMaterials() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-materials', profile?.linked_client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_materials')
        .select('*')
        .eq('client_id', profile!.linked_client_id!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ClientMaterial[]
    },
    enabled: isClient,
  })
}

export function usePortalSupportContacts() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-support', profile?.linked_client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_support_contacts')
        .select('*')
        .eq('client_id', profile!.linked_client_id!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as ClientSupportContact[]
    },
    enabled: isClient,
  })
}

export function usePortalReports() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-reports', profile?.linked_client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_reports')
        .select('*, attachments:report_attachments(*)')
        .eq('client_id', profile!.linked_client_id!)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: isClient,
  })
}

export function usePortalPayments() {
  const { profile } = useAuth()
  const isClient = useIsPortalClient()

  return useQuery({
    queryKey: ['portal-payments', profile?.linked_client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_payments')
        .select('*')
        .eq('client_id', profile!.linked_client_id!)
        .order('payment_date', { ascending: false })
      if (error) throw error
      return data as ClientPayment[]
    },
    enabled: isClient,
  })
}

export function useSubmitApproval() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      plannerId,
      approval_status,
      client_feedback,
    }: {
      plannerId: string
      approval_status: ApprovalStatus
      client_feedback: string
    }) => {
      const { error } = await supabase
        .from('planner')
        .update({
          approval_status,
          client_feedback: client_feedback.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq('id', plannerId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-planner'] })
    },
  })
}
