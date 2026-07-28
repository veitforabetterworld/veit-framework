# veit-framework

Wiederverwendbare **fertige Module** für Node-/Web-Projekte (pnpm-Workspace-Pakete unter `packages/`).

Apps sollen primär die React-/Server-**Module** einbinden — nicht einzelne Low-Level-Helfer.

## Empfohlene Einstiegspunkte (Module)

| Paket | Fertiges Modul |
|-------|----------------|
| **`@veit/react-dialog`** | Popups: Presets (Entity/Overlay/Sheet/Picker/Wizard), Confirm/Prompt, Unsaved, History-Back, Search-Picker |
| **`@veit/react-controls`** | Controls + Settings-Sections, Choice-Primitives, DataTable, Password, Person-Rows, Inline-Listen |
| **`@veit/react-auth`** | Login/Register/Reset + `AuthClient` / `ProtectedRoute` |
| **`@veit/react-account`** | Account-Sections (Profil, Passwort, Sessions, MFA, Löschung) + `AccountClient` |
| **`@veit/react-auth-group`** | Auth-Gruppen-Editor / Person-Picker |
| **`@veit/react-field-tags`** | Tag-Editor, Picker, Filter-Bar |
| **`@veit/react-upload`** | Image-Picker / Upload |
| **`@veit/react-address`** | Adressformular + Autocomplete |
| **`@veit/react-invite`** | Invite-Einlösung, Invite-Liste, Share-Link-Actions |
| **`@veit/react-navigation`** | Back-Button / Navigations-Scope |
| **`@veit/react-dialog-router`** | Deep-Link-Hooks für Entity-Dialoge |
| **`@veit/node-server`** | Fastify-Bootstrap (`createApp`, Health, `listen`, `HttpError`) |
| **`@veit/db`** | Postgres-Pool + Drizzle |

## Low-Level / Server-Logik (meist nur Backend oder intern)

| Paket | Inhalt |
|-------|--------|
| **`@veit/address`** | Adress-Typen, Nominatim-Suche |
| **`@veit/field-tags`** | Tag-Baum-Logik (ohne UI) |
| **`@veit/intl`** | Locale-/Zahlen-/Geld-Formatierung |
| **`@veit/tesseract-ocr`** | Tesseract.js für Node |
| **`@veit/react-dnd`** | DnD-Kit-Abstraktionen (Primitiv-Kit) |

Öffentliche Web-Apps bevorzugen `@veit/react-field-tags` statt direkter `@veit/field-tags`-Imports; `@veit/address` nur serverseitig oder hinter `@veit/react-address`.

## Eigenes Repo entwickeln

```bash
cd veit-framework
# im Monorepo-Root des Host-Projekts:
pnpm install
pnpm --filter @veit/db build
pnpm --filter @veit/node-server build
```

## In anderen Repos nutzen

1. Submodule oder npm/Git-Dependency auf dieses Repository.
2. Pakete in die `pnpm-workspace.yaml` des Zielprojekts aufnehmen, z. B.  
   `veit-framework/packages/*`.
3. In `package.json`: `"@veit/react-dialog": "workspace:*"` (usw.).
4. Vite/TS-Aliases auf `veit-framework/packages/*/src/index.ts` (siehe Plenivo).

## Styling

React-Pakete nutzen Tailwind-orientierte Klassen (`btn-primary`, `card`, `input`, Utility-Klassen). Host-Apps mappen Design-Tokens darauf (wie Plenivo) bzw. stellen eine Kompatibilitäts-CSS-Schicht bereit (wie ScanGut).
