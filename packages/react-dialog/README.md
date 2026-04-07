# @veit/react-dialog

Modal dialogs built with React portals: backdrop, optional `history.pushState` sync for browser back, Escape/backdrop close, and accessible roles.

Exports: `VeitDialog`, `VeitDialogFooter`, `VeitDialogCloseButton`, `VeitConfirmDialog`, `VeitPromptDialog`.

**Peer dependencies:** `react`, `react-dom`, `lucide-react` (close icon).

**Theming:** Uses Tailwind utility classes (`btn-primary`, `border-border`, `bg-surface`, …). Ship compatible CSS in the host app; this package does not bundle styles.
