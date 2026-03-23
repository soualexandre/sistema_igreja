# App Igreja — EBD gamificada

Monorepo com **backend NestJS** (API + Prisma + PostgreSQL), **painel web Next.js** e **app mobile Expo**, compartilhando a mesma API REST e o mesmo modelo de dados.

## Visão geral

| Pacote | Pasta | Descrição |
|--------|--------|-----------|
| **Backend** | [`backend/`](backend/) | Autenticação por papéis (admin, professor, aluno), turmas, aulas, presença com pontos, competições, **quiz em tempo real** (Socket.IO), ranking. |
| **Web** | [`web/`](web/) | Next.js (App Router): salas, turma, presença, competição ao vivo, **quiz público** em `/quiz` sem login. |
| **App mobile** | [`app-ad/`](app-ad/) | Expo/React Native: paridade de fluxos com a web onde aplicável. |

**Prefixo global da API:** todas as rotas HTTP começam com `/api` (ex.: `POST /api/auth/login`).

---

## Pré-requisitos

- **Node.js** 18+ (recomendado 20+)
- **PostgreSQL** acessível via `DATABASE_URL`
- **Yarn** ou **npm** (cada projeto documenta o gerenciador preferido)

---

## Estrutura do repositório

```
app-igreja/
├── backend/          # NestJS + Prisma
├── web/              # Next.js
├── app-ad/           # Expo
└── README.md         # Este arquivo
```

Documentação detalhada por pacote:

- [Backend — API, Prisma, seed, migrações, WebSocket](backend/README.md)
- [Web — rotas, env, proxy `/api`, quiz convidado](web/README.md)
- [App Expo — como subir o app](app-ad/README.md)

---

## Configuração rápida (desenvolvimento)

### 1. Banco de dados

No diretório **`backend/`**:

1. Crie `.env` com `DATABASE_URL` apontando para o PostgreSQL.
2. Gere o client e aplique migrações:

```bash
cd backend
yarn install
yarn prisma:generate
npx prisma migrate deploy
# ou, em projeto novo: yarn prisma:push
yarn db:seed
```

Credenciais típicas após seed (ver `backend/README.md`):

- Admin: `admin@ebd.local` / `123456`
- Professor: `prof@ebd.local` / `123456`
- Alunos: `ana@ebd.local`, `joao@ebd.local` / `123456`

### 2. Backend (API)

```bash
cd backend
yarn start:dev
```

Porta padrão: **`3333`** → API em `http://localhost:3333/api`  
(override com variável `PORT`.)

### 3. Web (Next.js)

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

Porta padrão: **`3000`** → `http://localhost:3000`

**Variáveis importantes** (`web/.env.local`):

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_API_URL` | URL completa da API até `/api`. **Opcional em dev:** se omitida, o browser usa `/api` no mesmo host e o Next faz *proxy* para o backend (`next.config.ts`). |
| `NEXT_PUBLIC_WEB_URL` | URL pública do site (**sem** barra final), para **copiar/compartilhar** o link do quiz (`/quiz`). Em prod, defina o domínio real. Se omitir, no cliente usa `window.location.origin`. |
| `NEXT_PUBLIC_API_PORT` | Porta do Nest para Socket.IO em LAN (default `3333`). |
| `BACKEND_PROXY_TARGET` | Alvo do proxy interno (default `http://127.0.0.1:3333`). |

**Celular na mesma rede (Wi‑Fi):** suba o Next com host aberto e, se o Next avisar, inclua o IP em `allowedDevOrigins` em `web/next.config.ts`.

```bash
npm run dev -- -H 0.0.0.0
```

### 4. App mobile (Expo)

```bash
cd app-ad
npm install
npx expo start
```

Configure a URL da API no `.env` do app (ex.: `EXPO_PUBLIC_API_URL`), apontando para a máquina que roda o backend (em rede local use o IP da máquina, não `localhost`, no dispositivo físico).

---

## Fluxos principais

