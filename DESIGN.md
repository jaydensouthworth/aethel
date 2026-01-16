# Codex (Working Title) — Design Document

## Vision Statement

An IDE for structured writing where narrative/informational elements become first-class symbols with definitions, references, mutation tracking, and consistency linting — abstracting the patterns that make code navigation powerful into a domain-agnostic writing environment.

---

## 1. Core Primitives

These are the foundational building blocks. Everything else is built on these.

### 1.1 Object

The universal primitive. An **Object** is any named entity the user wants to track.

```typescript
interface Object {
  id: string;                          // UUID
  name: string;                        // Primary display name
  aliases: string[];                   // Alternative names/references
  type: string;                        // User-defined type (see ObjectType)
  description: string;                 // Rich text summary
  attributes: Attribute[];             // Key-value pairs (flexible schema)
  created_at: Timestamp;
  
  // Computed/indexed
  references: Reference[];             // Where this object is mentioned
  mutations: Mutation[];               // State changes over timeline
  relationships: Relationship[];       // Connections to other objects
}
```

### 1.2 ObjectType

User-defined categories. These are just labels + optional attribute templates.

```typescript
interface ObjectType {
  id: string;
  name: string;                        // "Character", "Location", "Citation", "Chemical", etc.
  icon: string;                        // Emoji or icon identifier
  color: string;                       // For UI distinction
  attribute_template: AttributeTemplate[];  // Suggested attributes for this type
  
  // Optional behaviors
  timeline_relevant: boolean;          // Does this type track state over time?
  citation_style?: CitationFormat;     // For academic types: APA, MLA, etc.
}

// Examples of user-created types:
// - Fantasy: Character, Location, Item, Faction, Magic System, Event
// - Science: Citation, Dataset, Method, Hypothesis, Figure, Equation
// - History: Person, Place, Era, Document, Institution
// - Game Design: Character, Mechanic, Item, Quest, Region
```

### 1.3 Attribute

Flexible key-value data attached to Objects. No fixed schema — users define what matters.

```typescript
interface Attribute {
  key: string;                         // "eye_color", "population", "doi", "atomic_weight"
  value: AttributeValue;               // String, number, date, object reference, etc.
  source?: Reference;                  // Where this fact was established
  timeline_position?: TimelinePosition; // When this became true (for mutable attributes)
  confidence?: number;                 // For uncertain/speculative attributes
}

type AttributeValue = 
  | { type: 'string'; value: string }
  | { type: 'number'; value: number; unit?: string }
  | { type: 'date'; value: Date }
  | { type: 'reference'; object_id: string }
  | { type: 'list'; values: AttributeValue[] }
  | { type: 'rich_text'; content: DocumentFragment };
```

### 1.4 Timeline & TimelinePosition

The backbone for tracking when things happen and when attributes change.

```typescript
interface Timeline {
  id: string;
  name: string;                        // "Main Story", "Flashbacks", "Real-world dates"
  unit: TimelineUnit;
  markers: TimelineMarker[];           // Named positions for reference
}

interface TimelineUnit {
  name: string;                        // "Chapter", "Year", "Scene", "Day", etc.
  ordinal: boolean;                    // Is it sequential (ch 1, 2, 3) or named?
  subdivisions?: TimelineUnit;         // Chapters contain scenes, years contain months
}

interface TimelineMarker {
  id: string;
  name: string;                        // "The War Begins", "After the Coup", "2024-03-15"
  position: number | string;           // Numeric or named position
  description?: string;
}

interface TimelinePosition {
  timeline_id: string;
  position: number | string | TimelineMarker;
  relative?: 'before' | 'after' | 'during';  // "before the war", "during chapter 3"
}
```

### 1.5 Mutation

Tracks how an Object's attributes change over the timeline.

