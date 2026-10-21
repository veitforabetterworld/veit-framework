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
| **`@veit/react-map`** | `<VeitMap>`: MapLibre-Karte mit Hintergründen (Vektor zuerst, Amtlich, Flurkarte), Globus, Gelände, Host-Ebenen bleiben beim Wechsel erhalten |
| **`@veit/react-map`** | `<VeitMap>`: MapLibre-Karte mit Hintergründen (Vektor zuerst, Amtlich, Flurkarte), Globus, Gelände, Host-Ebenen bleiben beim Wechsel erhalten |
| **`@veit/react-navigation`** | Back-Button / Navigations-Scope |
| **`@veit/react-dialog-router`** | Deep-Link-Hooks für Entity-Dialoge |
| **`@veit/password-policy`** | Passwort-Stärke (zxcvbn + HIBP), `assertStrongPassword` / `evaluatePasswordSecurity` / `generateSuggestedPassphrase` |
| **`@veit/node-server`** | Fastify-Bootstrap (`createApp`, Health, `listen`, `HttpError`, `publicAppOrigin`, `publicOriginFromHost`) |
| **`@veit/db`** | Postgres-Pool + Drizzle + `rowsFromExecute` |

## Low-Level / Server-Logik (meist nur Backend oder intern)

| Paket | Inhalt |
|-------|--------|
| **`@veit/address`** | Adress-Typen, Nominatim-Suche |
| **`@veit/map`** | MapLibre ohne React: Hintergründe, Flurkarten der Länder, Live-Sonne, Gelände, Höhenprofil, 3D-Welt (`@veit/map/world3d`) |
| **`@veit/map`** | MapLibre ohne React: Hintergründe, Flurkarten der Länder, Live-Sonne, Gelände, Höhenprofil, 3D-Welt (`@veit/map/world3d`) |
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
5. **React-Singleton (Pflicht bei Source-Aliases):** Host pinnt eine React-Major-Linie und eine `react-router`-Kopie — sonst entstehen doppelte Router-Contexts (`useLocation` außerhalb von `<Router>`). Empfohlen:
   - `pnpm.overrides` für `react` / `react-dom` / `react-router` / `react-router-dom`
   - Vite `resolve.dedupe` + absolute Aliases auf die Host-`node_modules`-Kopien
   - Paket-Root nicht auf `index.ts` aliasen, sonst brechen Subpath-Imports wie `theme.css`

## Styling

`@veit/react-controls/theme.css` enthält die shadcn-Variablen und die Klassen `.btn`, `.input`, `.card`. Der Host lädt Tailwind davor (`@import "tailwindcss"` plus `@source`) und importiert danach die Theme-Datei. Siehe `CHANGES.md` für brechende Umstellungen auf Radix.

### Brand-Datei

Nach `theme.css` darf eine Host-Datei nur Custom Properties und `@font-face` setzen. `scripts/no-custom-css.mjs` prüft das für `--allow-css`. `theme.css` liefert ein dunkles `:root`; die Brand-Datei muss danach kommen, sonst bleibt die Hochwasser-Palette.

Die Tailwind-3-Brücke (`veit-bridge.css`, `tailwind.config.js`) ist kein Muster mehr. ScanGut und Hochwasser importieren `theme.css` direkt.

## Host-Integration (Wrapper-Regel)

1. **Generische UI/Server-Logik zuerst ins Framework** — nicht parallel in Plenivo und ScanGut duplizieren.
2. **Host-Dateien sind Adapter:** i18n, Branding, Env, API-Client, `bemPrefix` / Token-CSS. Keine zweite Implementierung neben einem Framework-Export.
3. **Domain bleibt im Host:** Billing, Kanban, Shop-Flows, Push/Firebase-Produktlogik usw.
4. **SiteShell-Chrome** (App-Header mit Branding/Navigation) bleibt host-spezifisch; nur Measure/Inline-Action-Primitives liegen im Framework (`@veit/react-controls`).
5. Hosts pinnen `origin/development`. Produkt-`deploy` rollt die jeweilige Produktion aus und ist nicht der gemeinsame Framework-Tip.
