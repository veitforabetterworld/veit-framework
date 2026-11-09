# Änderungen

## Web Push (VAPID) als Module

Stand 2026-11-08. Additiv, neue Pakete (`pnpm install`; `@veit/web-push` bringt die Bibliothek `web-push` mit).

- `@veit/web-push` (neu, Node): `WebPushService` mit Abo je Browser/Gerät und Schalter je Konto, Versand an alle Abos eines Nutzers, entfernt abgelaufene Abos (404/410). `WEB_PUSH_SCHEMA_SQL` und `createPgWebPushStore` (`/pg`, Tabellen `web_push_subscriptions` und `web_push_preferences`, `user_id` auf `users(id)`), Express-Routen `/me/push` (`/express`: Status, Schalter, Abo anlegen/löschen, Test-Benachrichtigung). `generateVapidKeys()`.
- `@veit/react-web-push` (neu): `createRestWebPushClient`, `useVeitWebPush`, `VeitWebPushSection` (Kontoseite, Texte de/en in `veitWebPushTexts`), `registerVeitServiceWorker`, `useVeitWebPushOpen` (Klick auf eine Nachricht bei offener App im SPA-Router öffnen), `ensureVeitWebPush` (aus einem Klick: Erlaubnis anfragen und dieses Gerät anmelden, falls nötig; liefert ein Ergebnis für den Hinweis statt zu werfen). CLI `veit-web-push-sw --out public --api /api/v1` erzeugt den Service Worker (`sw.js`, nicht versioniert, wie die App-Icons). Im Android-TWA zeigt Chrome die Nachrichten über die Notification Delegation der App an.

## Browser-Logos in Sitzungslisten, App-Icons aus einem Logo

Stand 2026-11-08. Additiv. Hosts brauchen ein `pnpm install` (neues Paket `@veit/app-icons` mit `@resvg/resvg-js`).

- `@veit/react-account`: `VeitSessionClientIcon` zeigt für Browser das Markenlogo in Markenfarbe auf weißer Kachel (Chrome, Chromium, Firefox, Edge, Opera, Safari, Brave, Vivaldi, Tor, Samsung Internet, Internet Explorer; SVG-Pfade aus Simple Icons, Tabler und Font Awesome, kein Icon-Paket). `AccountSession.browser` sagt, welcher Browser. Für die eigene App (`clientKind: 'app'`) zeigt es `appIconSrc` (Prop an `VeitAccountSessionsSection`, `VeitAccountSettings` und `VeitSessionClientIcon`). Für Markenlogos braucht kein Host mehr ein eigenes `renderClientIcon`.
- `@veit/intl`: `sessionClientFromUserAgent(ua, options)` gibt `{ clientKind, browser? }`, zum Spreaden in eine `AccountSession`.
- `@veit/auth-server/express`: `GET /me/sessions` sendet zusätzlich `browser`; `createRestAccountClient` liest es.
- `@veit/app-icons` (neu): `veit-app-icons` erzeugt alle Icons aus `branding/logo.svg` nach `branding/app-icons.json`. Ein Element mit `id="background"` ist der Hintergrund, der Rest die Marke; ohne Hintergrund braucht die Konfiguration `background`. Maskable- und Adaptive-Icons halten die Marke in der Safe Zone (Kreis mit 40 % bzw. 33/108 dp Radius), Monochrom entsteht aus dem Alpha-Kanal (oder mit `luminance` aus der Helligkeit). Die Ausgaben sind Build-Artefakte und nicht versioniert.
- `scripts/sync-twa-theme.mjs`: `maskableIconUrl` zeigt auf `/icon-512-maskable.png` statt auf das nicht maskierbare `/icon-512.png`.

## Sicherung vor jeder Migration, react-router 7

Stand 2026-11-08. Additiv.

- `scripts/deploy/backup-before-migrate.sh`: Alle Hosts rufen es im Runtime-Reload direkt vor den Migrationen auf. Es sichert die ganze Datenbank (`pg_dump -Fc`, geprüft) und die Schlüssel-Dateien nach `/var/backups/veit/<name>/`. Scheitert es, bricht der Deploy ab. Siehe `docs/deploy-backup.md`.
- devDependencies `react-router-dom` auf `^7.18.0`; alle Hosts nutzen v7.

## VeitPage kompakt, VeitColorInput streng typisiert

Stand 2026-11-08. Additiv.

- `VeitPage`: Breite `compact` (`max-w-xl`) und `padded={false}` für Layouts, die den Inhalt schon einrücken. Ersetzt `!max-w-xl` und `!p-0` in Plenivo.
- `VeitColorInput`: kein ungeprüfter Indexzugriff mehr; Hosts mit `noUncheckedIndexedAccess` können die Quellen wieder mitprüfen.

## Lücken aus der Host-Migration

Stand 2026-11-04. Was beim Umstellen von Plenivo, Scangut, Hochwasserdienst und Sprachassistent gefehlt hat. Additiv, bis auf die Optik von `VeitBackButton` in `@veit/react-navigation`. Hosts brauchen ein `pnpm install` (neue Abhängigkeiten zwischen Framework-Paketen). Wer `@veit/auth-server`, `@veit/react-auth` oder `@veit/react-account` nutzt, braucht `@veit/intl` und `@veit/password-policy` in `build:deps` (bei Sprachassistent, Plenivo, Scangut und Hochwasserdienst schon drin).