### Autenticação e papéis

- Registro/login; JWT nas rotas protegidas (`Authorization: Bearer …`).
- Papéis: **admin**, **teacher**, **student** — permissões por módulo (turmas, usuários, presença, competição, etc.).

### Turmas, aulas e presença

- CRUD de turmas; alunos vinculados; aulas com horário (`Lesson.startsAt`).
- Presença gera **eventos de pontos** auditáveis (presença, pontualidade, participação, bônus).
- Detalhes e variáveis de ambiente de pontuação: `backend/README.md`.

### Competição e quiz ao vivo (logado)

1. Professor/admin cria **competições** e **perguntas** (aba Perguntas na competição).
2. Na aba **Ao vivo**: escolhe a turma, **gera o PIN** da sessão, inicia perguntas, pausa/retoma, encerra.
3. Alunos **logados** (app ou web) entram com o código da sala; convidados usam a rota pública (abaixo).

### Quiz público (sem cadastro) — Web

- Rota: **`/quiz`** (fora do *layout* logado).
- Fluxo: **PIN** → **nome** → entrar na sala → responder com timer e feedback de acerto/erro.
- API pública: `join-guest`, `answer-guest`, `state-guest` (sem token).
- Na área do professor há **painel para copiar/compartilhar** o link completo do quiz; a base vem de `NEXT_PUBLIC_WEB_URL`.

### Tempo real (Socket.IO)

- Mesma origem do backend (porta do Nest) para eventos `session:join`, `session:answer`, `session:state`.
- O quiz convidado funciona com **polling** se o WebSocket não conectar.

### Ranking ao fim do quiz

- Ordenação: **mais acertos primeiro**; em empate, **menor soma de tempo (ms)** nas respostas **corretas** (só contabiliza tempo nas questões acertadas).
- Respostas armazenam `{ selectedOptionIndex, elapsedMs }`; dados antigos só com índice usam o limite da pergunta como tempo conservador nesse cálculo.
- Alunos logados continuam podendo receber **pontos** em `PointEvent` conforme a regra antiga de bônus por velocidade; a **tabela exibida** do quiz segue a lógica de tempo + acertos.

---

## Produção — checklist

1. **PostgreSQL** com migrações aplicadas (`prisma migrate deploy`).
2. **Backend:** `DATABASE_URL`, `PORT` se necessário, CORS já reflete origem (`origin: true`).
3. **Web:**  
   - `NEXT_PUBLIC_API_URL` se a API estiver em outro domínio.  
   - `NEXT_PUBLIC_WEB_URL` com a URL **pública** do front (links do `/quiz`).  
   - Build: `npm run build` + `npm start` (ou plataforma tipo Vercel).
4. **App:** variáveis `EXPO_PUBLIC_*` apontando para a API em produção.

---

## Problemas comuns

| Sintoma | O que verificar |
|---------|------------------|
| Erro ao **gerar PIN** (`guest_participants` / Prisma) | Rodar migração `20260321120000_quiz_guest_participants` — ver `backend/README.md`. |
| Quiz no **celular** não conecta à API | Em dev: proxy `/api` do Next; `NEXT_PUBLIC_WEB_URL` e IP da máquina; Next com `-H 0.0.0.0`; firewall. |
| Next avisa **allowedDevOrigins** | Incluir o host/IP em `web/next.config.ts`. |
| `migrate deploy` / P3005 | SQL manual + `prisma migrate resolve` — seção migrações no `backend/README.md`. |

---

## Scripts úteis (resumo)

```bash
# Backend
cd backend && yarn start:dev

# Web
cd web && npm run dev

# App
cd app-ad && npx expo start
```

---

## Licença e contribuição

Ajuste esta seção conforme a licença do projeto (privado, MIT, etc.) e o fluxo de PRs da sua equipe.

Para detalhes de endpoints, modelos Prisma e seeds, use sempre os **READMEs dentro de `backend/`**, **`web/`** e **`app-ad/`**.