```typescript
interface Mutation {
  id: string;
  object_id: string;
  attribute_key: string;
  old_value: AttributeValue | null;    // null if attribute didn't exist
  new_value: AttributeValue | null;    // null if attribute removed
  timeline_position: TimelinePosition;
  source: Reference;                   // Where this change was described
  description?: string;                // "Lost his arm in the battle"
}

// Example: Character eye color changes
// Mutation { 
//   object_id: "gandalf", 
//   attribute_key: "status",
//   old_value: "Gandalf the Grey",
//   new_value: "Gandalf the White",
//   timeline_position: { marker: "fall-in-moria", relative: "after" }
// }
```

### 1.6 Relationship

Connections between Objects.

```typescript
interface Relationship {
  id: string;
  source_object_id: string;
  target_object_id: string;
  type: string;                        // User-defined: "parent_of", "located_in", "cites", etc.
  bidirectional: boolean;              // Is the relationship symmetric?
  attributes: Attribute[];             // Relationship can have its own data
  timeline_position?: TimelinePosition; // When relationship began (if relevant)
  end_position?: TimelinePosition;     // When relationship ended
}
```

### 1.7 Reference

A location in a document where an Object is mentioned.

```typescript
interface Reference {
  object_id: string;
  document_id: string;
  position: DocumentPosition;          // Line/column or node path
  context: string;                     // Surrounding text snippet
  reference_type: 'explicit' | 'inferred';  // User-linked vs AI-detected
  alias_used?: string;                 // Which name/alias was used here
}
```

---

## 2. Document Model

### 2.1 Project Structure

```
project/
├── codex.json                    # Project config, type definitions, timelines
├── objects/
│   ├── characters/               # Organized by type (optional)
│   │   ├── gandalf.obj.md
│   │   └── frodo.obj.md
│   ├── locations/
│   │   └── shire.obj.md
│   └── _index.json               # Object registry with metadata
├── documents/
│   ├── chapters/
│   │   ├── 01-the-beginning.md
│   │   └── 02-the-journey.md
│   └── notes/
│       └── outline.md
└── .codex/
    ├── references.db             # SQLite: computed references index
    ├── cache/                    # LLM response cache
    └── history/                  # Undo/version history
```

### 2.2 Object Definition Format (.obj.md)

Objects are defined in a markdown-like format with YAML frontmatter.

```markdown
---
id: gandalf-the-grey
type: character
aliases:
  - Mithrandir
  - The Grey Pilgrim
  - Gandalf the White @after(fall-in-moria)
---

# Gandalf

Wizard of the Istari order, sent to Middle-earth to contest the power of Sauron.

## Attributes

| Key | Value | As Of |
|-----|-------|-------|
| race | Maia | — |
| title | The Grey | @before(fall-in-moria) |
| title | The White | @after(fall-in-moria) |
| staff | Grey staff | @before(orthanc-confrontation) |
| staff | White staff | @after(return-from-death) |

## Relationships

- [[Frodo Baggins]] — ring-bearer he guides
- [[Saruman]] — former ally, @after(orthanc-confrontation): enemy
- [[Shadowfax]] — mount, @after(rohan-arrival)

## Notes

Free-form notes, can contain [[references]] to other objects.
```

### 2.3 Document Format (Narrative/Content)

The actual writing, with inline object references and timeline markers.

```markdown
---
document_id: chapter-01
title: The Long-Expected Party
timeline: main-story
position: 1
---

# The Long-Expected Party

When Mr. [[Bilbo Baggins]] of [[Bag End]] announced that he would 
shortly be celebrating his eleventy-first birthday, there was much 
talk and excitement in [[Hobbiton]].

{@flashback: bilbos-adventure}
Sixty years before, the remarkable disappearance and unexpected 
return of [[Bilbo Baggins|Mr. Baggins]] had been a nine days' wonder.
{/@flashback}

The old hobbit had been preparing for his departure, though none 
knew it. His nephew [[Frodo Baggins|Frodo]] would inherit [[Bag End]] 
and most of his possessions — including, though it was not discussed, 
[[The One Ring|a certain gold ring]].
```

---

## 3. Markup Grammar

### 3.1 Reference Syntax