- `@veit/app-settings/express`: Validierungsfehler senden zusätzlich `fields: { [key]: code }`; `key` bleibt. `PUT` nimmt `null`: Ein Geheimnis wird gelöscht, ein anderer Wert geleert. `validate` ist eine Methode mit `Record<string, string | null>` (null nur für gelöschte Geheimnisse); Callbacks mit `Record<string, string>` passen weiter.
- `@veit/react-app-settings`:
  - `VeitSettingsGroups` und `VeitSmtpSettingsSection` nehmen `values: null` beim Laden und zeigen dann einen `VeitSpinner`. Bisher machte die Schnittmenge mit den Dialog-Props `null` unmöglich.
  - Feldfehler des Servers (`fieldErrors` von `VeitApiError`, eine Liste `fields` oder das alte `key`) stehen am Feld statt in der Box; Text über `fieldErrorText(code, key)`, sonst `errorText`. `veitSettingsFieldErrors(error)` liest sie.
  - Gespeicherte Geheimnisse haben einen Button „Löschen“; beim Speichern bekommt `onSave` für das Feld `null`. Er erscheint, wenn `texts.clearSecret` gesetzt ist (in `veitSettingsGroupsTexts` und `veitSmtpSettingsTexts` schon); `clearable: false` am Feld blendet ihn aus. Neue optionale Texte `clearSecret`, `secretCleared`, `undoClear`. `onSave` ist eine Methode mit `VeitSettingsPatch` (`Record<string, string | null>`), bestehende Callbacks passen weiter; der REST-Client sendet `null`.
  - Toggle-Felder haben `defaultOn` für einen leeren Wert.
  - `VEIT_PLENIVO_SMTP_SETTING_KEYS` (wie `PLENIVO_SMTP_SETTING_KEYS`): Mit `keys.url` und `keys.tlsRejectUnauthorized` zeigt die SMTP-Gruppe die URL und „Zertifikat prüfen“ (Standard an) selbst; Plenivo braucht kein `extraFields` mehr (gleiche Schlüssel in `extraFields` werden übersprungen). Die Zusammenfassung nennt bei reiner URL Host und Port ohne Zugangsdaten. Neue optionale Texte `url`, `urlHint`, `tlsRejectUnauthorized`, `tlsRejectUnauthorizedHint`.
- `@veit/react-auth`:
  - `veitFetchJson` reicht alle `RequestInit`-Optionen außer `body` an `fetch` durch (`cache`, `signal`, `keepalive`, `mode` …); `credentials` bleibt standardmäßig `include`.
  - `VeitApiError.fieldErrors` aus Fehlerkörpern `fields: { name: code }`; `fields` enthält dann die Namen. Listen wie bisher.
  - `ProtectedRoute` hat `nextParam`: Mit `'next'` geht es nach `/login?next=%2Fseite`; das überlebt Reload und neuen Tab. Ohne Option wie bisher nur Router-State. Neu exportiert: `veitLoginPathWithNext(loginPath, next, param)`, `resolvePostLoginPath`, `safeNextParam`. `LoginForm` und `RegisterForm` lesen `next` schon; schon angemeldete Nutzer landen jetzt auf `afterLoginPath`/`afterRegisterPath` statt auf `/`.
  - Re-exportiert aus `@veit/password-policy/types`: `PASSWORD_MIN_LENGTH`, `PASSWORD_SECURITY_REASONS`, `PasswordSecurityReason`, `PasswordPolicyErrorCode`, `PasswordSecurityEvaluation`, `isPasswordSecurityReason`, `passwordSecurityReasons(list)`. Neue Abhängigkeit `@veit/password-policy` (gebaut).
- `@veit/password-policy`: Unterpfad `/types` ohne Node und zxcvbn; der Paketindex re-exportiert ihn. Web-Apps nehmen die Typen aus `@veit/react-auth`.
- `@veit/react-api-keys`: `VeitApiKey.needs_rotation` (kommt schon aus `apiKeyJson` von `@veit/api-keys`, für Keys mit altem `hash_scheme`): Badge „ersetzen“ an der Zeile und ein `VeitAlert` über der Liste, solange ein aktiver Key betroffen ist. Optionale Texte `needsRotation`, `needsRotationTitle`, `needsRotationHint`; fehlen sie in eigenen Texten, kommen sie nach `locale` aus `veitApiKeysTexts`.
- `@veit/react-navigation`: `VeitBackButton` nutzte Tokens, die `theme.css` nicht kennt (`on-surface-variant`, `outline-variant`, `shadow-level-1`, `font-headline`, `text-label-sm`). Er hat jetzt die Optik von `VeitBackButton` aus `@veit/react-controls` (Pfeil, Ghost); lange Labels werden gekürzt. Props bleiben. **Optik ändert sich** für Hosts, die diese Tokens selbst definiert hatten.
- `@veit/react-controls`: Neu `VeitColorInput` (`value` als `#rrggbb`, `onChange`, `swatches`, `label`, `customLabel`, `swatchLabel`, `showValue`, `disabled`). Die Swatches sind eine Radiogruppe mit Pfeiltasten, die eigene Farbe kommt aus dem nativen Farbwähler im Control; `id` sitzt am nativen Input für `VeitField htmlFor`. Dazu `VEIT_COLOR_SWATCHES` und `normalizeHexColor`. Ersetzt `VeitInput type="color"` (Scangut `WalletList`).
- Geräte und Sitzungen:
  - `@veit/intl`: `parseUserAgent` (Browser- und System-Art mit Namen), `describeUserAgent` („Firefox · Windows“), `clientKindFromUserAgent(ua, { deviceName, appDeviceNames })` (`browser`, `app`, `android`, `ios`, `desktop`, `unknown`), `browserKindName`, `osKindName`. Rein, ein Parser für Server und Browser; erkennt auch Brave, Vivaldi, Samsung Internet, Chromium, iPadOS und ChromeOS.
  - `@veit/auth-server` nimmt den Parser aus `@veit/intl` (`describeUserAgent` bleibt exportiert, dazu `parseUserAgent` und `clientKindFromUserAgent`). `GET /me/sessions` sendet `client_kind`; Option `appDeviceNames` für die eigenen Apps. Neue Abhängigkeit `@veit/intl`.
  - `@veit/react-account`: `AccountSession` hat optional `clientKind` und `badges` (`{ label, variant?, icon? }`, z. B. „Push aktiv“). `VeitAccountSessionsSection` zeigt das Icon (`VeitSessionClientIcon`, eigenes über `renderClientIcon`), fragt mit `confirmRemove` (Konfiguration oder Funktion der Sitzung) in einem `VeitConfirmDialog` nach und hat `embedded` ohne Karte. `onRevoke` darf ein Promise liefern. `createRestAccountClient` übernimmt `client_kind`, `VeitAccountSettings` zeigt die Icons damit automatisch. Der Parser ist re-exportiert; Plenivos `sessionDisplay.ts`/`SessionClientIcon.tsx` und Scanguts `walletDeviceDisplay.ts`/`WalletDeviceList.tsx` können darauf umstellen (Markenlogos bleiben über `renderClientIcon` beim Host). Neue Abhängigkeit `@veit/intl`, neue Peers `@veit/react-dialog` und `lucide-react`.
