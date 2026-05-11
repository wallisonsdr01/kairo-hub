# Kairo Hub

Sistema completo de gestão para agências de marketing digital, com geração de conteúdo por IA.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion
- **UI**: Radix UI (shadcn-style) — componentes 100% customizados
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **IA**: OpenAI GPT-4o-mini
- **State**: TanStack Query (React Query)
- **Routing**: React Router v7

## Funcionalidades

- **Dashboard** — visão geral com gráficos semanais
- **Gestão de Clientes** — CRUD completo com DNA da marca
- **Gerador de IA** — conteúdo estratégico com GPT-4o-mini
- **Tendências** — serviço modular pronto para integração com APIs reais
- **Histórico** — todos os conteúdos editáveis e filtráveis
- **Planejamento** — calendário editorial visual
- **Tarefas** — kanban drag-and-drop
- **Biblioteca** — banco de ganchos, CTAs, ideias e templates

## Configuração

### 1. Instalar dependências

```bash
cd kairo-hub
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
VITE_OPENAI_API_KEY=sk-sua-chave-openai
```

### 3. Configurar banco de dados

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Crie um novo projeto
3. Vá em **SQL Editor**
4. Cole e execute o conteúdo de `supabase/migrations/001_initial.sql`
5. Copie a URL e a Anon Key nas configurações do projeto

### 4. Rodar localmente

```bash
npm run dev
```

Acesse em `http://localhost:5173`

## Estrutura do Projeto

```
src/
├── components/
│   ├── ui/          # Componentes base (Button, Input, Card, etc.)
│   └── layout/      # Sidebar, Header, Layout
├── pages/
│   ├── auth/        # Login, Register, ForgotPassword
│   ├── clients/     # Lista, Formulário, Perfil
│   ├── content/     # Gerador, Histórico
│   ├── planner/     # Calendário editorial
│   ├── tasks/       # Kanban
│   └── library/     # Biblioteca de recursos
├── hooks/           # React Query hooks
├── services/        # OpenAI, TrendService
├── integrations/    # Supabase client + types
├── types/           # TypeScript interfaces
└── utils/           # Formatters, prompts
supabase/
└── migrations/      # SQL do banco de dados
```

## Notas Importantes

- A chave OpenAI é usada no frontend (dangerouslyAllowBrowser: true). Para produção, implemente um proxy backend.
- O RLS do Supabase garante que cada usuário veja apenas seus dados.
- O TrendService é modular e pronto para integração com SerpAPI, DataForSEO, etc.
