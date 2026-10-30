# H UI · React frontend

The default web frontend for H UI, a control panel for Hysteria2.

Built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS v4** and
**shadcn/ui** (Radix primitives). It talks to the same Go API as the legacy Vue
frontend and can be selected at startup with `h-ui --web react`.

## Screenshots

| Sign in | Account overview |
| --- | --- |
| ![Sign in](../../docs/images/react/login.png) | ![Account overview](../../docs/images/react/dashboard.png) |
| **Accounts** | **Hysteria2 configuration** |
| ![Accounts](../../docs/images/react/accounts.png) | ![Hysteria2](../../docs/images/react/hysteria.png) |

Mobile layout uses the same components with a sheet-based sidebar:

![Mobile](../../docs/images/react/mobile.png)

## Stack

- React 19 + React Router 7 (hash routing, so the panel can be mounted on any
  sub-path)
- Tailwind CSS v4 with the design tokens in [`src/index.css`](src/index.css)
- shadcn/ui components in `src/components/ui` (generated with
  `npx shadcn@latest add …`, safe to extend locally)
- `next-themes` for light / dark / system themes
- `axios` API layer with a global error interceptor (`src/lib/api.ts`)
- `sonner` toasts, `lucide-react` icons
- Lightweight i18n provider with English, 简体中文 and Русский dictionaries

## Scripts

```bash
npm install
npm run dev        # http://localhost:3001, proxies /hui to :8081
npm run build      # typecheck + production build into dist/
npm run typecheck  # tsc only
```

The dev server proxies the panel API to `http://127.0.0.1:8081`; start the Go
backend locally with `go run main.go` (default port 8081).

## Production build

```bash
npm run build:prod
```

`dist/` is embedded by [`embed.go`](embed.go) into the Go binary. The build uses
`/__dynamic_base__/` as the asset base; the Go server rewrites it to the
configured `H_UI_WEB_CONTEXT`, so the panel works at the root and on sub-paths.

Both frontends (`frontend_react/dist` and `frontend/dist`) must exist before
`go build`. Choose the served application at startup:

```bash
./h-ui -p 8081 --web react   # default
./h-ui -p 8081 --web vue     # legacy Vue frontend
```

## Structure

```
src/
  api/            typed API clients (account, config, hysteria2, log, monitor)
  components/
    ui/           shadcn/ui primitives (generated, locally adjustable)
    common/       dialogs, pagination, states, config fields, tag/key-value editors
    hysteria/     outbound editor and the section renderer for the config form
    layout/       sidebar + application shell
  contexts/       auth session provider
  i18n/           locale dictionaries and the translation provider
  lib/            axios client, formatting/IO helpers, navigation model, hysteria payload builder
  pages/          login, dashboard, accounts, hysteria, system config, telegram, logs, 404
  types/          API DTO/VO contracts
```

## Behaviour notes

- Session token lives in `localStorage` (`accessToken`) and is attached as
  `Authorization: Bearer …` by the axios interceptor.
- `50401` responses clear the session and route back to the login screen.
- Admin-only routes are guarded both in the sidebar and via `<RequireAdmin>`.
- The overview page carries the system status panel (host usage and Hysteria2
  health) for every signed-in role, so monitoring has no separate screen or
  entry point.
- Forms use the shadcn `Field` primitives with inline errors; server errors are
  surfaced as toasts by the shared API layer.
- The Hysteria2 editor only sends sections that are enabled and drops the
  inactive `tls`/`acme`, `obfs` and `resolver` branches before saving.