- Nicht gebaut: ein Helfer zum Umstieg auf `VeitToastProvider`. Die Hosts rufen `useVeitToast().show` direkt auf; ein Adapter wäre nur eine zweite API.

## Ein Verschlüsselungsformat, Einstellungen als Modul

Stand 2026-11-04. **Brechend** für gespeicherte Geheimnisse: Zur Laufzeit gibt es nur noch ein Format. Jeder Host braucht vor dem Update eine einmalige Datenmigration (siehe unten); ohne sie lassen sich TOTP-Secrets und wieder anzeigbare API-Keys nicht mehr öffnen.

- Neu: `@veit/secret-box`. Das eine Format für Geheimnisse in der Datenbank: `enc1:` plus base64 von `{"iv","tag","d"}`, AES-256-GCM, Schlüssel sha256(`${material}|${context}`), das Material getrimmt. Es ist genau das Format von Sprachassistent (`apps/api/src/secrets.ts`, `src/secrets.rs`); der Rust-Leser bleibt unverändert gültig.
  - `createSecretBox({ key, context })` mit `encrypt`, `decrypt`, `isEncrypted`, `enabled`. `key` darf eine Funktion sein und wird bei jedem Aufruf gelesen. `decrypt` wirft (`SecretBoxError` mit `code`) bei allem, was nicht `enc1:` ist, auch bei Klartext; nur `''` bleibt `''`.
  - `@veit/secret-box/migrate` nur für einmalige Migrationen, nicht für Laufzeitcode: `decodeLegacy(stored, sources)` mit den Quellen `auth-json` (altes `createAesGcmSecretBox`, Material ungetrimmt), `compact-sha256` (altes `encryptApiKey`), `compact-raw-hex` (Scangut `crypto.ts`), `canonical` (anderes Material oder anderer Kontext) und `plaintext` (verweigert Werte, die wie Chiffretext aussehen; als letzte Quelle). `reencryptRows({ pool | client, table, idColumn, column, box, sources, where?, params?, jsonFields?, dryRun?, allowFailures? })` stellt eine Spalte in einer Transaktion um, lässt kanonische Werte stehen und liefert `{ converted, alreadyCanonical, empty, failed, committed }`. Scheitert ein Wert, wird nichts geschrieben und `ReencryptError` geworfen (außer mit `allowFailures`). `jsonFields` stellt Felder einer JSON-/JSONB-Spalte um.
- `@veit/auth-server`:
  - `createAesGcmSecretBox` schreibt und liest nur noch `enc1:` und ist `@deprecated`; `AuthService` nimmt `createSecretBox(...)` direkt als `secretBox`. TOTP-Secrets im alten Format öffnen sich nicht mehr (Login mit TOTP schlägt fehl).
  - **Migration je Host, einmal:** Spalten `mfa_totp_secret_enc` und `mfa_totp_setup_secret_enc` der Tabelle `users` (aus `AUTH_SCHEMA_SQL`) mit `reencryptRows`, `box` = die neue Box, `sources: [{ kind: 'auth-json', key: <altes Material>, context: <alter Kontext> }]`. Plenivo (Kontext `plenivo-mfa-totp`) stellt so auch seine übrigen mit `mfa-crypto.ts` verschlüsselten Werte um.
  - `/smtp`: `SmtpSettings` hat optional `url` (Verbindungs-URL statt Host/Port/Benutzer) und `tlsRejectUnauthorized`. Neu: `createSmtpTransport(settings)`, `createSmtpSender(getSettings)` mit `send({ to, subject, text, html?, from?, replyTo? })` und `configured()` (Transport wird wiederverwendet, solange die Einstellungen gleich bleiben), `smtpConfigured(settings)`. Damit schicken Hosts auch ihre eigenen Mails über dieselbe Konfiguration; Plenivos `lib/mailer.ts` lässt sich so ersetzen. `createSmtpMailer` nutzt den Sender und akzeptiert `url` statt `host`.