```
[[Object Name]]                    — Simple reference
[[Object ID|Display Text]]         — Reference with custom display
[[~Object Name]]                   — Tentative/uncertain reference
[[?unknown person]]                — Placeholder for unresolved reference
```

### 3.2 Timeline Syntax

```
@before(marker-name)               — Position: before a marker
@after(marker-name)                — Position: after a marker  
@during(marker-name)               — Position: during a marker
@at(chapter:3)                     — Position: at specific unit
@range(marker-a, marker-b)         — Position: spanning a range

{@flashback: marker-name}          — Block: content occurs at different time
...content...
{/@flashback}

{@flash-forward: marker-name}      — Block: content occurs in future
...content...
{/@flash-forward}

{@concurrent: timeline-name}       — Block: content on parallel timeline
...content...
{/@concurrent}
```

### 3.3 Attribute Mutation Syntax (in narrative)

```
[[Character::attribute=new_value]] — Inline attribute change
[[Gandalf::title=The White]]       — "Gandalf became known as The White"

{@state-change: object-name}       — Block describing a change
attribute: new_value
reason: description
{/@state-change}
```

### 3.4 Meta/Annotation Syntax

```
{!note: This needs fact-checking}  — Author note (not rendered)
{!todo: Expand this scene}         — Todo marker
{!query: What year was this?}      — Question for later
{!ai: Suggest description}         — LLM prompt marker

{#tag-name}                        — Content tagging
{#theme:loss} {#mood:somber}
```

---

## 4. LSP-Style Features

### 4.1 Diagnostics (Linting)

```typescript
interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  range: DocumentRange;
  message: string;
  code: string;                    // Diagnostic type identifier
  source: 'temporal' | 'reference' | 'consistency' | 'style' | 'ai';
  fixes?: QuickFix[];
}
```

#### Diagnostic Categories

**Temporal Consistency**
- `temporal/anachronism` — Attribute referenced before it was set
- `temporal/dead-reference` — Reference to object that doesn't exist at this point
- `temporal/sequence-violation` — Events out of causal order

**Reference Issues**
- `reference/unresolved` — `[[Unknown Thing]]` doesn't match any object
- `reference/ambiguous` — Multiple objects could match
- `reference/alias-outdated` — Using old name after rename event

**Attribute Consistency**  
- `consistency/contradiction` — "Blue eyes" here, "brown eyes" elsewhere
- `consistency/unstated-change` — Attribute changed without mutation record

**Style (Optional)**
- `style/passive-voice` — Excessive passive construction
- `style/repetition` — Word/phrase repeated nearby
- `style/readability` — Sentence complexity warning

### 4.2 Autocomplete

Triggers:
- `[[` — Start of object reference → suggest objects
- `[[Object|` — After pipe → suggest aliases
- `@` — Timeline marker → suggest markers
- `{@` — Block annotation → suggest block types
- `::` — After object reference → suggest attributes

```typescript
interface CompletionItem {
  label: string;
  kind: 'object' | 'alias' | 'marker' | 'attribute' | 'keyword';
  detail?: string;                 // Type, preview
  documentation?: string;          // Full description
  insertText: string;
  object_id?: string;              // For object references
}
```

### 4.3 Hover Information

```typescript
interface HoverInfo {
  range: DocumentRange;
  contents: {
    object_summary?: ObjectSummary;
    attribute_state?: AttributeAtPosition;  // Value at this point in timeline
    mutations_nearby?: Mutation[];          // Recent changes
    reference_count?: number;
    preview?: string;                       // Rich preview
  };
}
```

### 4.4 Go To Definition / Find References

- **Go to Definition**: From `[[Gandalf]]` → open `gandalf.obj.md`
- **Find All References**: From object definition → list all mentions
- **Find in Timeline**: Show references organized by timeline position

### 4.5 Rename Symbol

Renaming an object updates:
- The object's `name` field
- All `[[references]]` throughout documents
- Optionally adds old name to `aliases`

---

## 5. LLM Integration Points

### 5.1 Provider Abstraction

