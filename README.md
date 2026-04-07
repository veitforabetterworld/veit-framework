# veit-framework

Wiederverwendbare **pnpm-Workspace-Pakete** unter `packages/` für Node-APIs und React-Frontends. Typischer Einsatz: als **Unterordner oder Git-Submodule** in einem Monorepo (z. B. Plenivo), das `veit-framework/packages/*` in die eigene `pnpm-workspace.yaml` aufnimmt.

## Pakete

| Paket | Zweck |
|-------|--------|
| **`@veit/db`** | PostgreSQL-**Pool** (`pg`) und **Drizzle**-Client: `getDatabaseUrl`, `createPool`, `createDrizzle` — liest `DATABASE_URL`, optional `fallbackUrl` für lokale Defaults. |
| **`@veit/node-server`** | **Fastify**-Grundgerüst: `createApp` (CORS aus `CORS_ORIGINS`, kommagetrennt, sonst alle Origins), `registerHealthRoutes` (`GET /`, `GET /health`), `listen` (`PORT` / `HOST`, Standard `3000` / `0.0.0.0`), `trustProxy` für Reverse-Proxy. |
| **`@veit/react-dialog`** | Modale Dialoge für React 18: **`VeitDialog`** (Portal, **Browser-History pro Dialog**, A11y), **`VeitConfirmDialog`**, **`VeitPromptDialog`**, **`VeitOptionPickerDialog`**, Hilfs-API `useVeitDialogDismiss`. Quell-TypScript; Styling über Tailwind-orientierte Klassen. **Peer:** `react`, `react-dom`, `lucide-react`. |

`@veit/db` und `@veit/node-server` liefern nach `pnpm build` Ausgabe unter `dist/` (`tsc`). `@veit/react-dialog` exportiert die Einstiegspunkte direkt aus den **TypeScript-Quellen** — ein Build des Pakets ist für Verbraucher oft optional, wenn der Bundler `.ts` auflöst.

## Im Host-Monorepo einbinden

1. Dieses Repository klonen oder als **Submodule** einhängen.
2. Im **Wurzel-`pnpm-workspace.yaml`** des Hostprojekts z. B. eintragen:  
   `- "veit-framework/packages/*"`  
   (Pfad zum geklonten Ordner anpassen.)
3. In den `package.json`-Abhängigkeiten des Hosts:  
   `"@veit/db": "workspace:*"` (analog für `@veit/node-server`, `@veit/react-dialog`).

Anschließend im **Repository-Root des Hosts** `pnpm install` ausführen.

## Build (nur Pakete mit `dist`)

Vom Host-Root aus, wenn `dist` für `@veit/db` / `@veit/node-server` erzeugt werden soll:

```bash
pnpm --filter @veit/db build
pnpm --filter @veit/node-server build
```

## Umgebungsvariablen (Kurzüberblick)

| Variable | Paket | Bedeutung |
|----------|--------|-----------|
| `DATABASE_URL` | `@veit/db` | PostgreSQL-Connection-String (Pflicht, außer explizit `fallbackUrl` an `createPool` übergeben). |
| `CORS_ORIGINS` | `@veit/node-server` | Erlaubte Origins, kommagetrennt; fehlt die Variable, ist CORS für alle Origins offen (`true`). |
| `PORT`, `HOST` | `@veit/node-server` | Optional für `listen` (Standard siehe oben). |
| `LOG_LEVEL` | `@veit/node-server` | Standard für Pino-Logger in `createApp` (Voreinstellung `error`). |