- `@veit/api-keys`:
  - **Brechend:** `key_enc` steht im Format von `@veit/secret-box` (Kontext `veit-api-keys`, `API_KEYS_SECRET_CONTEXT`, änderbar mit `secretContext`). `encryptApiKey` und `decryptApiKey` sind entfernt. **Migration:** `reencryptApiKeys({ pool, oldSecret })` aus `@veit/api-keys/migrate` (Quelle `compact-sha256`). Ohne Migration bleiben die Keys gültig, nur nicht mehr anzeigbar.
  - Besitzer ist allgemein (Benutzer oder z. B. Organisation; `UserId` ist die Besitzer-ID). `create(ownerId, input, { createdBy })` und `ApiKeyInsert.createdBy` für Keys einer Organisation.
  - `createPgApiKeyStore(pool, { table, columns })`: Tabelle und Spalten sind konfigurierbar (`owner`, `keyHash`, `prefix`, …; `keyEnc: null` ohne Anzeige; optional `createdBy`, `hashScheme`). Ohne Optionen bleibt alles wie bisher.
  - Übergang für bestehende Hashes eines Hosts (Plenivo: sha256(token) ohne Pepper): `markLegacyHashedKeys({ pool, table, column })` legt die Spalte `hash_scheme` an und markiert alle vorhandenen Keys, nur solange die Spalte noch fehlt. Mit der Service-Option `legacyHash: legacySha256Hash` gilt ein markierter Key weiter und wird bei seiner ersten Benutzung auf sha256(`${pepper}:${key}`) umgeschrieben (`findByLegacyHash`, `upgradeHash` im Store). Ohne die Option zählen markierte Keys nicht. `ApiKeyRecord.legacyHash` und `needs_rotation` in `apiKeyJson` zeigen Keys, die noch nicht umgestellt sind; die Option fällt nach der Übergangszeit weg.
- Neu: `@veit/app-settings` (Server, mit tsc gebaut). `createAppSettings({ pool | query, table, keyColumn, valueColumn, updatedAtColumn, secretBox, secretKeys, defaults, deleteEmpty })` mit `get`, `getMany`, `set`, `setMany`, `listMasked` (Geheimnisse nur als `{ stored }`), `reveal`, `ensureGenerated(key, bytes)`. Bei Geheimnissen behält `''` beim Speichern den gespeicherten Wert, `null` löscht ihn. Tabellen- und Spaltennamen sind einstellbar (Plenivo: `setting_key`/`setting_value`, `deleteEmpty`); Hochwasserdienst und Sprachassistent passen mit den Defaults.
  - `/express`: `createAppSettingsRouter({ settings, keys, guard, validate?, onSaved? })` mit `GET /`, `PUT /` und `GET /:key/secret`.
  - `/smtp`: `smtpSettingsFromAppSettings(settings, { keys, defaultFrom, defaultPort })` liefert den Getter für `createSmtpMailer`/`createSmtpSender`; `DEFAULT_SMTP_SETTING_KEYS` (`smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_password`, `smtp_from`) und `PLENIVO_SMTP_SETTING_KEYS` (`smtp_pass`, `mail_from`, `smtp_url`, `smtp_tls_reject_unauthorized`).
  - Geheimnisse in `app_settings`, die bisher im Klartext liegen (Hochwasserdienst `smtp_password`, Plenivo `smtp_pass`, Sprachassistents generierte Schlüssel), stellt der Host einmal mit `reencryptRows` (`where: "key = ANY($1)"`, Quelle `plaintext`) um, bevor er sie als `secretKeys` liest.
- Neu: `@veit/react-app-settings` (eigenes Paket statt `@veit/react-account`: Admin- statt Kontoseite, Gegenstück zu `@veit/app-settings`, braucht `@veit/react-dialog`). `VeitSettingsGroups({ groups, values, onSave, onReveal, texts, errorText, title? })` mit Feldern `text`, `number`, `toggle`, `select`, `secret`; jede Gruppe als `VeitListItem` mit Zusammenfassung, Bearbeiten im `VeitOverlayEditDialog` mit Entwurf. `VeitSmtpSettingsSection` und `veitSmtpSettingsGroup(texts, { keys, extraFields, onTestMail })`, Texte `veitSettingsGroupsTexts` und `veitSmtpSettingsTexts` (de/en), `createRestAppSettingsClient`.
- Hosts brauchen ein `pnpm install` (neue Workspace-Pakete) und `@veit/secret-box` sowie `@veit/app-settings` in ihrem `build:deps`.

## Bausteine für die Host-Migration

Stand 2026-11-04. Alles ist additiv; bestehende Exporte und Props bleiben. Die Hosts stellen in einer zweiten Runde auf diese Bausteine um.

- `@veit/react-controls`:
  - Neu: `VeitAlert` (`variant` `error`/`warning`/`info`/`success`, `title`, `action`, `icon`, `plain`). Fehler und Warnungen haben `role="alert"`, der Rest `role="status"`. Ersetzt die `role="alert" … border-destructive`-Boxen; `plain` ersetzt `<p className="text-destructive">`.
  - Neu: `VeitToastProvider` und `useVeitToast()` mit `show(kind, text, { durationMs })` und `dismiss(id)`. Portal, `aria-live="polite"`, Auto-Dismiss (Fehler 9 s, sonst 5–7 s, `0` bleibt stehen), auf dem Handy unten, ab `sm` oben (`placement`). Der Schließen-Text kommt über `texts.close`. `useVeitToastOptional()` liefert außerhalb des Providers `null`. Vorbild ist `AppMessageContext` in Plenivo.
  - Neu: `VeitPage` (`title`, `description`, `actions`, `leading`, `width` `narrow`/`default`/`wide`/`full`): Seitencontainer `mx-auto w-full p-4 sm:p-6 gap-6` mit optionalem `VeitPageHeader`.
  - `VeitButton` hat `size` (`sm`, `default`, `lg`, `icon`) statt `className="btn-sm"`; `veitButtonClass(variant, size)` für Elemente, die kein Button sein können.
  - Neu: `VeitIconButton` (`label` wird `aria-label` und `title`, `icon`, `variant`, `size` `default` 44×44 px oder `sm` 36×36 px, `asChild` für Links). `VeitRoundIconButton` in `@veit/react-auth-group` rendert jetzt `VeitButton size="icon"` mit gleicher Optik.
  - `theme.css`: `.btn-icon` und `.btn-icon-sm`; neues Token `--success` (`bg-success`, `text-success`).
  - `AppShell` hat `variant="fixed"` (`fixed inset-0`), statt `variant="viewport"` mit `!fixed !inset-0 !h-auto` wie in Plenivos `MainLayout`.
  - `VeitBackButton` baut auf `VeitButton` (ghost) auf und hat optional `label` und `labelClassName`. Ohne `className` sieht er aus wie bisher.
