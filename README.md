# veit-framework

Fertige Module für Node- und React-Projekte: Konten mit MFA, API-Keys, Dialoge, Formular-Controls, Karten, Adressen, Tags. Die Pakete liegen unter `packages/` und werden als pnpm-Workspace-Pakete eines Host-Projekts eingebunden.

## Module

| Paket | Inhalt |
|-------|--------|
| `@veit/react-dialog` | Popups mit Verlauf und Barrierefreiheit: Bearbeiten mit Entwurf (`VeitOverlayEditDialog`, `useDialogFormBaseline`), Bestätigen/Eingabe, Such- und Auswahl-Picker, Sprachauswahl, Wizard, Sheet, Nachfrage bei ungespeicherten Änderungen |
| `@veit/react-controls` | Controls und Layout: Button (mit Größen), Icon-Button, Hinweisbox (`VeitAlert`), Toasts (`VeitToastProvider`, `useVeitToast`), Seitencontainer (`VeitPage`), Input, Select, Combobox, Switch, Range, Tabs, Listen (`VeitListItem`), Datentabelle, Status-Badge, Farbfeld (`VeitColorInput`), Leerzustand, Seitenkopf, Panels, Passwort- und Geheimnis-Feld, Löschen-Buttons, Personenzeilen, Handschrift-Eingabe, `AppShell`, App-Header/-Footer, ScrollArea, `useVeitMediaQuery`; Theme in `theme.css` |
| `@veit/react-auth` | Anmelden, Registrieren, Passwort vergessen/zurücksetzen, E-Mail-Bestätigung; `createAuthProvider`, `useAuth`, `ProtectedRoute`, `createRestAuthClient`, `veitFetchJson`/`VeitApiError` (mit `detail`, `fields`, `fieldErrors`, Status 0 bei Netzwerkfehler); Passwort-Gründe aus `@veit/password-policy/types`; Texte de/en (`veitAuthT`) |
| `@veit/react-account` | Kontoseite `VeitAccountSettings`: Profil, E-Mail, Passwort, MFA (TOTP und E-Mail-Code), Sitzungen und Geräte (Browser-Logos, App-Icon des Hosts, Badges, Nachfrage, eingebettet), Konto löschen; einzelne Abschnitte, `createRestAccountClient`, User-Agent-Parser |
| `@veit/react-app-settings` | Admin-Einstellungen: Gruppen mit Zusammenfassung und Bearbeiten im Popup (`VeitSettingsGroups`, Felder Text, Zahl, Schalter, Auswahl, Geheimnis mit Anzeigen und Löschen, Fehler am Feld), SMTP-Abschnitt mit Test-Mail und Plenivo-Preset (`VeitSmtpSettingsSection`), REST-Client |
| `@veit/react-api-keys` | `VeitApiKeysSection`: Keys mit Berechtigungen und Geltungsbereich anlegen, anzeigen, bearbeiten, sperren; auch ein Key pro Ressource und feste Rechte; Hinweis auf zu ersetzende Keys (`needs_rotation`) |
| `@veit/react-web-push` | Web Push im Browser: Service Worker (CLI `veit-web-push-sw`), Abo je Gerät, Schalter, Test-Benachrichtigung; Abschnitt `VeitWebPushSection` für die Kontoseite |
| `@veit/react-auth-group` | Personengruppen: Modus, Mitglieder, Personen-Picker |
| `@veit/react-field-tags` | Tag-Editor, -Picker und Filterleiste; Typen und Helfer aus `@veit/field-tags` |
| `@veit/react-upload` | Bild-Auswahl und Upload |
| `@veit/react-address` | Adressformular mit Straßen-Autovervollständigung (Nominatim); Typen und Helfer aus `@veit/address` |
| `@veit/react-invite` | Einladungen einlösen, auflisten, teilen |
| `@veit/react-map` | `<VeitMap>`: MapLibre-Karte mit Hintergründen (Vektor, Amtlich, Flurkarte), Globus, Gelände; Ebenen des Hosts bleiben beim Wechsel erhalten |
| `@veit/react-navigation` | Zurück-Navigation mit React Router (Button aus `@veit/react-controls`) |
| `@veit/react-dialog-router` | Deep Links auf Dialoge |
| `@veit/react-dnd` | Drag and Drop auf Basis von dnd-kit |
| `@veit/auth-server` | Kontologik für Node: Registrierung mit E-Mail-Bestätigung, Login mit TOTP/E-Mail-Code, Cookie-Sessions, Passwort-Reset, Profil, Löschung; Postgres (`/pg`), SMTP mit eigenem Mailversand des Hosts (`/smtp`), Express (`/express`) |
| `@veit/api-keys` | API-Keys pro Benutzer oder Organisation: Berechtigungen, alle Ressourcen oder Auswahl, optional verschlüsselt wieder anzeigbar; Postgres mit eigener Tabelle (`/pg`), Express (`/express`), einmalige Migration (`/migrate`) |
| `@veit/web-push` | Standard Web Push (VAPID): Abos je Browser/Gerät und Schalter je Nutzer in Postgres (`/pg`), Routen `/me/push` (`/express`), Versand mit Aufräumen abgelaufener Abos |
| `@veit/secret-box` | Das eine Format für Geheimnisse in der Datenbank (`enc1:`, AES-256-GCM); alte Formate nur für einmalige Migrationen (`/migrate`, `reencryptRows`) |
| `@veit/app-settings` | Einstellungen in einer Schlüssel/Wert-Tabelle: Geheimnisse verschlüsselt, maskiert gelistet, für Admins anzeigbar, generierte interne Schlüssel; Express (`/express`), SMTP-Einstellungen daraus (`/smtp`) |
| `@veit/password-policy` | Passwortstärke (zxcvbn und Have I Been Pwned), Vorschläge für Passphrasen; Typen ohne Node unter `/types` |
| `@veit/node-server` | Fastify-Grundgerüst: `createApp`, Health-Routen, `listen`, `HttpError`, öffentliche Origin |
| `@veit/db` | Postgres-Pool (mit Pool-Optionen) und Drizzle, `checkDatabase` |
| `@veit/intl` | Datum, relative Zeit, Dauer, Zahlen, Geld, Maßeinheiten und Sprachnamen formatieren; Browser und System aus dem User-Agent (`describeUserAgent`, `sessionClientFromUserAgent`) |
| `@veit/app-icons` | Alle App-Icons aus einem Logo-SVG (`branding/logo.svg`, Ziele in `branding/app-icons.json`): Favicon (SVG, ICO), PWA any und maskable, apple-touch-icon, Android Adaptive Icon (Vordergrund, Hintergrund, Monochrom), Legacy-Launcher, Splash, Benachrichtigung, Store-Icon; CLI `veit-app-icons`, `webManifestIcons` fürs Manifest. Siehe Kopf von `src/index.mjs` |
| `@veit/map` | MapLibre ohne React: Hintergründe, Flurkarten der Länder, Sonnenstand, Gelände, Höhenprofil, 3D-Welt (`/world3d`) |
| `@veit/address` | Adress-Typen, Formatierung, Nominatim-Suche |
| `@veit/field-tags` | Tag-Baum ohne UI |
| `@veit/tesseract-ocr` | Texterkennung mit Tesseract.js für Node |

