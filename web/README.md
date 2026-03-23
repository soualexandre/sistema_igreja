# Web (Next.js) — paridade com `app-ad` (Expo)

App Router + TypeScript + Tailwind v4. Consome a mesma API Nest (`/api` como prefixo global), com tokens visuais espelhados de `app-ad/constants/app-theme.ts` (CSS variables em `src/app/globals.css`).

**Layout (mobile-first):** a barra inferior replica o Expo (`app-ad/app/(tabs)/_layout.tsx`): **três abas** — Salas, Competição, Perfil — com ícone ~26px, label 11px / peso 700, cores accent / mutedDark. **Pedidos** e **Usuários** não entram na tab bar; ficam no **header desktop** e na tela **Perfil**. O **menu da conta** (avatar + nome) no header desktop e no header da turma permite **ver/editar perfil** e **sair**, para qualquer papel.

## Variáveis de ambiente

Crie `.env.local` (veja `.env.local.example`):

```bash
# Produção (API em outro domínio):
NEXT_PUBLIC_API_URL=https://seu-backend.com/api

# URL pública do front (para copiar/compartilhar o link do /quiz). Sem barra final.
# Dev na LAN: http://192.168.0.54:3000  |  Prod: https://app.seudominio.com
NEXT_PUBLIC_WEB_URL=http://localhost:3000

# Docker / backend com outro host (só o servidor Next usa isso):
# BACKEND_PROXY_TARGET=http://127.0.0.1:3333

# Porta do Nest se não for 3333 (Socket.IO em LAN ainda usa este host:porta):
# NEXT_PUBLIC_API_PORT=3333
```

**Celular na mesma rede (dev):** sem `NEXT_PUBLIC_API_URL`, o browser chama **`/api` no mesmo host do Next** (ex. `http://192.168.0.54:3000/api/...`). O Next **encaminha** para o Nest em `127.0.0.1:3333` — o celular **não** precisa conseguir abrir a porta 3333 no PC (firewall). Rode: `npm run dev -- -H 0.0.0.0`. Em `next.config.ts`, inclua o IP do PC em `allowedDevOrigins` se o Next avisar.

## Scripts

```bash
npm install
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

## Estrutura principal

| Área | Rotas |
|------|--------|
| Auth | `/login`, `/register` (barra superior igual ao app logado) |
| Salas (home) | `/` |
| Perfil | `/profile` |
| Pedidos *(professor + admin)* | `/pedidos` — pedidos de acesso pendentes |
| Usuários *(só admin)* | `/users` — lista de contas da igreja |
| Turma | `/class/[classId]`, `.../students`, `.../attendance`, `.../access` → redireciona para students |
| Competição | `/competition` (professor: lista), `/competition/[competitionId]` (gerir ao vivo) |
| **Quiz convidado (público)** | `/quiz` — **sem login**: PIN + nome; mesma API/Socket do backend (`join-guest`, `answer-guest`, `state-guest`) |

**Mobile:** só as 3 abas do app. **Desktop:** barra superior = Salas, Competição + **Pedidos** (professor/admin) + **Usuários** (admin) + **menu de perfil** (todas as contas).

Auth: Zustand + `persist` em `localStorage` (`src/stores/auth-store.ts`), equivalente ao `AsyncStorage` do Expo.

HTTP: módulos em `src/lib/*-api.ts` (mesmos endpoints que `app-ad/lib`).

Realtime quiz: `socket.io-client` via `src/hooks/use-quiz-socket.ts` + polling de fallback (`realtimeApi.getSessionState`).

## Paridade / limites

- **Attendance**: fluxo web espelha o essencial (staff, lição, CPAD, lista com `React.memo`); telas muito grandes no Expo podem ter diferenças de UX.
- **Socket**: apenas no cliente; mesma origem/CORS que o gateway Nest já configurado.

## Monorepo

Pasta `web/` é irmã de `app-ad/` e `backend/`. Workspaces na raiz são opcionais.