- `@veit/react-navigation`: `VeitBackButton` rendert den `VeitBackButton` aus `@veit/react-controls` mit den Shell-Tokens; Props und Optik bleiben. **Neue Peer-Dependency** `@veit/react-controls`: Hosts mit diesem Paket brauchen ein `pnpm install` (Lockfile).
- `@veit/intl`: `formatRelativeTime(date, now, locale)` ("vor 5 Minuten", "gestern"; Einheit nach Abstand bis Jahre) und `formatDurationMs(ms, locale)` ("1 Min. 21 Sek.", "2 Std. 5 Min.", unter 1 s in ms). Als Methoden `relativeTime` und `durationMs` auch an `VeitIntlFormatting`.
- `@veit/react-field-tags` re-exportiert die Typen und Helfer aus `@veit/field-tags` (`FieldTag`, `FieldDef`, `TagPickerOption`, `NestedFieldTagMutations`, `buildTagPickerOptions`, `buildTagChildrenMap`, `sortFields`, `tagsForField`, `toggleTagFilterId`, `expandFilterTagIds`, `entityMatchesTagFilter`, `setTableColumnTagFilter`, `tagIdFromTableColumnFilter`, `tagPickerOptionsById`, `saveNestedFieldTagTree`, `tagColor`, `tagColorHexForIndex` u. a.). `@veit/react-address` re-exportiert aus `@veit/address` `PostalAddress`, `PostalAddressWire`, `AddressSuggestion`, `EMPTY_POSTAL_ADDRESS`, `postalAddressFromWire`, `postalAddressToWire`, `formatAddressLines`, `parseNominatimAddressRow`, `searchAddressSuggestions`, `normalizeCountryCode`. Web-Apps importieren die Basispakete damit nicht mehr direkt.
- `@veit/db`: `createPool` nimmt `max`, `idleTimeoutMillis`, `connectionTimeoutMillis` und unter `pool` weitere `pg`-Optionen; ohne Angabe gelten die `pg`-Defaults wie bisher. Neu: `checkDatabase(pool)` (`SELECT 1`, wirft bei Fehler).
- `@veit/react-auth`:
  - `veitFetchJson` übernimmt `init.headers` (gewinnen gegen den JSON-Content-Type) und `init.signal`.
  - `VeitApiError` hat optional `detail` und `fields` aus Fehlerkörpern `{ code, detail, fields }`; der Konstruktor nimmt sie als viertes Argument. Bestehende Aufrufe und Unterklassen bleiben gültig.
  - Mit `init.networkErrorAsApiError` wird ein Netzwerkfehler zu `VeitApiError` mit `status` 0 (`VEIT_NETWORK_ERROR_STATUS`) und Code `network` (Text in `veitAuthMessages`). Ohne die Option wirft `veitFetchJson` wie bisher den `TypeError` von `fetch`. `isVeitNetworkError(err)` erkennt beides.
- `@veit/react-api-keys` `VeitApiKeysSection`:
  - `resourceMode="single"`: genau eine Ressource pro Key über `VeitSelect`, kein Schalter „Alle“. Anlegen ist gesperrt, solange es keine Ressource gibt. Default bleibt `all-or-selection`.
  - `fixedPermissions`: Die Rechte werden nicht angezeigt und immer so gesendet; `permissions` darf dann leer sein.
  - `errorCodeText(code)`: Text des Hosts für einen Fehlercode, vor `errorText` (der Name `errorText` ist schon für die bestehende Funktion vergeben).
  - `locale`: Ohne eigenes `formatTime` formatiert die Liste „Zuletzt benutzt“ mit `Intl.DateTimeFormat(locale)` statt `toLocaleString()` ohne Locale.
  - Optionale Texte `resource`, `unassigned`, `loading`. Damit deckt die Section Sprachassistents `KeysPage` ab (ein Key pro Chatbot, festes Recht `device.talk`).
- Neue Skripte in `scripts/`, mit Flags statt fester Pfade (Hosts ersetzen ihre Kopien später durch Aufrufe):
  - `check-i18n-literals.mjs` (`--src`, `--skip-dir`, `--ignore-marker`, `--t-fn`, `--code-prop`, `--allow-literal`, `--allow-geojson`, `--hint`). Die GeoJSON-Ausnahme aus Hochwasserdienst ist jetzt `--allow-geojson`; `tf` aus Sprachassistent ist Standard.
  - `check-i18n-hardcodes.mjs` (`--src`, `--locale-dir`, `--locale`, `--forbid`, `--key-re`, `--skip-keys`); nennt fehlende Schlüssel.
  - `check-sheet-dismiss.mjs` (`--src`, `--component`, `--prop`).
  - `only-pnpm.cjs` (`--pm`), `install-git-hooks.mjs` (`--source`, `--hook`).
  - `check-audit.mjs` (`--allowlist`, `--fail-on`, `--prod`); startet `pnpm` auch unter Windows.

