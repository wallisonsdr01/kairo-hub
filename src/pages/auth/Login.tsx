import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'

// ── Kairo Hub wordmark ─────────────────────────────────────────────────────────

function Wordmark({
  size = 'md',
  theme = 'dark',
}: {
  size?: 'sm' | 'md' | 'lg'
  theme?: 'dark' | 'light'   // dark = texto escuro (fundo claro) | light = texto branco (fundo escuro)
}) {
  const hexSize   = { sm: 36, md: 48, lg: 72 }[size]
  const titleSize = { sm: '22px', md: '30px', lg: '46px' }[size]
  const subSize   = { sm: '10px', md: '11px', lg: '13px' }[size]
  const isLight   = theme === 'light'

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Hexagon mark com ponto coral */}
      <div className="relative" style={{ width: hexSize, height: hexSize }}>
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background: isLight
              ? 'linear-gradient(145deg, #ffffff 0%, #d0d5f0 100%)'
              : 'linear-gradient(145deg, #1a1a2e 0%, #252550 100%)',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          }}
        >
          <span style={{
            color: isLight ? '#1a1a2e' : '#ffffff',
            fontWeight: 800,
            fontSize: hexSize * 0.4,
            letterSpacing: '-0.03em',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            lineHeight: 1,
            userSelect: 'none',
          }}>
            K
          </span>
        </div>
        {/* Ponto coral */}
        <div
          className="absolute rounded-full"
          style={{
            width: hexSize * 0.2,
            height: hexSize * 0.2,
            background: '#e94560',
            top: hexSize * 0.12,
            right: hexSize * 0.14,
            boxShadow: `0 0 ${hexSize * 0.1}px rgba(233,69,96,0.6)`,
          }}
        />
      </div>

      {/* Wordmark text */}
      <div className="text-center">
        <p
          className="leading-none"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 700,
            fontSize: titleSize,
            color: isLight ? '#ffffff' : '#1a1a2e',
          }}
        >
          Kairo<span style={{ color: '#e94560', fontStyle: 'italic' }}>Hub</span>
        </p>
        <p
          style={{ fontSize: subSize, color: isLight ? 'rgba(255,255,255,0.45)' : '#a0a0a0' }}
          className="uppercase tracking-[0.26em] mt-2 font-light"
        >
          Agency Platform
        </p>
      </div>
    </div>
  )
}

// ── Login page ─────────────────────────────────────────────────────────────────

export function Login() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]       = useState(false)
  const { signIn }  = useAuth()
  const { toast }   = useToast()
  const navigate    = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      toast(
        error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos.'
          : error.message,
        'error'
      )
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel — brand identity */}
      <div className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #12122a 60%, #0e0e20 100%)' }}
      >
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        {/* Coral accent glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #e94560 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center justify-center w-full">
          <img
            src="/logo.png"
            alt="Kairo Hub"
            className="w-full max-w-[300px] object-contain select-none drop-shadow-2xl"
            draggable={false}
          />
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 bg-[#f7f7f7] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <Wordmark size="md" />
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm p-8">
            <div className="mb-7">
              <h2 className="text-[20px] font-semibold text-[#0f0f0f]">Entrar</h2>
              <p className="text-[13px] text-[#a0a0a0] mt-1">Bem-vindo de volta.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="voce@kairohub.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
                autoComplete="email"
              />

              <div className="relative">
                <Input
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-[#a0a0a0] hover:text-[#0f0f0f] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password"
                  className="text-[12px] text-[#737373] hover:text-[#0f0f0f] transition-colors">
                  Esqueci minha senha
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-xl text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed sb-invert"
                style={{ background: '#1a1a2e' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#252550')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1a1a2e')}
              >
                {loading ? 'Entrando...' : <><span>Entrar</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <p className="text-center text-[12px] text-[#a0a0a0] mt-6">
              Não tem conta?{' '}
              <Link to="/register" className="text-[#0f0f0f] font-medium hover:underline">
                Criar conta
              </Link>
            </p>
          </div>

          {/* Footer note */}
          <p className="text-center text-[11px] text-[#c0c0c0] mt-5">
            © {new Date().getFullYear()} Kairo Hub. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