```typescript
interface LLMProvider {
  id: string;                      // 'anthropic', 'openai', 'openrouter', 'local'
  name: string;
  models: LLMModel[];
  
  complete(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<LLMChunk>;
}

interface LLMConfig {
  providers: {
    [provider_id: string]: {
      api_key?: string;            // Or from env var
      base_url?: string;           // For self-hosted/proxies
      default_model?: string;
    };
  };
  
  tasks: {
    [task_name: string]: {
      provider: string;
      model: string;
      temperature?: number;
      max_tokens?: number;
    };
  };
}
```

### 5.2 LLM Tasks

| Task | Description | Trigger |
|------|-------------|---------|
| `reference-detection` | Find object mentions in text | On document change (debounced) |
| `consistency-check` | Deep consistency analysis | Manual or on save |
| `attribute-extraction` | Extract facts about objects from prose | Manual per-document |
| `alias-resolution` | Determine if "the wizard" = "Gandalf" | On ambiguous reference |
| `summary-generation` | Generate object descriptions | Manual |
| `relationship-inference` | Suggest relationships from text | Manual or background |
| `timeline-placement` | Infer where content falls on timeline | On timeline ambiguity |
| `writing-assist` | General writing help, continuation | User-invoked |

### 5.3 Context Building

When invoking LLM, build context from:

```typescript
interface LLMContext {
  // Always included
  document_content: string;        // Current document or selection
  document_position: TimelinePosition;
  
  // Included based on task
  relevant_objects: Object[];      // Objects referenced or nearby
  object_states: ObjectState[];    // Attribute values at current timeline position
  recent_mutations: Mutation[];    // Recent changes for context
  project_types: ObjectType[];     // So LLM understands the schema
  
  // Optional
  style_guide?: string;            // User's writing preferences
  previous_context?: string;       // Prior conversation in session
}
```

### 5.4 Response Handling

LLM responses that modify project state:

```typescript
interface LLMSuggestion {
  type: 'reference' | 'mutation' | 'relationship' | 'attribute' | 'diagnostic';
  confidence: number;
  data: any;                       // Type-specific payload
  
  // User reviews before applying
  status: 'pending' | 'accepted' | 'rejected';
}
```

---

## 6. UI Architecture

### 6.1 Layout Regions