Die React-Pakete bauen auf den gleichnamigen Paketen ohne `react-` auf; `@veit/address` ist für den Server gedacht, im Browser über `@veit/react-address`.

## Einbinden

1. Als Git-Submodul ins Host-Projekt holen, z. B. nach `veit-framework/`.
2. `veit-framework/packages/*` in die `pnpm-workspace.yaml` des Hosts aufnehmen.
3. Pakete in der `package.json` als `"@veit/react-dialog": "workspace:*"` usw. eintragen.
4. Die Node-Pakete bauen: `pnpm --filter "@veit/db" --filter "@veit/auth-server" … run build` (gebaut werden address, api-keys, app-settings, auth-server, db, field-tags, intl, node-server, password-policy, secret-box, tesseract-ocr, web-push). Die React-Pakete werden als Quelltext eingebunden: Vite- und TS-Aliase auf `veit-framework/packages/<paket>/src/index.ts`.
5. React nur einmal laden: `pnpm.overrides` für `react`, `react-dom`, `react-router` und `react-router-dom`, dazu Vite `resolve.dedupe`. Sonst gibt es doppelte Router-Kontexte (`useLocation` außerhalb von `<Router>`); `scripts/check-react-singleton.mjs` prüft das im Bundle. Den Paket-Root nicht auf `index.ts` aliasen, sonst brechen Unterpfade wie `theme.css`.

## Styling

`@veit/react-controls/theme.css` enthält die shadcn-Variablen und die Klassen `.btn` (mit `.btn-sm`, `.btn-lg`, `.btn-icon`), `.input` und `.card`. Der Host lädt zuerst Tailwind (`@import "tailwindcss"` und `@source`), danach die Theme-Datei. Danach darf eine eigene Brand-Datei nur Custom Properties und `@font-face` setzen; `scripts/no-custom-css.mjs --allow-css <datei>` prüft das. Ohne Brand-Datei bleibt die dunkle Standard-Palette.

## Skripte

| Skript | |
|---|---|
| `no-custom-css.mjs` | keine eigenen CSS-Dateien, kein `style=`, keine Arbitrary Values |
| `check-page-loc.mjs` | Zeilenzahl von Seiten begrenzen (Wurzeln und Schwellen setzt der Host) |
| `check-react-singleton.mjs` | nur ein React-Router-Kontext im Produktionsbundle |
| `check-submodule-pins.mjs` | Submodul-Pin steht auf `origin/<branch>` |
| `check-no-tracked-secrets.mjs` | keine versionierten Geheimnis-Dateien oder privaten Schlüssel |
| `sync-android-web-manifest.mjs`, `sync-twa-theme.mjs` | Web-Manifest und Markenfarben in eine Android-TWA übernehmen |
| `load-json-config.mjs`, `assert-required-config.mjs` | JSON-Konfiguration mit lokalem Override laden, Pflichtfelder prüfen |
| `check-i18n-literals.mjs` | kein Text in Komponenten, alles aus den Sprachdateien (Wurzeln, Ignore-Marker, Ausnahmen per Flag) |
| `check-i18n-hardcodes.mjs` | kein hartes Locale wie `de-DE`, gleiche Schlüssel in allen Sprachdateien |
| `check-sheet-dismiss.mjs` | jedes `VeitSheetDialog` hat `dismissRef` |
| `check-audit.mjs` | `pnpm audit`: high/critical blockieren, außer in der geprüften Allowlist |
| `only-pnpm.cjs`, `install-git-hooks.mjs` | Installation nur mit pnpm; versionierte Git-Hooks installieren |

Änderungen und brechende Umstellungen stehen in [CHANGES.md](CHANGES.md).

## Lizenz

[PolyForm Noncommercial 1.0.0](LICENSE): frei nutzbar, veränderbar und weitergebbar, aber nur nicht kommerziell. Keine Gewährleistung, keine Haftung.
