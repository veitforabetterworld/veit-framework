# veit-framework

Wiederverwendbare **fertige Module** für Node-/Web-Projekte (pnpm-Workspace-Pakete unter `packages/`).

Apps sollen primär die React-/Server-**Module** einbinden — nicht einzelne Low-Level-Helfer.

## Empfohlene Einstiegspunkte (Module)

| Paket | Fertiges Modul |
|-------|----------------|
| **`@veit/react-dialog`** | Popups: Presets, Confirm/Prompt, Search-Picker, **LanguagePicker**, `VeitOverlayShell` (inkl. Loading) |
| **`@veit/react-controls`** | Controls + Form-Primitives, StatusBadge, EmptyState, PageHeader, ProgressBar/PanelCard, ListItem, ResponsiveInlineActionBar, DataTable, Password, Delete-Button, Person-Rows, **`useVeitMediaQuery`** |
| **`@veit/react-auth`** | Login/Register/Reset + `AuthClient` / `ProtectedRoute` |
| **`@veit/react-account`** | Account-Sections (Profil, Passwort, Sessions, MFA inkl. **TOTP/E-Mail-Setup**, Löschung) + `AccountClient` |
| **`@veit/react-auth-group`** | Auth-Gruppen-Editor / Person-Picker |
| **`@veit/react-field-tags`** | Tag-Editor, Picker, Filter-Bar |
| **`@veit/react-upload`** | Image-Picker / Upload |
| **`@veit/react-address`** | Adressformular + Autocomplete |
| **`@veit/react-invite`** | Invite-Einlösung, Invite-Liste, Share-Link-Actions |
| **`@veit/react-navigation`** | Back-Button / Navigations-Scope |
| **`@veit/react-dialog-router`** | Deep-Link-Hooks für Entity-Dialoge |
| **`@veit/password-policy`** | Passwort-Stärke (zxcvbn + HIBP), `assertStrongPassword` / `evaluatePasswordSecurity` / `generateSuggestedPassphrase` |
| **`@veit/node-server`** | Fastify-Bootstrap (`createApp`, Health, `listen`, `HttpError`, `publicAppOrigin`, `publicOriginFromHost`) |
| **`@veit/db`** | Postgres-Pool + Drizzle + `rowsFromExecute` |

## Low-Level / Server-Logik (meist nur Backend oder intern)

| Paket | Inhalt |
|-------|--------|
| **`@veit/address`** | Adress-Typen, Nominatim-Suche |
| **`@veit/field-tags`** | Tag-Baum-Logik (ohne UI) |
| **`@veit/intl`** | Locale-/Zahlen-/Geld-Formatierung + **Sprach-Anzeigenamen** (`uiLanguageAutonym` / `uiLanguageDisplayName`) |
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
pnpm --filter @veit/password-policy build
pnpm --filter @veit/intl build
```

## In anderen Repos nutzen

1. Submodule oder npm/Git-Dependency auf dieses Repository.
2. Pakete in die `pnpm-workspace.yaml` des Zielprojekts aufnehmen, z. B.  
   `veit-framework/packages/*`.
3. In `package.json`: `"@veit/react-dialog": "workspace:*"` (usw.).
4. Vite/TS-Aliases auf `veit-framework/packages/*/src/index.ts` (siehe Plenivo).

## Styling

React-Pakete nutzen Tailwind-orientierte Klassen (`btn-primary`, `card`, `input`, Utility-Klassen). Host-Apps mappen Design-Tokens darauf (wie Plenivo) bzw. stellen eine Kompatibilitäts-CSS-Schicht bereit (wie ScanGut).

## Host-Integration (Wrapper-Regel)

1. **Generische UI/Server-Logik zuerst ins Framework** — nicht parallel in Plenivo und ScanGut duplizieren.
2. **Host-Dateien sind Adapter:** i18n, Branding, Env, API-Client, `bemPrefix` / Token-CSS. Keine zweite Implementierung neben einem Framework-Export.
3. **Domain bleibt im Host:** Billing, Kanban, Shop-Flows, Push/Firebase-Produktlogik usw.
4. **SiteShell-Chrome** (App-Header mit Branding/Navigation) bleibt host-spezifisch; nur Measure/Inline-Action-Primitives liegen im Framework (`@veit/react-controls`).
5. Branches: `deploy` ist Integrationsbranch; nach stabilen Modul-Wellen nach `development` mergen (beide Hosts pinnen denselben Tip).