```
┌─────────────────────────────────────────────────────────────────────┐
│  Menu Bar                                                           │
├──────────┬──────────────────────────────────────────┬───────────────┤
│          │                                          │               │
│  File    │                                          │   Inspector   │
│  Tree    │            Editor Pane                   │   Panel       │
│          │                                          │               │
│  ─────── │  - Document content                      │  - Object     │
│          │  - CodeMirror 6 instance                 │    details    │
│  Objects │  - Inline diagnostics                    │  - Attributes │
│  Browser │  - Timeline gutter (optional)            │  - Relations  │
│          │                                          │  - Mutations  │
│          │                                          │  - References │
│          ├──────────────────────────────────────────┤               │
│          │            Panel Area                    │               │
│          │  - Problems/Diagnostics                  │               │
│          │  - Timeline View                         │               │
│          │  - Search Results                        │               │
│          │  - AI Chat                               │               │
├──────────┴──────────────────────────────────────────┴───────────────┤
│  Status Bar                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Core Views

**Editor View**
- CodeMirror 6 with custom grammar
- Gutter: line numbers, timeline markers, fold controls
- Inline: diagnostics, object reference styling
- Minimap (optional)

**Object Browser**
- Tree grouped by type
- Search/filter
- Quick-create new object
- Drag to insert reference

**Inspector Panel** (context-sensitive)
- When cursor on object reference: show object details, state at current position
- When in document: show document metadata, outline
- When object selected: full object editor

**Timeline View**
- Visual timeline with markers
- Objects/events placed on timeline
- Current document position indicator
- Click to navigate

**Graph View**
- Force-directed graph of object relationships
- Filter by type, relationship type
- Click to navigate

**Problems Panel**
- List of diagnostics
- Filter by severity, source
- Click to navigate to issue

**AI Panel**
- Chat interface for writing assistance
- Context-aware (knows current document, selection, objects)
- Can generate suggestions that become reviewable changes

### 6.3 Modals/Dialogs

- **Object Quick-Create**: `Cmd+Shift+O` — create object from selected text
- **Reference Picker**: When typing `[[`, fuzzy search popup
- **Timeline Picker**: When typing `@`, timeline/marker selector
- **Command Palette**: `Cmd+Shift+P` — all actions
- **Settings**: Project config, LLM providers, keybindings

---

## 7. Data Flow & State Management

### 7.1 State Architecture

```typescript
// Using Svelte 5 runes for reactive state
// These would live in .svelte.ts files as shared stores

// project.svelte.ts
export const project = $state<{
  config: ProjectConfig;
  objects: Map<string, Object>;
  documents: Map<string, Document>;
  timelines: Map<string, Timeline>;
}>({
  config: defaultConfig,
  objects: new Map(),
  documents: new Map(),
  timelines: new Map(),
});

// indices.svelte.ts (computed/rebuilt on load)
export const indices = $state<{
  references: ReferenceIndex;
  search: SearchIndex;
  timeline: TimelineIndex;
}>({ ... });

// ui.svelte.ts (ephemeral)
export const ui = $state<{
  open_documents: DocumentTab[];
  active_document: string | null;
  selection: Selection | null;
  panel_visibility: PanelState;
  inspector_target: InspectorTarget;
}>({ ... });

// Derived state example
export const activeDocumentContent = $derived(
  ui.active_document 
    ? project.documents.get(ui.active_document) 
    : null
);

// ai.svelte.ts
export const ai = $state<{
  pending_suggestions: LLMSuggestion[];
  chat_history: ChatMessage[];
  active_tasks: LLMTask[];
}>({ ... });
```

### 7.2 Persistence Strategy

**Immediate writes:**
- Document content (debounced autosave)
- Object definitions

**Background writes:**
- Reference index (SQLite)
- Search index
- LLM cache

**On explicit save:**
- Full project snapshot
- Export options

---

## 8. Technical Stack

### 8.1 Core

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | **Tauri 2** + **Svelte 5** | Native-like, offline-first, Rust backend, fine-grained reactivity |
| Editor | **CodeMirror 6** | LSP-like architecture, custom grammars |
| Parser | **Lezer** (CM6 default) | Incremental, fast, tree-sitter-like |
| State | **Svelte Runes** ($state, $derived, $effect) | Built-in fine-grained reactivity, no external lib needed |
| Storage | **SQLite** (via Tauri) | References index, search, cache |
| Files | Native FS (via Tauri) | Direct file access, watch for changes |

### 8.2 Optional/Future

| Feature | Technology | Notes |
|---------|------------|-------|
| Graph visualization | **D3** or **Cytoscape** | Relationship explorer |
| Rich preview | **Marked** + Svelte components | Preview pane with interactive elements |
| Export | **Pandoc** (bundled or wasm) | PDF, DOCX, EPUB |
| Sync (future) | **CRDTs** (Automerge/Yjs) | Real-time collab |
| Animations | **Svelte transitions** | Built-in, no extra lib needed |

### 8.3 LLM Integration

```typescript
// Unified client that routes to configured providers
class LLMClient {
  constructor(config: LLMConfig) {}
  
  async complete(task: string, context: LLMContext): Promise<LLMResponse> {
    const taskConfig = this.config.tasks[task];
    const provider = this.providers[taskConfig.provider];
    return provider.complete({
      model: taskConfig.model,
      messages: this.buildMessages(task, context),
      ...taskConfig,
    });
  }
}
```

---

## 9. Implementation Phases

### Phase 1: Core Editor (MVP)
- [ ] Tauri + Svelte 5 scaffolding
- [ ] CodeMirror 6 with basic markdown
- [ ] Object reference syntax `[[...]]` with highlighting
- [ ] File tree for documents
- [ ] Object definition files (.obj.md) with YAML frontmatter
- [ ] Basic object browser sidebar
- [ ] Go to definition / hover preview

### Phase 2: Object System
- [ ] Full object data model
- [ ] Inspector panel for object editing
- [ ] Attribute system with templates
- [ ] Relationship tracking
- [ ] User-defined types with icons/colors

### Phase 3: Timeline
- [ ] Timeline data model
- [ ] Timeline syntax parsing
- [ ] Timeline view (visual)
- [ ] Mutation tracking
- [ ] "State at position" queries

### Phase 4: LSP Features
- [ ] Reference index (SQLite)
- [ ] Diagnostic system infrastructure
- [ ] Temporal consistency linting
- [ ] Reference validation linting
- [ ] Quick fixes

### Phase 5: LLM Integration
- [ ] Provider abstraction
- [ ] Settings UI for API keys
- [ ] Reference detection task
- [ ] AI chat panel
- [ ] Suggestion review workflow

### Phase 6: Polish & Advanced
- [ ] Graph view
- [ ] Export (PDF, DOCX, EPUB via Pandoc)
- [ ] Theming
- [ ] Custom keybindings
- [ ] Plugin system (?)

---

## 10. Open Questions

1. **File format**: Should objects be YAML, TOML, JSON, or custom markdown with frontmatter?
   
2. **Reference storage**: Store resolved references in document, or always compute from text?

3. **Multi-file objects**: Can an object span multiple files? (e.g., chapters about a character)

4. **Collaboration model**: If we add sync, CRDT on document level or finer-grained?

5. **Mobile/web version**: Tauri is desktop-only; web version would need different storage layer.

6. **Versioning**: Git integration? Built-in version history? Both?

---

## Appendix A: Example Project Configurations

### Fantasy Novel

```yaml
# codex.json
project:
  name: "The Last Kingdom"
  type: fiction
  
types:
  - name: Character
    icon: 👤
    color: blue
    timeline_relevant: true
    attributes:
      - key: race
      - key: age
      - key: status
        
  - name: Location
    icon: 🏰
    color: green
    attributes:
      - key: region
      - key: population
      - key: climate
        
  - name: Item
    icon: ⚔️
    color: amber
    attributes:
      - key: type
      - key: magical
      - key: owner
        type: reference
        
timelines:
  - name: Main Story
    unit: chapter
    markers:
      - id: war-begins
        name: "The War Begins"
        position: 12
```

### Scientific Paper

```yaml
project:
  name: "Neural Network Survey"
  type: academic
  
types:
  - name: Citation
    icon: 📄
    color: slate
    attributes:
      - key: authors
      - key: year
      - key: journal
      - key: doi
    citation_style: APA
    
  - name: Term
    icon: 📖
    color: purple
    attributes:
      - key: definition
      - key: introduced_by
        type: reference
        
  - name: Method
    icon: ⚙️
    color: cyan
    attributes:
      - key: type
      - key: complexity
      - key: first_proposed
        type: reference
```

---

## Appendix B: Diagnostic Examples

```typescript
// Example diagnostics

{
  severity: 'error',
  code: 'temporal/anachronism',
  message: 'Reference to "Gandalf the White" occurs before transformation at "fall-in-moria"',
  range: { start: { line: 45, col: 12 }, end: { line: 45, col: 32 } },
  fixes: [
    { title: 'Change to "Gandalf the Grey"', edit: { ... } },
    { title: 'Move timeline marker', edit: { ... } }
  ]
}

{
  severity: 'warning',
  code: 'consistency/contradiction',
  message: 'Character eye color is "blue" here but "brown" in chapter-03.md:142',
  range: { ... },
  fixes: [
    { title: 'Change to "brown"', edit: { ... } },
    { title: 'Add mutation record', edit: { ... } },
    { title: 'Go to other reference', action: 'navigate' }
  ]
}

{
  severity: 'info',
  code: 'reference/alias-outdated', 
  message: '"Tom" renamed to "Thomas" as of chapter 5. Consider updating reference.',
  range: { ... }
}
```

---

*Document Version: 0.1.0*
*Last Updated: 2025-01-15*
