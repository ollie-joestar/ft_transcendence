*This project has been created as part of the 42 curriculum by hanjkim, oohnivch, dplotzl, dvavryn.*

# SAKURA DRIFT — ft_transcendence

---

## Table of Contents

- [Description](#description)
- [Team Information](#team-information)
- [Project Management](#project-management)
- [Technical Stack](#technical-stack)
- [Modules](#modules)
- [Features List](#features-list)
- [Database Schema](#database-schema)
- [Architecture overview](#architecture-overview)
- [Container breakdown](#container-breakdown)
- [Instructions](#instructions)
- [Connecting via the browser](#connecting-via-the-browser)
- [Environment differences](#environment-differences)
- [CI/CD pipeline](#cicd-pipeline)
- [Project structure](#project-structure)
- [Individual Contributions](#individual-contributions)
- [Resources](#resources)

---

## Description

***ft_transcendence*** is the final common-core project at 42. The goal is to build a fully functional single-page web application — with a frontend, backend, and database — featuring a real-time multiplayer game, secure user authentication, leaderboards, and a set of optional modules covering web, cybersecurity, AI, and advanced 3D graphics.

Our implementation is **Sakura Drift** — a 3D low-poly arcade racing game where players compete on tracks in real time, challenge an AI opponent, or race against other players online. The backend is built with NestJS and PostgreSQL, while the frontend uses React, Vite, Three.js (via React Three Fiber) for 3D rendering, and the Rapier physics engine for vehicle dynamics. Real-time multiplayer is powered by PlayroomKit. An OWASP ModSecurity WAF protects the application at the edge, and HashiCorp Vault manages secrets securely in production. The AI opponent runs client-side in the browser, computing steering and throttle each tick from the live race state.

### Key features

- **3D real-time racing game** — drive low-poly cars across 4 tracks, rendered with Three.js / React Three Fiber and driven by the Rapier physics engine.
- **Custom 3D car model** — the car is an original asset modeled from scratch in Blender and integrated into the game engine.
- **Online multiplayer** — race up to 8 players on separate machines in real time via PlayroomKit, with a spectator mode for overflow connections.
- **Game customization** — choose between 4 maps, 2 color schemes, and a configurable lap count.
- **AI opponent** — a client-side bot that computes steering/throttle each tick and behaves like a human racer.
- **User accounts** — secure email + password authentication (hashed, salted) with JWT access and refresh tokens.
- **Social features** — user profiles, a friends system (requests / accept / remove), and a chat system.
- **Leaderboards & stats** — per-track leaderboards, personal race history, per-user statistics and percentile ranking.
- **Internationalization** — UI available in English, German, and Japanese with an in-app language switcher.
- **Hardened deployment** — OWASP ModSecurity WAF at the edge and HashiCorp Vault for secrets management in production.
- **Privacy Policy & Terms of Service** — accessible from the home page footer and the registration form.

---

## Team Information

| Login      | Name           | Git identity                          | Role(s)                                     |
|------------|----------------|---------------------------------------|---------------------------------------------|
| hanjkim    | Hanju Kim      | `hanjkim@student.42vienna.com`               | Project Manager / Scrum Master · Developer  |
| oohnivch   | Oleh Ohnivchuk  | `oohnivch@student.42vienna.com`              | Product Owner (PO) · Developer              |
| dplotzl    | Daniel Plötzl  | `dplotzl@student.42vienna.com`        | Technical Lead / Architect · Developer      |
| dvavryn    | Dominic Vavryn | `dvavryn@student.42vienna.com`               | Operations Officer · Developer              |

### Responsibilities

- **hanjkim — Project Manager / Scrum Master & Developer:** organised team meetings and
  planning, tracked progress and deadlines, kept communication flowing and managed
  blockers, while also implementing features as a developer.
- **oohnivch — Product Owner & Developer:** owned the product vision and feature
  prioritisation, maintained the backlog and validated completed work, and contributed as
  a developer.
- **dplotzl — Technical Lead / Architect & Developer:** owned the technical architecture
  and tech-stack decisions, upheld code quality and reviewed critical changes, and
  implemented features.
- **dvavryn — Operations Officer & Developer:** owned the DevOps/infrastructure side
  (containerisation, deployment, CI/CD, WAF/Vault operations) and contributed as a
  developer.

---

## Project Management

**How the work was organized.** Work was divided **by area of specialty** — each member
owned a domain of the project (e.g. the game, backend, frontend, and
infrastructure/DevOps) and drove the features and modules within it end-to-end. The team
synced **ad hoc** — meeting whenever a decision, blocker, or integration point came up
rather than on a fixed cadence — which suited a small, co-located team.

**Project management tools.** Tasks were tracked with **GitHub Issues** and **GitHub
Projects**, keeping the backlog and in-progress work tied directly to the repository.

**Communication channels.** The team communicated over **Discord** and **WhatsApp** for
quick coordination, and **in person** on campus at 42 for deeper discussions and
integration work.

---

## Technical Stack

| Layer          | Technology                                      |
|----------------|-------------------------------------------------|
| Frontend       | React 19, Vite, TypeScript, Tailwind CSS v4     |
| 3D / Physics   | Three.js, React Three Fiber, Rapier (`@dimforge/rapier3d-compat`) |
| Real-time      | PlayroomKit (browser ↔ browser multiplayer)     |
| Backend        | NestJS, TypeScript                              |
| Database       | PostgreSQL 18, Prisma ORM                       |
| AI opponent    | Client-side (in-browser, per-tick steering)     |
| Proxy / WAF    | NGINX + ModSecurity CRS (OWASP image)           |
| Secrets        | HashiCorp Vault (prod), env vars (dev)          |
| Deployment     | Docker Compose (prod + dev)                     |
| CI/CD          | GitHub Actions                                  |

### Justification for major technical choices

- **React (frontend framework):** mature ecosystem, component model, and first-class
  support for `react-three-fiber`, which lets us drive the Three.js scene declaratively
  alongside the rest of the UI.
- **NestJS (backend framework):** opinionated, modular architecture (controllers /
  services / modules) that keeps auth, users, friends, chat, lobbies, and race-results
  cleanly separated and testable.
- **PostgreSQL + Prisma:** a relational database fits our well-defined entities and
  relationships (users, friendships, matches, messages, race results, lobbies); Prisma
  gives us a typed schema, migrations, and an ORM in one toolchain.
- **Three.js + Rapier:** Three.js / R3F for advanced 3D rendering and Rapier for
  deterministic, performant vehicle physics in the browser.
- **PlayroomKit:** lets us synchronize live races browser-to-browser without operating a
  dedicated game relay server; the backend only persists results and lobby metadata.
- **ModSecurity (OWASP CRS) + HashiCorp Vault:** a hardened WAF at the edge plus a single
  source of truth for runtime secrets, satisfying the Cybersecurity module.

---

## Modules

The project requires **14 points** (Major = 2 pts, Minor = 1 pt). We implement well beyond
that — **9 Major** and **6 Minor** modules — giving a large buffer in case a module is not
validated during evaluation.

> **Note on the bonus cap:** per the subject, the bonus part is capped at **+5 points**
> (14 mandatory + 5 bonus = **19 effective points** maximum). We exceed this deliberately so
> that the 14 mandatory points are never at risk, and we lead with the cleanest, most
> clearly-functional modules during evaluation.

| Category        | Module                                              | Type  | Points | Owner(s)                     |
|-----------------|-----------------------------------------------------|-------|--------|------------------------------|
| Web             | Framework for **both** frontend (React) and backend (NestJS) | Major | 2 | hanjkim, oohnivch, dvavryn |
| Web             | User interaction — chat + profile + friends         | Major | 2      | hanjkim, oohnivch, dvavryn   |
| Web             | Use an ORM for the database (Prisma)                | Minor | 1      | hanjkim, oohnivch, dvavryn   |
| Cybersecurity   | WAF / ModSecurity (hardened) + HashiCorp Vault      | Major | 2      | dplotzl                      |
| Artificial Intelligence | AI opponent for the game (client-side)      | Major | 2      | dvavryn                      |
| Gaming & UX     | Complete web-based game (Sakura Drift)              | Major | 2      | oohnivch                     |
| Gaming & UX     | Advanced 3D graphics (Three.js / R3F)              | Major | 2      | oohnivch                     |
| Gaming & UX     | Remote players (real-time play across machines)    | Major | 2      | oohnivch                     |
| Gaming & UX     | Multiplayer game — more than two players (up to 8 racers) | Major | 2 | oohnivch                  |
| Gaming & UX     | Game customization (4 maps, 2 color schemes, lap count) | Minor | 1   | oohnivch, hanjkim            |
| Gaming & UX     | Spectator mode                                      | Minor | 1      | oohnivch                     |
| User Management | Game statistics & match history                    | Minor | 1      | oohnivch                     |
| Accessibility & i18n | Multiple languages (EN / DE / JA)             | Minor | 1      | hanjkim                      |
| Accessibility & i18n | Support for additional browsers               | Minor | 1      | hanjkim                      |
| Modules of choice | Custom 3D car model authored in Blender          | Major | 2      | dvavryn                      |
| **Total**       |                                                     |       | **24** |                              |

### Module justification & implementation

- **Web — Framework (Major)** *(hanjkim, oohnivch, dvavryn)*: React + Vite frontend and a
  NestJS backend, satisfying the "framework for both frontend and backend" major.
- **Web — User interaction (Major)** *(hanjkim, oohnivch, dvavryn)*: a chat system, a
  profile system (view user info), and a friends system (add/remove, friend requests,
  friends list). Implemented in the `chat/`, `users/`, and `friends/` backend modules and
  the matching frontend panels.
- **Web — ORM (Minor)** *(hanjkim, oohnivch, dvavryn)*: Prisma is used for all database
  access, schema, and migrations.
- **Cybersecurity — WAF + Vault (Major)** *(dplotzl)*: ModSecurity (OWASP CRS) runs at the
  edge nginx in blocking mode; HashiCorp Vault stores and renders all runtime secrets in
  production. In v21.1 these are a **single** combined major worth 2 points.
- **AI — AI opponent (Major)** *(dvavryn)*: `calculateAI.ts` computes steering/throttle
  from the live race state each tick; `useBotBridge.ts` wires the bot into the PlayroomKit
  session so it races like another player. Runs entirely client-side.
- **Gaming — Web-based game (Major)** *(oohnivch)*: Sakura Drift, a 3D racing game with
  clear rules and win conditions (lap times / finishing order).
- **Gaming — Advanced 3D graphics (Major)** *(oohnivch)*: an immersive 3D environment
  rendered with Three.js via React Three Fiber.
- **Gaming — Remote players (Major)** *(oohnivch)*: two or more players on separate
  computers race the same game in real time over PlayroomKit, with disconnection handling.
- **Gaming — Multiplayer game, 3+ players (Major)** *(oohnivch)*: a single race supports
  **more than two players simultaneously** — up to **8 racers** (`MAX_RACERS = 8`), with
  fair mechanics and synchronization across all clients; further connections join as
  spectators.
- **Gaming — Game customization (Minor)** *(oohnivch, hanjkim)*: **4 selectable tracks**
  (Tengu, Kirin, Orochi, Raijin), **2 color schemes**, and a lap-count selector, all with
  sensible defaults.
- **Gaming — Spectator mode (Minor)** *(oohnivch)*: when a race is at its racer cap,
  additional users join the live session as **spectators** and watch the ongoing race with
  real-time updates (the minimap and HUD render the race without an own-player car).
- **User Management — Game statistics & match history (Minor)** *(oohnivch)*: per-track
  leaderboards, personal race history, per-user stats and percentile ranking
  (`race-results/` module).
- **i18n — Multiple languages (Minor)** *(hanjkim)*: EN / DE / JA translations in
  `frontend/src/locales/`, with an in-app language switcher; all user-facing text is keyed.
- **i18n — Support for additional browsers (Minor)** *(hanjkim)*: the app is tested for
  full compatibility on browsers beyond Chrome (e.g. Firefox / Safari), with consistent
  UI/UX. *(Confirm during evaluation that 2+ additional browsers are tested and any
  browser-specific limitations are documented.)*
- **Modules of choice — Custom 3D car model in Blender (Major)** *(dvavryn)*: rather than
  using an off-the-shelf asset, the car model raced in-game was modeled from scratch in
  **Blender** (~40 hours of work) and integrated into the Three.js / R3F scene. The
  technical value is the full asset pipeline — modeling, UVs/materials, export, and
  in-engine integration so the model works with the Rapier physics and rendering.

> **Note — module at risk (not counted):** A **Gamification (Minor)** module is *not*
> included in the total above. The subject requires **at least 3** of {achievements,
> badges, leaderboards, XP/level, daily challenges, rewards}; the project currently has a
> competitive **leaderboard** (1 mechanic), which is already counted under *Game statistics
> & match history*. To claim gamification as a separate point, add at least two more
> mechanics (e.g. achievements/badges or an XP/level system) with persistence and visual
> feedback.

> **Note — Standard User Management (Major), not counted:** this module requires
> **avatar upload** (no avatar field exists in the schema) and **seeing friends' online
> status** (online/offline tracking was removed). Re-adding both would let you claim +2.

---

## Features List

| Feature                     | Description                                                                 | Owner(s)                   |
|-----------------------------|-----------------------------------------------------------------------------|----------------------------|
| Authentication              | Register / login with hashed+salted passwords, JWT access & refresh tokens  | hanjkim, oohnivch, dvavryn |
| User profiles               | Public profile pages, profile data, user search                            | hanjkim, oohnivch, dvavryn |
| Friends system              | Send/accept friend requests, list friends, remove friends                  | hanjkim, oohnivch, dvavryn |
| Chat                        | Send/receive messages between users                                        | hanjkim, oohnivch, dvavryn |
| 3D racing game              | Three.js + Rapier low-poly racing across 4 tracks                          | oohnivch                   |
| Custom 3D car model         | Car asset modeled from scratch in Blender (~40h) and integrated in-engine  | dvavryn                    |
| Online multiplayer          | Real-time racing across machines via PlayroomKit (up to 8 racers) + lobby  | oohnivch                   |
| Spectator mode              | Overflow connections watch the live race as spectators                     | oohnivch                   |
| Game customization          | 4 maps, 2 color schemes, lap-count selector with defaults                  | oohnivch, hanjkim          |
| AI opponent                 | Client-side bot computing steering/throttle each tick                      | dvavryn                    |
| Race results & stats        | Record races/laps, personal history, per-user stats, percentile            | oohnivch                   |
| Leaderboards                | Public per-track leaderboard ranked by best lap                            | oohnivch                   |
| Internationalization        | EN / DE / JA with in-app language switcher                                 | hanjkim                    |
| Theming                     | Theme provider / settings menu                                             | hanjkim                    |
| Background music            | Looping background music on the home page                                  | hanjkim                    |
| About pages                 | About Us and About Game informational pages                               | hanjkim                    |
| WAF (ModSecurity)           | OWASP CRS at the edge, blocking mode, JSON audit logging                   | dplotzl                    |
| Secrets management (Vault)  | Vault server + agent rendering `/secrets/backend.env` in prod              | dplotzl                    |
| Privacy Policy & ToS        | Dedicated pages, linked from home footer and registration                  | hanjkim                    |

---

## Database Schema

The Prisma schema (`backend/prisma/schema.prisma`) defines six models on PostgreSQL:

| Table        | Purpose                                              | Key relationships                          |
|--------------|------------------------------------------------------|--------------------------------------------|
| `User`       | Accounts — username, email, hashed password          | 1—N `Message`, `RaceResult`; M—N via `Friendship` |
| `Friendship` | Friend relationships and request status              | references two `User`s (requester/addressee) |
| `Match`      | Match records                                        | references `User`s                          |
| `Message`    | Chat messages                                        | belongs to a sender `User`                  |
| `RaceResult` | Per-player race results — times, ranks, lap data     | belongs to a `User`                         |
| `Lobby`      | Lobby metadata keyed by the PlayroomKit room code    | tracks active rooms                         |

> The authoritative schema, including exact field names and data types, lives in
> `backend/prisma/schema.prisma`. See it for the full column-level definition.

---

## Architecture overview

```
Browser
  │
  ▼
NGINX + ModSecurity WAF  (OWASP CRS — edge, TLS termination)
  │
  ├── /api/*        ──▶  NestJS backend  ──▶  PostgreSQL
  └── /*            ──▶  Frontend nginx  (React SPA static files)
                              │
                         Browser JS (Three.js + Rapier game)
                              │
                              ├── PlayroomKit (real-time multiplayer)
                              └── Client-side AI opponent
```

**Secrets flow (production only):**

```
Vault (HashiCorp)
  └── vault-init  (seeds JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_URL)
        └── vault-agent  (renders /secrets/backend.env into shared volume)
              └── backend  (sources /secrets/backend.env at startup via ENTRYPOINT.sh)
```

---

## Container breakdown

### `nginx`
**Image:** `owasp/modsecurity-crs:nginx-alpine`

The single public entry point. Handles TLS termination, HTTP → HTTPS redirect, and routes traffic to frontend and backend. ModSecurity runs at Paranoia Level 1 (blocking) with JSON audit logging. Config is mounted as a template and rendered at startup by the OWASP image's envsubst mechanism — this preserves the ModSecurity wiring that would be lost if `nginx.conf` were overwritten directly.

Routes:
- `GET /nginx-health` — health check (bypasses WAF rules)
- `/api/*` — proxied to `backend:3000`, `/api` prefix stripped before forwarding
- `/*` — proxied to `frontend:80` (inner nginx serving React SPA)

**Disabled in dev.** Vite serves directly on `:5173`.

---

### `vault`
**Image:** custom `transcendence-vault` (built from `./vault/Dockerfile`)

Runs in production server mode with file-backed persistent storage and TLS enabled. Vault is the single source of truth for all runtime secrets — no secrets are written to disk outside the Vault volume or the `/secrets` shared volume.

**Disabled in dev.** Secrets are injected directly as environment variables.

---

### `vault-init`
**Image:** `transcendence-vault` (reused)

One-shot bootstrap container. Runs after Vault starts, waits for readiness, then:
1. Initialises and unseals Vault (if first run) — writes unseal keys and root token to `vault_bootstrap` volume
2. Generates `JWT_SECRET` and `JWT_REFRESH_SECRET` via Vault's random API
3. Constructs `DATABASE_URL` from `.env` values
4. Writes all three to `secret/data/backend` in Vault KV v2

`restart: no` — runs once and exits. Subsequent restarts are no-ops if the secret already exists.

**Disabled in dev.**

---

### `vault-agent`
**Image:** `transcendence-vault` (reused)

Long-running sidecar. Authenticates to Vault using the root token written by `vault-init`, reads `secret/data/backend`, and renders the Consul template (`backend.env.ctmpl`) to `/secrets/backend.env` on the shared `secrets_vol` volume. Re-renders automatically on secret rotation.

Backend mounts `secrets_vol` read-only — it never talks to Vault directly.

**Disabled in dev.**

---

### `frontend`
**Build context:** project root (`.`)
**Dockerfile:** `frontend/Dockerfile`

**Production target (`production`):**
Multi-stage build. Stage 1 runs `npm run build` inside Node 24 Alpine and outputs to `/app/dist`. Stage 2 copies the built assets into `nginx:1.29-alpine` with a custom SPA vhost config (`nginx/conf/nginx.spa.conf`) that handles React Router fallback and asset caching. No TLS — this container is internal only, reachable solely via the OWASP nginx over `app_network`.

**Dev target (`dev`):**
Plain Node image. Source is mounted as a volume (`./frontend:/app`). Runs the Vite dev server on `:5173` with HMR enabled. Vite talks to the backend directly at `http://localhost:3000` (set via `VITE_API_URL`; routes are at the root, so there is no `/api` prefix in dev — that prefix only exists at the prod edge nginx, which strips it).

---

### `backend`
**Build context:** `./backend`
**Dockerfile:** `backend/Dockerfile`

NestJS application. Handles authentication (JWT + refresh tokens), user profiles, friends, chat, lobbies, match history, and race-result recording. Real-time race synchronisation happens browser-to-browser via PlayroomKit — the backend persists results and lobby metadata rather than relaying live game traffic.

At startup, `ENTRYPOINT.sh` checks for `/secrets/backend.env`:
- **If present (prod):** sources the file to load `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL` rendered by Vault Agent
- **If absent (dev):** falls through to environment variables set directly in `docker-compose.dev.yml`

Prisma runs migrations automatically on startup before the Node process is exec'd.

**Dev target** adds watch mode (`nest start --watch`) and mounts source as a volume.

Routes are served at the root; the edge nginx strips the `/api` prefix before forwarding (there is no `setGlobalPrefix` in the app).

Key endpoints:
- `GET /health` — liveness check
- `POST /auth/register` — create account
- `POST /auth/login` — returns JWT + refresh token
- `GET /auth/profile` — current authenticated user (protected)
- `GET /users/:username/profile` — public profile by username
- `GET /users/search?q=` — user search (protected)
- `GET /friends`, `GET /friends/requests`, `POST /friends/requests`, `POST /friends/requests/:id/accept`, `DELETE /friends/:userId` — friend management (protected)
- `GET /messages`, `POST /messages` — chat (protected)
- `GET /lobbies`, `POST /lobbies/heartbeat`, `DELETE /lobbies/:roomCode` — lobby tracking
- `POST /races`, `POST /races/lap`, `GET /races/me`, `GET /races/me/stats`, `GET /races/me/percentile`, `GET /races/user/:id` — race results & per-user stats
- `GET /races/leaderboard?track=` — public per-track leaderboard, ranked by best lap

---

### `db`
**Image:** `postgres:18`

PostgreSQL database. See the [Database Schema](#database-schema) section for the model overview.

Port `5432` is exposed to the host in dev for `psql` and Prisma Studio access. In prod, the port is not exposed — only `backend` reaches it over `db_network`.

---

### AI opponent
**Location:** `frontend/src/game/src/` (client-side)

The AI opponent runs entirely in the browser — there is no separate AI container. `calculateAI.ts` computes steering/throttle from the current race state each tick, and `useBotBridge.ts` wires the bot into the PlayroomKit session so it appears as another racer. A reserved `ai_service` block exists (commented out) in `docker-compose.yml` for a possible future server-side implementation.

---

## Instructions

### Prerequisites

- **Docker** + **Docker Compose v2**
- **GNU Make**
- A **`.env`** file at the project root (copy from `.env.example`)

### Required `.env` values

```env
POSTGRES_USER=user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=tr_db
```

> **Note:** in dev these credentials must match the hard-coded `DATABASE_URL`
> (`postgresql://user:password@db:5432/tr_db`) in `docker-compose.dev.yml`,
> or the backend won't connect to Postgres.

### Run the project

Deployment uses Docker Compose and starts with a single command:

```bash
# Development
make dev up          # start dev environment
make dev down        # stop and remove

# Production
make prod up         # start production environment
make prod down       # stop and remove

# Utilities
make verify          # verify Vault secret rendering end-to-end
make logs            # tail all container logs
```

Then open the app in your browser (see below).

---

## Connecting via the browser

### Development

Nginx and Vault are **off**. Each service is accessed directly:

| Service          | URL                            |
|------------------|--------------------------------|
| Frontend (Vite)  | `http://localhost:5173`        |
| Backend API      | `http://localhost:3000`        |
| Vault UI         | not running                    |
| PostgreSQL       | `localhost:5432`               |

No hosts file changes needed. Just `make dev up` and open `http://localhost:5173`.

### Production (local machine)

Nginx is the only public entry point. Ports `8080` (HTTP) and `8443` (HTTPS) are bound to `127.0.0.1` only.

**Step 1 — add a hosts entry** so the domain resolves locally:

```bash
# macOS / Linux
echo "127.0.0.1 sakuradrift.example.com" | sudo tee -a /etc/hosts

# Windows (run as Administrator)
echo 127.0.0.1 sakuradrift.example.com >> C:\Windows\System32\drivers\etc\hosts
```

**Step 2 — open in browser:**

```
https://sakuradrift.example.com:8443
```

The TLS certificate is self-signed (generated by the OWASP image at startup). Your browser will show a security warning — click through it, or import the CA from `vault_tls` into your system trust store to suppress it permanently.

HTTP requests to port `8080` are automatically redirected to HTTPS on `8443`.

| Service          | URL                                        |
|------------------|--------------------------------------------|
| App (HTTPS)      | `https://sakuradrift.example.com:8443`      |
| App (HTTP)       | `http://sakuradrift.example.com:8080` → 301 |
| Vault UI         | `https://127.0.0.1:8200` (localhost only)  |

---

## Environment differences

| Concern              | Production                                        | Development                              |
|----------------------|---------------------------------------------------|------------------------------------------|
| Entry point          | NGINX + ModSecurity WAF (`:8080` / `:8443`)       | Vite dev server direct (`:5173`)         |
| TLS                  | Yes — self-signed cert, HTTP → HTTPS redirect     | No                                       |
| WAF rules            | Paranoia Level 1, blocking mode                   | Off                                      |
| Secrets              | HashiCorp Vault → `/secrets/backend.env`          | Environment variables in compose         |
| Frontend build       | Multi-stage → nginx static serving               | Vite HMR, source volume-mounted          |
| Backend              | Compiled, `npm prune --omit=dev`, exec'd          | `nest start --watch`, source mounted     |
| Database port        | Internal only (not exposed to host)               | Exposed on `:5432` for local tooling     |
| Vault                | Running (production server mode, TLS, persistent) | Disabled                                 |
| Node ENV             | `prod`                                            | `dev`                                    |
| Restart policy       | `always`                                          | `no` / `unless-stopped`                  |

---

## CI/CD pipeline

Two GitHub Actions workflows live in `.github/workflows/`.

**`ci.yml` — Continuous Integration**

Runs on push and pull request to the `main` and `han_dev` branches. Five parallel jobs:

```
push / PR (main, han_dev)
  │
  ├── Backend Lint & Typecheck    ESLint + tsc --noEmit (Prisma client generated first)
  ├── Backend Unit Tests          Jest (npm test -- --passWithNoTests)
  ├── Build Backend               nest build, then verifies dist/ exists
  ├── Frontend Lint & Typecheck   ESLint + tsc --noEmit
  └── Build Frontend              vite build
```

There is currently **no frontend test suite** (no Vitest), and **no Docker/compose smoke-test** job — CI validates lint, type safety, backend unit tests, and that both apps build.

**`cd.yml` — Continuous Deployment**

Runs on push to `main`. Builds the **backend** Docker image with Buildx and pushes it to the GitHub Container Registry (GHCR), tagged via `docker/metadata-action`. No frontend image push and no environment deploy step are wired yet.

---

## Project structure

```
ft_transcendence/
├── frontend/               # React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/         # Badge, Button, Card, Input, ChatBox, FriendsPanel, SettingsMenu
│   │   │   ├── layout/     # Logo, SakuraPetals
│   │   │   └── routing/    # ProtectedRoute, ProfileRedirect
│   │   ├── pages/          # HomePage, Login/Register, Dashboard, Profile, Lobbies,
│   │   │                   #   Races, Leaderboard, AboutGame/AboutUs, legal pages
│   │   ├── game/           # The 3D racing game (Three.js + Rapier + PlayroomKit)
│   │   │   └── src/        # Car/physics, scene, hud, multiplayer + AI hooks, track parsing
│   │   ├── auth/           # AuthContext, AuthProvider, useAuth
│   │   ├── contexts/       # Theme + Locale providers
│   │   ├── hooks/          # useFriends, useMessages, useTranslation, bgMusic, ...
│   │   ├── lib/            # api.ts (axios) + lobbies/races/users API clients
│   │   ├── locales/        # i18n strings (languages.json, legal.json)
│   │   ├── types/          # shared TypeScript interfaces
│   └── Dockerfile          # multi-stage: dev (Vite HMR) + production (nginx)
├── backend/                # NestJS API
│   ├── src/
│   │   ├── auth/           # JWT register/login/refresh
│   │   ├── users/          # profile, stats
│   │   ├── friends/        # friend requests & relationships
│   │   ├── chat/           # messaging
│   │   ├── lobbies/        # lobby metadata
│   │   ├── race-results/   # race result recording
│   │   ├── prisma/         # Prisma service
│   │   └── common/         # shared guards/utilities
│   ├── prisma/             # schema.prisma + migrations
│   ├── Dockerfile          # dev + production targets
│   └── ENTRYPOINT.sh       # waits for secrets, runs migrations, starts Node
├── nginx/
│   └── conf/
│       ├── nginx.conf      # OWASP template — edge routing
│       └── nginx.spa.conf  # inner frontend nginx vhost
├── vault/
│   ├── Dockerfile          # custom Vault image with init script
│   ├── server.hcl          # production Vault server config
│   ├── agent.hcl           # Vault Agent config
│   ├── backend.env.ctmpl   # Consul template → /secrets/backend.env
│   └── scripts/
│       └── init-vault.sh   # one-shot init/unseal/seed script
├── docs/                   # project documentation
├── docker-compose.yml      # production services
├── docker-compose.dev.yml  # development overrides
├── Makefile
└── .env.example
```

---

## Individual Contributions

### hanjkim (Hanju Kim) — PM / Scrum Master & Developer
- Coordinated the team: organised planning, tracked progress and deadlines, and unblocked
  integration points across the backend, frontend, and infra work.
- Worked across the **backend** social/auth features (auth with JWT, users/profile,
  friends, chat) together with oohnivch and dvavryn.
- Owned the **frontend / UI**: React pages and components, theming and the settings menu,
  routing, and the API clients.
- Implemented **internationalization** (EN / DE / JA) with the in-app language switcher,
  and the **Privacy Policy / Terms of Service** pages.
- *Challenges:* chasing a polished UI meant rebuilding components over and over until they
  felt right — and yes, the eternal struggle of centering the div. The fix was iterating
  on the design relentlessly rather than settling for "good enough".

### oohnivch (Ollie Ohnivchuk) — Product Owner & Developer
- Owned the product vision and feature prioritisation, maintained the backlog, and
  validated completed work.
- Built the **game**: the Three.js / React Three Fiber 3D scene and rendering, the
  car/Rapier vehicle physics, tracks and HUD.
- Implemented **online multiplayer** over PlayroomKit (remote players across machines) and
  the lobby system, plus the **race-results / leaderboard** backend (history, per-user
  stats, percentile ranking).
- Contributed to the **backend** social/auth features alongside hanjkim and dvavryn.
- *Challenges:* balancing game optimization against an ever-growing wishlist of features —
  and refusing to ship until the game was actually fun. Keeping it performant and type-safe
  in TypeScript while resisting feature creep was the constant tension, resolved by
  prioritising the core racing feel first.

### dplotzl (Daniel Plötzl) — Technical Lead / Architect & Developer
- Owned the technical architecture and tech-stack decisions, upheld code quality, and
  reviewed critical changes.
- Built the **Cybersecurity / infrastructure** stack: ModSecurity / WAF (OWASP CRS) at the
  edge nginx, HashiCorp Vault for secrets (server, init, agent), the Docker/Compose setup
  (prod + dev), nginx routing, and the GitHub Actions CI/CD pipelines.
- *Challenges:* diving into the deep end of Vault policies and WAF/ModSecurity rules and
  making every piece fit together while keeping the whole stack secure — including getting
  suitably paranoid about ModSecurity Paranoia levels. Overcome by working through the
  configs methodically until the secrets flow and WAF wiring held end-to-end.

### dvavryn (Dominic Vavryn) — Operations Officer & Developer
- Built the **AI opponent** (`calculateAI.ts` per-tick steering/throttle and
  `useBotBridge.ts` wiring the bot into the PlayroomKit session as a racer).
- **3D modeling** — authored the in-game car model from scratch in **Blender** (~40 hours),
  handling the full asset pipeline through to its integration in the Three.js / R3F scene.
  This is the team's **Module of choice (Major)**.
- Contributed to the **backend** social/auth features (auth, users/profile, friends, chat)
  alongside hanjkim and oohnivch.
- Supported the operations/DevOps side of the project.
- *Challenges:* building features on demand and adapting on the go, while fitting cleanly
  into everyone else's code styles and conventions. Overcome by staying flexible and
  matching the surrounding patterns rather than imposing a separate style.

---

## Resources

### References

- [React documentation](https://react.dev/)
- [Vite documentation](https://vitejs.dev/)
- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [Three.js documentation](https://threejs.org/docs/) · [React Three Fiber](https://r3f.docs.pmnd.rs/)
- [Rapier physics](https://rapier.rs/docs/)
- [PlayroomKit documentation](https://docs.joinplayroom.com/)
- [OWASP ModSecurity Core Rule Set](https://coreruleset.org/)
- [HashiCorp Vault documentation](https://developer.hashicorp.com/vault/docs)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [42 ft_transcendence subject](en.subject.pdf) (v21.1)

### How AI was used

AI tools were used as a learning and productivity aid, not as a substitute for
understanding the code. Specifically:

- **Speed-learning TypeScript** — getting up to speed on TypeScript syntax, types, and
  idioms while building the frontend and backend.
- **Fast documentation lookup** — as a quick reference for the **Three.js**, **Rapier**,
  and **PlayroomKit** libraries, instead of trawling through their docs manually.
- **Documentation formatting** — help structuring and formatting written documentation,
  including this README.
- **Web-dev standards check** — sanity-checking against common web-development best
  practices and norms.

Every team member can explain and justify the parts of the project they worked on; AI was
used to accelerate learning and reference, with the actual implementation decisions and
code owned by the team.
