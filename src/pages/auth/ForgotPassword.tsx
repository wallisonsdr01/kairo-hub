import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { resetPassword } = useAuth()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) toast(error.message, 'error')
    else setSent(true)
  }

  return (
    <div className="min-h-screen bg-[#0a0c11] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[#0d0f14]/90 backdrop-blur-xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 flex items-center justify-center mb-4" style={{ background: 'linear-gradient(145deg, #1a1a2e 0%, #252550 100%)', borderRadius: '16px', boxShadow: '0 8px 24px rgba(26,26,46,0.5)' }}>
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Recuperar senha</h1>
            <p className="text-sm text-gray-400 mt-1 text-center">
              {sent ? 'Email enviado! Verifique sua caixa de entrada.' : 'Informe seu email para receber o link de redefinição.'}
            </p>
          </div>

          {!sent && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="voce@kairohub.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
              />
              <Button type="submit" variant="premium" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link'}
              </Button>
            </form>
          )}

          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white mt-6">
            <ArrowLeft className="w-4 h-4" /> Voltar ao login
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