## API-Keys wieder anzeigen, Bearbeiten im Popup

Stand 2026-11-02.

- `@veit/api-keys`: Neue Option `secret`. Damit speichert der Dienst neue Keys zusätzlich verschlüsselt (AES-256-GCM, Spalte `key_enc`, `API_KEYS_SCHEMA_SQL` legt sie per `ALTER TABLE … ADD COLUMN IF NOT EXISTS` an). `reveal(userId, id)` und `GET /me/api-keys/:id/key` geben den Key seinem Besitzer zurück. Die Liste meldet `revealable`. Ohne `secret` bleibt alles wie bisher, und ältere Keys bleiben nicht anzeigbar.
- `@veit/react-api-keys`: `VeitApiKeysSection` listet die Keys als `VeitListItem`. Ein Klick öffnet ein `VeitOverlayEditDialog` mit Draft: Key anzeigen und kopieren, Bezeichnung, Rechte und Geltungsbereich ändern, Sperren über `deleteAction` mit Bestätigung statt `window.confirm`. Ein neuer Key erscheint in einem eigenen Popup. Neue Peer-Dependencies: `@veit/react-dialog` und `lucide-react`. Neue Texte: `revokeTitle`, `notRevealable`, `key`, `show`, `hide`, `close`; `revokeConfirm` und `newKeyHint` sind kürzer. `createRestApiKeysClient` hat `reveal`.
- `VeitDeleteButton` hat die Klasse `btn` und damit dieselbe Größe wie `VeitButton`.
- `theme.css`: `.btn-primary`, `.btn-secondary`, `.btn-destructive` und `.btn-ghost` bringen die Grundmaße von `.btn` mit. Buttons sehen gleich aus, ob `btn` dabeisteht oder nicht. Bisher hatten zum Beispiel Abbrechen und Speichern im Dialog-Footer verschiedene Größen. Utility-Klassen wie `p-0` oder `!px-0` gelten weiter.
- Dialog-Footer: Löschen ist ein quadratischer Button in `.btn`-Höhe statt 44 px; Schließen und Zurück in den Presets haben kein `min-h-[44px]` mehr.
- Neu: `VeitSecretField` in `@veit/react-controls`. Ein Passwortfeld (auf Basis von `VeitPasswordField`) für Geheimnisse, die schon gespeichert sein können: Es zeigt eine Maske, das Auge lädt das Geheimnis über `onReveal`, ein optionaler Button kopiert es, und Tippen ersetzt es. Ohne `onChange` ist das Feld schreibgeschützt. Es löst Host-Eigenbauten wie `AdminStoredSecretField` in Plenivo ab.
- `VeitPasswordField` nutzt ohne `className` die Klasse `veitInputClass`. Vorher war das Eingabefeld ohne Klasse ungestylt.
- `VeitApiKeysSection` zeigt den Key in einem `VeitSecretField`.

## Plenivo zieht den Gitlink

Stand 2026-10-29. Plenivo prüft die Framework-Quellen mit React-18-Typen und nutzt Teile, die vorher nur intern waren.

- React-18-Typen: Formular-Handler nehmen `React.SyntheticEvent<HTMLFormElement>` statt `React.SubmitEvent`. Refs, die eine Komponente beschreibt, sind `{ current: T }` statt `RefObject<T>`.
- `@veit/react-dialog-router`: Die Rückrufe (`openFromUrl`, `resolveEntity`, `shouldOpenFromUrl`, `urlIdIsAuthoritativeForeign`) sind Methoden. Hosts mit `idMode: 'number'` dürfen `(id: number) => …` übergeben.
- `@veit/react-controls`: `useVeitInlineActionLayout` und `useVeitInlineActionMenu` sind wieder exportiert. Aktionen in `VeitResponsiveInlineActionBar` lesen damit, ob sie im Menü stehen und ob Labels passen. Die Mess-Helfer bleiben intern.
- `@veit/react-dnd`: `VeitDndContext` ist wieder exportiert. `VeitSortableRegion` braucht außerhalb von `VeitNestedBoardDndShell` einen Kontext. Die Sensoren bleiben intern.
- `@veit/map`: `buildBwWmtsKvpTileUrl` und `getCadastralPreviewUrl` sind exportiert, für Hosts, die Flurkarten-Kacheln selbst zeichnen (Plenivo mit Leaflet).
- `@veit/auth-server`: `AuthService.openSession(userId, req)` öffnet eine Sitzung für einen Nutzer, den der Host selbst geprüft hat, etwa beim Link aus der Bestätigungsmail.
- `VeitOptionPickerDialog`: Die Standard-Farbe ist `var(--primary)`. Vorher stand dort `rgb(var(--color-primary))`, das passt nicht zum Tailwind-4-Theme.

## Konten und API-Keys als Module

Stand 2026-10-29.

- Neu: `@veit/auth-server` (Server-Kontologik, bisher nur in Plenivo), `@veit/api-keys` und `@veit/react-api-keys`.
- `@veit/react-auth`: `createRestAuthClient`, `VeitApiError`/`veitFetchJson`, `VerifyEmailView`, Texte `veitAuthMessages`/`veitAuthT`/`veitAuthErrorText`.
  **Brechend:** `RegisterForm` leitet ohne `?next=` nach `afterRegisterPath` (Standard `/`) statt fest nach `/organizations/list`; Plenivo übergibt den Pfad. `LoginForm` hat `afterLoginPath`.
