# Admin UI kit (`src/ui`)

Every admin page is built **only** from this kit — no legacy classes from `styles/global.css`
(`a-panel`, `tbl`, `kpi`, `btn`, `badge`, `field`, `Modal`, `ResourceManager`, `Pagination`, …).
Reference implementation: `src/pages/Dashboard.jsx`. Styles live in `ui.css` (all classes `u-*`).

```js
import { Page, Card, Stat, DataTable, Drawer, Button, Field, Input, Select, Textarea, Switch, Status, Cell,
  Avatar, Thumb, Tabs, Segmented, KeyValue, Timeline, EmptyState, Loader, Alert, ImageUpload, FormSection,
  Menu, useConfirm, toast, useAsync, AreaChart, BarList, SegmentBar, downloadCsv } from '../ui';
```

## Page anatomy
- `<Page title description actions tabs back eyebrow badge>` wraps every screen. `actions` = right-aligned
  buttons (primary action last, `variant="primary"`). `back="/orders"` + `eyebrow="Orders"` for detail pages.
- Data loading: `const { data, setData, loading, error, reload } = useAsync(service.list)` and wrap content in
  `<Loader loading={loading && !data} error={!data ? error : ''} onRetry={reload}>`.
- Lists: a `Card flush` containing a `DataTable` (search, filters, sortable columns, CSV export via
  `exportName`, row `Menu` via `rowActions`, pagination, skeletons, empty states — all built in).
  Use `Cell` for two-line cells (`avatar`/`thumb` + title + sub), `Status` for any status text (tone is
  derived from the text; pass `tone` to override), right-align money with `align: 'right'`.
- Detail / edit: open a right-side `Drawer` (title, description, footer with Cancel + primary Save). Big
  editors (cake, blog post, order) get their own routed page with a `u-grid main-side` layout: main column of
  Cards + a side column (status, summary, actions).
- Forms: `Field` (label, hint, error, required) wrapping `Input` / `Select` / `Textarea`; `Switch` for booleans
  (with label + description); group with `<div className="u-form-grid two">`; settings-style pages use
  `FormSection` (title + description left, fields right). Show field errors inline, disable Save while saving
  (`loading` prop on Button), and track dirty state for "Unsaved changes".
- Feedback: `toast.success(title, sub)`, `toast.error(title, err.message)`. Destructive actions:
  `if (await confirm({ title, message, confirmLabel: 'Delete', danger: true }))` via `const confirm = useConfirm()`.
- Empty states always explain what the section is for and offer the primary action.
- Layout helpers: `u-stack` (vertical gap 20), `u-stack tight`, `u-row`, `u-row between`, `u-grid cols-2|3|4`,
  `u-grid main-side` (content + 360px side), `u-grid side-main`, `u-spacer`, text helpers `u-muted`, `u-small`,
  `u-xs`, `u-strong`, `u-num`, `u-mono`, `u-link`.
- Icons: `<Icon name="…" />` from `components/common/Icon` — names in `utils/iconPaths.js`.
- Mobile: everything must work at 390px wide (drawers become bottom sheets automatically; DataTable scrolls
  horizontally; use `u-grid` so columns collapse).

## Quality bar
Detailed, not bare: every list has search + useful filters + export; every row opens a detail view; every
detail view shows all stored information, related records and a history/timeline where it exists; every
action gives feedback and handles errors; no dead buttons, no placeholder text.
