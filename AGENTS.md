# Regeln für die Arbeit am Framework

Für Mitentwickler und KI-Agenten. Die README beschreibt das Framework, diese Datei, wie daran gearbeitet wird.

- **Hosts binden fertige Module ein**, keine einzelnen Low-Level-Helfer. Web-Apps nutzen `@veit/react-field-tags` statt `@veit/field-tags` direkt und `@veit/address` nur serverseitig oder über `@veit/react-address`.
- **Generische UI- und Server-Logik zuerst ins Framework**, nicht parallel in mehreren Hosts duplizieren.
- **Host-Dateien sind Adapter:** i18n, Branding, Env, API-Client, `bemPrefix` und Token-CSS. Keine zweite Implementierung neben einem Framework-Export.
- **Fachlogik bleibt im Host:** Billing, Kanban, Shop-Abläufe, Push/Firebase-Produktlogik usw.
- **App-Header mit Branding und Navigation bleibt im Host;** nur Mess- und Inline-Action-Bausteine liegen im Framework (`@veit/react-controls`).
- **Branches:** Hosts pinnen `origin/development`. `deploy` ist ein älterer, in Produktion ausgerollter Stand von `development`, nicht der gemeinsame Framework-Tip.
- Brechende Änderungen kommen in `CHANGES.md`.