- `@veit/react-account`: `VeitAccountSettings` (ganze Kontoseite), `createRestAccountClient`, `veitAccountTexts`.

## Module statt Baukasten

Stand 2026-10-21. Neue Bausteine und die gestrichenen Paket-Exporte liegen im selben Stand. Kein `@deprecated`-Re-Export. Hosts, die die alten Namen importieren, müssen vorher auf die Module umstellen. Plenivo behält seine Kartenfassade, bis dieses Repo den Gitlink zieht.

### `@veit/react-map`

Neu: `VeitPolyline`, `VeitPolygon`, `VeitCircle` (Radius in Metern), `VeitMarker`, `VeitPopup`. Positionen sind `{ lng, lat }` oder `[lng, lat]`. `veitLngLat`, `veitLngLatPair` und `veitLngLatFromEvent` lesen die Position. `useVeitMapPointer` hängt Klick und Hover an die Karte. `useMap` und `useMapLayer` bleiben für Layer, die kein fertiges Shape sind.

### `@veit/map`

Weg vom Paketindex, intern weiter von `VeitMap` benutzt:

- `applyGlobe`
- `bindLiveSunLight`, `lightPositionForSun`, `setFixedLight`, `subsolarPoint`, `FIXED_LIGHT`
- `applyMapTerrain`, `clearMapTerrain`, `terrainDemSourceSpec`, `terrainExaggeration`, `terrainTilesUrl`
- `ensureBuildings3dLayer`, `removeBuildings3dLayer`
- `firstAnchorLayer`, `raiseAnchorLayers`

`mapTerrainEnabled` und `world3dAttribution` bleiben exportiert. `configureMap`, `bindMapConfig` und `getMapConfig` bleiben der Einstieg für Host-Daten.

### `@veit/react-controls`

Die Überlauf-Messung bleibt in `VeitResponsiveInlineActionBar`. Weg vom Paketindex:

- `measureEndContentWidth`, `rowGapPx`, `rowFixedOccupiedWidth`, `resolveShowInlineLabels`, `resolveNeedsMenuBySpace`, `siblingOccupiedWidth`, `stableLeadingWidth`, `resetHeaderLayoutMeasureRefs`
- `HEADER_LAYOUT_SAFETY_PX`, `HEADER_LABEL_HYSTERESIS_PX`
- `VeitInlineActionLayoutProvider`, `useVeitInlineActionLayout`
- `VeitInlineActionMenuProvider`, `useVeitInlineActionMenu`, `VeitInlineActionSurface`

`VeitInlineActionMenuOnly`, `VeitInlineActionInlineOnly` und `useMediaQuery` bleiben.

### `@veit/react-dnd`

Neu: `veitKanbanNestedBoardCollision` (`list-*` / `card-*`). Andere Prefix-Sätze bleiben im Host. `createVeitNestedBoardCollisionDetection` und `VeitNestedBoardCollisionConfig` bleiben.

Weg vom Paketindex. Kontext und Sensoren stecken in `VeitNestedBoardDndShell` und den Sortable-Listen:

- `VeitDndContext`, `useVeitDndSensors`
- Re-Exports aus `@dnd-kit/core` und `@dnd-kit/sortable` (`closestCenter`, `closestCorners`, `defaultDropAnimationSideEffects`, `DragOverlay`, `pointerWithin`, Drag-Event-Typen, `arrayMove`, die Sorting-Strategies)

### `@veit/react-address`

`VeitAddressFields` hat deutsche Default-Labels. `labels` ist `Partial` und überschreibt nur die gesetzten Schlüssel.

### `@veit/react-dialog`

Weg vom Paketindex. Die Dateien bleiben intern, die Presets und `VeitImagePicker` nutzen sie weiter:

- `acquireOverlayLayer`, `releaseOverlayLayer`, `useVeitOverlayLayer`, `useVeitOverlayLayerZIndex`
- `EntityDialogDismissBridge`

`@veit/react-dialog-router` exportiert `EntityDialogDismissBridge` weiter. Der Alias `EntityDialogDismissRef` ist weg. `useFormDirty` und `useDebouncedValue` bleiben.

## Pin

Stand 2026-10-21. Gemeinsamer Tip ist `origin/development`. ScanGut hat keine Karte. Plenivo und Hochwasser ziehen den Gitlink nach, ohne `deploy` zu pushen.

Flurkarte-Tests aus Plenivo (`mapCadastralSources`, `mapCadastralStateLookup`, `mapCadastralZoom`) sind in `@veit/map` vorhanden. GPX, GeoJSON-Import, Geodäsie und Kartensuche bleiben in Plenivo, die Funktionen liegen nicht im Paket.

## Host-Werkzeuge

`scripts/no-custom-css.mjs` prüft einen Host-`src`-Pfad (Argument oder `--src`). `--allow-css` darf nur Variablen und `@font-face` enthalten. `@veit/react-controls` exportiert `AppShell`.

## MapLibre 6

Peer und Abhängigkeit sind `maplibre-gl` ^6.4.1 (schließt Advisory 1193680). Es gibt keinen Default-Export mehr (`import * as maplibregl from "maplibre-gl"`). Paint-Ausdrücke kommen als `ExpressionSpecification` aus dem Paket.

## `@veit/map`, `@veit/react-map`

Neu. Gemeinsame Karte für Hochwasserdienst und Plenivo, siehe `packages/map/README.md`.

