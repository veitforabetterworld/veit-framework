# veit-framework

Wiederverwendbare Bausteine für Node-/Web-Projekte (pnpm-Workspace-Pakete unter `packages/`).

## Pakete

| Paket | Inhalt |
|-------|--------|
| **`@veit/db`** | PostgreSQL-Pool + Drizzle aus `DATABASE_URL` (`createPool`, `createDrizzle`, `getDatabaseUrl`) |
| **`@veit/node-server`** | Fastify-Basis: CORS aus `CORS_ORIGINS`, `registerHealthRoutes`, `listen` |

## Eigenes Repo entwickeln

```bash
cd veit-framework
pnpm install   # im Monorepo-Root des Host-Projekts
pnpm --filter @veit/db build
pnpm --filter @veit/node-server build
```

## In anderen Repos nutzen

1. Submodule oder npm/Git-Dependency auf dieses Repository.
2. Pakete in die `pnpm-workspace.yaml` des Zielprojekts aufnehmen, z. B.  
   `veit-framework/packages/*` (Pfad anpassen).
3. In `package.json`: `"@veit/db": "workspace:*"` (oder Versionspin).

## Integration im Host-Monorepo

Wenn dieses Framework als Workspace-Paket eingebunden ist, können Anwendungen (z. B. eine API) `@veit/db` und `@veit/node-server` wie gewohnt per `workspace:*` referenzieren.
