# @veit/react-dialog

Modal dialogs for React: portals, browser-history sync (`history.back()`), unsaved-changes prompts, z-index stacking, and accessible roles.

**Peer dependencies:** `react`, `react-dom`, `lucide-react`

**Theming:** Tailwind utility classes (`btn-primary`, `border-border`, `bg-surface`, …). The host app supplies compatible CSS.

## Public API

`VeitDialog` (low-level) is **not** exported. Use presets only.

| Preset | Use case | History mode |
|--------|----------|--------------|
| `VeitEntityEditDialog` | Edit entity with deep-link URL (`dismissRef` required) | `entity` |
| `VeitOverlayEditDialog` | Edit overlay (admin, nested editors, create flows) | `overlay` |
| `VeitSheetEditDialog` | Edit in bottom sheet (map tool) | `sheet` |
| `VeitEntityActionDialog` | One-shot action with deep-link | `entity` |
| `VeitOverlayActionDialog` | One-shot overlay (import, picker close) | `overlay` |
| `VeitSheetActionDialog` | One-shot sheet | `sheet` |
| `VeitWizardDialog` | Multi-step wizard | `overlay` |
| `VeitPickerDialog` | Selection dialog | `overlay` |
| `VeitTabbedOverlayEditDialog` | Tabbed overlay editor | `overlay` |

Also: `VeitConfirmDialog`, `VeitPromptDialog`, `VeitOptionPickerDialog`.

## Edit dialog pattern (required)

```tsx
import { useDialogFormBaseline, useManagedOverlayDialog } from '@veit/react-dialog';
import { OverlayEditDialog } from '@/components/ui/AppDialog';

const dialog = useManagedOverlayDialog();
const [draft, setDraft] = useState(initial);
const { dirty, formBaseline } = useDialogFormBaseline({
  draft,
  resolveBaseline: () => structuredClone(initial),
  resetDeps: [dialog.binding.open, entityId],
  track: dialog.binding.open,
});

<OverlayEditDialog
  binding={dialog.binding}
  footerProps={{
    busy: saving,
    dirty,
    formBaseline, // required with dirty
    cancelLabel: t('common.cancel'),
    saveLabel: t('common.save'),
    onSave: async () => {
      await api.save(draft);
      // Do NOT call onClose here — footer dismisses via dismissAfterSave
    },
  }}
>
  …
</OverlayEditDialog>
```

### Overlay `binding` (required)

Overlay presets (`VeitOverlayEditDialog`, `VeitOverlayActionDialog`, `VeitOverlayDialog`, `VeitPickerDialog`, `VeitWizardDialog`, `VeitTabbedOverlayEditDialog`) **do not accept** `open` / `onClose`. Use a branded binding:

| Hook | When |
|------|------|
| `useManagedOverlayDialog()` | Own dialog state — `{ binding, show, hide }` |
| `useManagedOverlayDialogBinding(open, onClose)` | Derived or passed-through open state (wrapper components) |

`Entity*Dialog` and `Sheet*Dialog` still use `open` + `onClose` (deep-link / sheet flows).

### Rules

1. **Keep the dialog mounted** — toggle `binding.open` only; never `{open && <OverlayEditDialog …>}`.
2. **`dirty` + `formBaseline`** — both required in `*EditDialog` `footerProps` (use `useDialogFormBaseline`).
3. **`onSave` only persists** — do not call `onClose`/`dismiss` in `onSave`; the footer calls `dismissAfterSave` after success.
4. **`submitFormId` exception** — when using `submitFormId`, the form's `onSubmit` must close the dialog itself (e.g. via `useVeitDialogDismissAfterSave()`), because the footer only calls `requestSubmit()`.

Dev mode: unmounting an overlay dialog without `binding.open = false` logs a console error.

### Create vs edit

- **Create:** `saveRequiresDirty: false` (save with valid defaults immediately).
- **Edit:** `saveRequiresDirty: true` (default) — save disabled when not dirty.

## Dirty helpers

- `useDialogFormBaseline` — draft/baseline state + `dirty` + `formBaseline` for footer
- `isDraftDirty`, `useFormDirty`, `hasAnyFieldInput` — manual comparisons

## Hooks

- `useVeitDialogDismiss` — dismiss from nested content
- `useVeitDialogDismissAfterSave` — programmatic close after save (for `submitFormId` forms)
- `useVeitDialogNestedZIndexBase` — z-index for nested dialogs

## Unsaved changes

Edit presets enable unsaved-changes confirm on close. Wrap the app with `VeitDialogUnsavedConfirmProvider` (Plenivo: `LocaleProvider`).

## Plenivo integration

See [`docs/dialogs.md`](../../../docs/dialogs.md) in the Plenivo repo for app-specific conventions and ESLint rules.
