# Graph Report - syln-test  (2026-09-17)

## Corpus Check
- 2 files · ~3,068 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 77 nodes · 113 edges · 8 communities
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Package Configuration
- Secure API Server
- Server Test Harness
- Product Security Concepts
- Playback Lifecycle
- Title Detail UI
- Catalog Rendering
- API Data Loading

## God Nodes (most connected - your core abstractions)
1. `createHandler()` - 11 edges
2. `MockResponse` - 7 edges
3. `api()` - 6 edges
4. `loadCatalog()` - 6 edges
5. `openDetails()` - 6 edges
6. `escapeHtml()` - 5 edges
7. `invoke()` - 4 edges
8. `scripts` - 4 edges
9. `@syln/sdk` - 4 edges
10. `Ruang Dracin Page` - 4 edges

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

## Communities (8 total, 0 thin omitted)

### Community 0 - "Package Configuration"
Cohesion: 0.12
Nodes (16): author, dependencies, @syln/sdk, description, engines, node, keywords, license (+8 more)

### Community 1 - "Secure API Server"
Cohesion: 0.20
Nodes (15): createHandler(), createServer(), fs, http, MIME_TYPES, parsePositiveInteger(), path, PUBLIC_DIR (+7 more)

### Community 2 - "Server Test Harness"
Cohesion: 0.17
Nodes (9): assert, { createHandler }, invoke(), mockClient(), MockResponse, mockTitle, { Readable, Writable }, response() (+1 more)

### Community 3 - "Product Security Concepts"
Cohesion: 0.31
Nodes (9): Catalog Discovery Interface, Ruang Dracin Page, Syln API, Adaptive Video Playback Interface, Drama Catalog and Playback Features, Ruang Dracin Web Application, Web Application Security Hardening, Server-Side Token Isolation (+1 more)

### Community 4 - "Playback Lifecycle"
Cohesion: 0.36
Nodes (6): configureQuality(), elements, openPlayer(), requestPlayback(), setPlayerLoading(), state

### Community 5 - "Title Detail UI"
Cohesion: 0.60
Nodes (5): detailsMarkup(), durationLabel(), escapeHtml(), openDetails(), titleCard()

### Community 6 - "Catalog Rendering"
Cohesion: 0.50
Nodes (4): loadCatalog(), renderSkeletons(), showStatus(), updatePagination()

### Community 7 - "API Data Loading"
Cohesion: 0.67
Nodes (3): api(), loadLanguages(), loadPlatforms()

## Knowledge Gaps
- **26 isolated node(s):** `author`, `@syln/sdk`, `description`, `node`, `keywords` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 31 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@syln/sdk` connect `Product Security Concepts` to `Package Configuration`, `Secure API Server`?**
  _High betweenness centrality (0.320) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `loadCatalog()` (e.g. with `app.js` and `showStatus()`) actually correct?**
  _`loadCatalog()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `author`, `@syln/sdk`, `description` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Package Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._