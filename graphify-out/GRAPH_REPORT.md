# Graph Report - syln-test  (2026-09-19)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 107 nodes · 172 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `39410d24`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.js
- package.json
- server.test.js
- app.js
- favorites.js
- Ruang Dracin Page
- toggleFavorite
- loadCatalog
- wireDetailActions
- persistFavorites

## God Nodes (most connected - your core abstractions)
1. `createHandler()` - 13 edges
2. `toggleFavorite()` - 9 edges
3. `MockResponse` - 7 edges
4. `detailsMarkup()` - 7 edges
5. `titleCard()` - 7 edges
6. `api()` - 6 edges
7. `removeFavorite()` - 6 edges
8. `isFavorite()` - 6 edges
9. `openDetails()` - 6 edges
10. `loadCatalog()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Syln API` --semantically_similar_to--> `@syln/sdk`  [INFERRED] [semantically similar]
  public/index.html → package.json
- `Catalog Discovery Interface` --semantically_similar_to--> `Drama Catalog and Playback Features`  [INFERRED] [semantically similar]
  public/index.html → README.md
- `Adaptive Video Playback Interface` --semantically_similar_to--> `Drama Catalog and Playback Features`  [INFERRED] [semantically similar]
  public/index.html → README.md
- `Ruang Dracin Web Application` --references--> `@syln/sdk`  [EXTRACTED]
  README.md → package.json
- `invoke()` --calls--> `createHandler()`  [EXTRACTED]
  test/server.test.js → server.js

## Import Cycles
- None detected.

## Communities (10 total, 1 thin omitted)

### Community 0 - "server.js"
Cohesion: 0.13
Nodes (22): contentDisposition(), createHandler(), createServer(), fs, http, MIME_TYPES, os, parseBoolean() (+14 more)

### Community 1 - "package.json"
Cohesion: 0.12
Nodes (16): author, dependencies, @syln/sdk, description, engines, node, keywords, license (+8 more)

### Community 2 - "server.test.js"
Cohesion: 0.16
Nodes (10): assert, { createHandler }, fs, invoke(), mockClient(), MockResponse, mockTitle, { Readable, Writable } (+2 more)

### Community 3 - "app.js"
Cohesion: 0.19
Nodes (12): api(), configureQuality(), durationLabel(), elements, enableDefaultSubtitle(), favoriteSnapshot(), loadLanguages(), loadPlatforms() (+4 more)

### Community 4 - "favorites.js"
Cohesion: 0.44
Nodes (8): elements, escapeHtml(), favoriteCard(), favoriteKey(), loadFavorites(), removeFavorite(), render(), showToast()

### Community 5 - "Ruang Dracin Page"
Cohesion: 0.31
Nodes (9): Catalog Discovery Interface, Ruang Dracin Page, Syln API, Adaptive Video Playback Interface, Drama Catalog and Playback Features, Ruang Dracin Web Application, Web Application Security Hardening, Server-Side Token Isolation (+1 more)

### Community 6 - "toggleFavorite"
Cohesion: 0.57
Nodes (8): detailsMarkup(), escapeHtml(), favoriteButtonText(), favoriteKey(), isFavorite(), openDetails(), titleCard(), toggleFavorite()

### Community 7 - "loadCatalog"
Cohesion: 0.50
Nodes (4): loadCatalog(), renderSkeletons(), showStatus(), updatePagination()

### Community 8 - "wireDetailActions"
Cohesion: 0.67
Nodes (3): downloadEpisode(), showToast(), wireDetailActions()

## Knowledge Gaps
- **33 isolated node(s):** `fs`, `http`, `MIME_TYPES`, `os`, `path` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 40 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@syln/sdk` connect `Ruang Dracin Page` to `server.js`, `package.json`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **What connects `fs`, `http`, `MIME_TYPES` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12681159420289856 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._