Hintergründe werden über `basemap` gesteuert (IDs `osm`, `satellite`, `topo`, `official`, `cadastral`). Die Flurkarten-Quellen kommen aus `@veit/map`. ScanGut hat keine Karte. Hochwasserdienst und Plenivo nutzen den MapLibre-Stand.

`configureMap` gilt für Karten, die danach entstehen. Jede Karte hält ihre eigene Kopie. `config` an `<VeitMap>` überschreibt sie für diese Karte. Custom-Layer überleben einen Style-Wechsel nicht und werden nicht mitkopiert. `useMapLayer` setzt Host-Ebenen nach jedem Style-Load neu. `devHandle` wird beim Unmount von `window` gelöscht. Die 3D-Welt kippt die Kamera nur einmal. three.js liegt hinter `@veit/map/world3d` und wird vom Host per `import()` geladen.

## Theme

`@veit/react-controls/theme.css` setzt die shadcn-Variablen und die Klassen `.btn`, `.input`, `.card`. Der Host lädt davor Tailwind (`@import "tailwindcss"`) und setzt `@source` auf App und Framework. Danach importiert er `theme.css`.

Vorher: Hosts haben `.btn-primary` und `.input` selbst definiert.
Nachher: Theme importieren und die Variablen überschreiben. Eigene Kopien der Klassen entfernen, sonst gewinnen sie je nach Reihenfolge.

## Entfernte Aliase

Weg: `DialogDetailField`, `DialogFormField`, `DialogDetailSection`, `DialogDetailSectionTitle`, `DialogToolbarButton`, `DialogInsetScroll`, `DialogSoftPanel`, `DialogDashedCta`, `DialogStickyActions`, `DeleteIconButtonLabel`, `dialogDetailFormStackClass`, `dialogDetailInputClass`, `dialogDetailTextareaClass`, `dialogDetailSelectClass`, `inputCompactClass`, `dialogDetailPickerTriggerClass`, `dialogDetailLabelClass`, `DELETE_ICON_BUTTON_CLASS`.

Stattdessen die `Veit…`-Namen und `veit…Class` / `VEIT_DELETE_ICON_BUTTON_CLASS`.

## `VeitSelect`

Vorher: natives `<select>` mit `children` als `<option>`.
Nachher: Radix Select. Props `options: { value, label, disabled? }[]`, `value`, `onValueChange`. `value` darf nicht leer sein.

## `VeitSwitch`

Vorher: `<button role="switch">`.
Nachher: `@radix-ui/react-switch`. Dieselben Props.

## `VeitButton`, `VeitPanel`

Neu. `VeitButton` hat `variant` `primary` | `secondary` | `destructive` und `asChild` für Links. `VeitPanel` ist eine `.card`-Fläche.

## Dialog

Die zentrierte Hülle von `VeitDialog` nutzt `@radix-ui/react-dialog` (Fokus, Portal). Escape bleibt am bisherigen History-Listener, Radix schluckt das Event. Die Bottom-Dock-Darstellung bleibt ein eigenes Portal, weil sie in einen Host-Knoten andockt.

## React

Peer bleibt `>=18`. Der Typecheck im Repository nutzt React 19, damit Lucide und Radix dieselbe `@types/react`-Linie sehen. Hosts mit React 18 müssen ihre Typen nicht umstellen, solange sie das Framework nicht selbst mit React-18-Typen gegen Lucide prüfen.

## Icons

`VeitBackButton` zeigt ohne eigenes `icon` ein Lucide-`ArrowLeft` statt des Textpfeils.

## `VeitPageHeader`

Vorher: BEM-Klassen `veit-page-header__title` und `bemPrefix`.
Nachher: Tailwind-Tokens. `bemPrefix` gibt es nicht mehr. Optik kommt aus dem Theme.

## Neu

Der Standard von `:root` ist dunkel. `[data-theme="light"]` setzt dieselben Namen auf die helle Fläche. Produktfarben (`band`, `catchment`, `series`, `depth-ramp`, `temp-ramp`) und `animate-ticker` liegen im Theme. `VeitButton` hat `ghost`. `VeitRange` zeichnet den Füllstand.

`.map-surface` färbt MapLibre-Controls und Popups über die Token. `VeitPanel` darf `ul` und `li` sein. `VeitStatusBadge` in `sm` nutzt `text-xs`.

`@source` zeigt auf das Framework-Paket, sonst fehlen dessen Utilities (`w-12`, `top-1/2`, `h-5`) in der Host-CSS. Wahlflächen nutzen `rounded-lg` wie `.btn` und `.input`, Kacheln `rounded-xl` wie `.card`. Segment-Wahl hängt an `.btn`, sonst fehlt der Radius. `.btn-primary`, `.btn-secondary` und `.btn-destructive` tragen `rounded-lg` auch ohne `.btn`. `.input` setzt `appearance: none`, damit `type="search"` keine Browser-Lupe zeichnet. `VeitList` setzt `list-none`. Leere Zustände stapeln mit `flex`. `settings-subsection` und `settings-page-group` haben Token-Klassen. `--color-on-primary` zeigt auf `--primary-foreground`.

`VeitAppHeader` stapelt unter `sm` Marke, Navigation und Werkzeuge. Ab `sm` liegen sie in einer Zeile. Die Werkzeugleiste bricht um. `density="compact"` hält die Leiste auch schmal in einer Zeile.

`@veit/address` und `@veit/field-tags` liefern Typen aus `src/index.ts`. Der Typecheck braucht dafür keinen vorherigen `dist`-Build. Der Laufzeit-Import bleibt `dist/index.js`.
