# Breadboard Canvas — Shaping Doc

An app that renders breadboard diagrams to a TLDraw whiteboard canvas, with markdown affordance tables as the source of truth.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Canvas updates live as we work | ✅ Complete |
| R1 | Multiple shapes displayed as labeled frames on same canvas | ✅ Complete |
| R2 | Frames stack vertically (CURRENT at top, then A, B, C...) | ✅ Complete |
| R3 | Shareable without complex local setup — others can use this workflow easily | ✅ Complete |
| R4 | Markdown-sourced frames are "protected" — regenerated from code | Future |
| R5 | User can sketch/annotate elsewhere on canvas — state persists | Future |
| R6 | Claude can read TLDraw state as input during shaping | Future |

---

## Shape A: Markdown → Mermaid-CLI → TLDraw Pipeline ✅ IMPLEMENTED

| Part | Mechanism |
|------|-----------|
| **A1** | File watcher monitors markdown file for changes (chokidar) |
| **A2** | Extract Mermaid code blocks from markdown (regex) |
| **A3** | Identify shape labels from markdown headings (CURRENT, A, B, C) |
| **A4** | mermaid-cli renders each Mermaid block → SVG (via Puppeteer) |
| **A5** | Convert SVG → base64 data URL |
| **A6** | Server sends diagram data to frontend via WebSocket |
| **A7** | TLDraw creates frames with labels, places rendered images inside |
| **A8** | Stack frames vertically (y-position based on index) |
| **A9** | On file change: re-render changed diagrams, update TLDraw shapes in place |

---

## Shape B: CLI Package ✅ IMPLEMENTED

| Part | Mechanism |
|------|-----------|
| **B1** | Package as npm module with bin entry (`bin/felt.js`) |
| **B2** | Single command: `felt ./doc.md` (or `npx felt ./doc.md` after publish) |
| **B3** | Starts backend + frontend automatically |
| **B4** | Opens browser to localhost:3456 |
| **B5** | File watcher for live updates (from Shape A) |

**Usage:**
```bash
# After npm link
felt ./my-shaping-doc.md

# Or run directly
./bin/felt.js ./my-shaping-doc.md
```

---

## Shape C: Two-Way TLDraw + Markdown (for R4-R6)

| Part | Mechanism |
|------|-----------|
| **C1** | **Element ownership tracking** |
| C1.1 | Generated shapes tagged with `meta: { source: 'markdown', blockIndex: 0 }` |
| C1.2 | User-created shapes have no `source` tag (or `source: 'user'`) |
| C1.3 | On re-render: only replace shapes where `source === 'markdown'` |
| **C2** | **State persistence** |
| C2.1 | TLDraw state saved to companion file: `doc.md` → `doc.tldraw.json` |
| C2.2 | On startup: load existing `.tldraw.json` if present |
| C2.3 | On user edit: auto-save to `.tldraw.json` (debounced) |
| C2.4 | On markdown change: merge new generated shapes with existing user shapes |
| **C3** | **Claude reads TLDraw state** |
| C3.1 | Export user shapes to a readable format (simplified JSON or pseudo-markdown) |
| C3.2 | Claude Code can read `.tldraw.json` or a `.tldraw.summary.md` |
| C3.3 | Or: MCP tool that returns current canvas state on demand |

**Data flow for Shape C:**

```
┌─────────────────┐         ┌─────────────────┐
│    doc.md       │────────▶│   TLDraw        │
│  (mermaid)      │ render  │   Canvas        │
└─────────────────┘         └────────┬────────┘
                                     │
                                     │ user edits
                                     ▼
┌─────────────────┐         ┌─────────────────┐
│ Claude Code     │◀────────│ doc.tldraw.json │
│ (reads state)   │  read   │ (persisted)     │
└─────────────────┘         └─────────────────┘
```

**Key question for C2:** Where does the merge happen?
- **Option C2-A**: Backend merges — keeps markdown shapes + user shapes in memory
- **Option C2-B**: Frontend merges — TLDraw handles it, backend just sends markdown shapes

C2-B feels cleaner — TLDraw already tracks shapes, we just need to not delete user shapes on update.

---

## Fit Check

| Req | Requirement | Status | A | B | C |
|-----|-------------|--------|---|---|---|
| R0 | Canvas updates live as we work | ✅ Complete | ✅ | ✅ | ✅ |
| R1 | Multiple shapes displayed as labeled frames | ✅ Complete | ✅ | ✅ | ✅ |
| R2 | Frames stack vertically | ✅ Complete | ✅ | ✅ | ✅ |
| R3 | Shareable without complex local setup | ✅ Complete | ❌ | ✅ | ✅ |
| R4 | Markdown-sourced frames are protected | Future | ❌ | ❌ | ✅ |
| R5 | User can sketch/annotate, state persists | Future | ❌ | ❌ | ✅ |
| R6 | Claude can read TLDraw state | Future | ❌ | ❌ | ✅ |

---

## Decisions

1. **Take Mermaid directly** — breadboarding skill outputs Mermaid diagrams; no need to parse affordance tables
2. **File watcher** — watch a markdown file, re-render on save
3. **Node + React** — Node server (mermaid-cli + file watcher) + React frontend (TLDraw)
4. **SVG via base64 data URL** — mermaid-cli outputs SVG; convert to base64 for TLDraw assets
5. **WebSocket for live updates** — server pushes new renders to frontend
6. **mermaid-cli over Beautiful Mermaid** — Beautiful Mermaid ignored classDef/styles; mermaid-cli uses official Mermaid.js via Puppeteer for correct rendering

---

## Completed Slices

### V1a: Mermaid rendering ✅
### V1b: TLDraw displays image ✅
### V2: Load from markdown file ✅
### V3: File watcher + WebSocket live updates ✅
### V4: Frames with labels ✅

---

## Spike Results

### Spike 1: TLDraw SDK ✅

| Question | Answer |
|----------|--------|
| **S1-Q1** Create canvas | `<Tldraw onMount={(editor) => ...} />` — React component with callback |
| **S1-Q2** Place images | Two steps: (1) `editor.createAssets([{id, type:'image', props:{src, w, h}}])` (2) `editor.createShape({type:'image', props:{assetId}})` |
| **S1-Q3** Frames with labels | `editor.createShape({type:'frame', props:{w, h, name:'Frame A'}})` |
| **S1-Q4** Reactivity | `editor.store.listen()` for changes, `editor.sideEffects.registerAfterChangeHandler()` for cascading updates |
| **S1-Q5** Update in place | Yes — `editor.updateShapes([{id, type, props}])`. Batch with `editor.batch()` for performance |

### Spike 2: Beautiful Mermaid ✅ (replaced)

Replaced with mermaid-cli. Beautiful Mermaid had its own simplified renderer that ignored `classDef` and `style` directives.

### Spike 3: mermaid-cli ✅

| Question | Answer |
|----------|--------|
| Invocation | `npx mmdc -i input.mmd -o output.svg` |
| Programmatic | Use `child_process.execFile` with temp files |
| Output | SVG file with full Mermaid.js styling (classDef, subgraph colors, etc.) |
| Trade-off | Slower (spawns Puppeteer) but renders correctly |
