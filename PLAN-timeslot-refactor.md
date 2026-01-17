# Timeline Refactor: Position-Based → Timeslot-Based

## Overview

Replace the current position-based timeline (arbitrary numbers like 1000, 2000, 1250) with an explicit timeslot-based model where the timeline is an ordered array of timeslots, and items reference timeslots by ID.

## Current Model (Problems)

```typescript
// Positions are arbitrary numbers
card1.position = 1000
card2.position = 2000
mutation.position = 1250  // "between" cards

// Confusing comparisons
mutPos <= currentPosition  // What does "at" mean?
mutPos < nextPosition      // Off by one errors

// Two types of mutations with different semantics
mutationDisplay: 'between'  // Has position
mutationDisplay: 'below'    // Has attachedToObjectId, no position
```

## New Model (Timeslot-Based)

```typescript
// Timeline is an ordered array of timeslot IDs
timeslotOrder: ['ts-001', 'ts-002', 'ts-003', ...]

// Items reference timeslot by ID
placement.timeslotId = 'ts-002'
object.timeslotId = 'ts-001'  // For rendered objects

// Cursor/Anchor are indices into timeslotOrder
cursorIndex = 2  // Pointing at timeslotOrder[2]
anchorIndex = 1  // Remembers timeslotOrder[1]
```

### Key Concepts

1. **Timeslot** - A unit of "narrative time". Everything in a timeslot happens simultaneously.
2. **timeslotOrder** - The ordered array defining timeline sequence
3. **timeslotId** - Stable ID that doesn't change when reordering
4. **attachedToCardId** - Optional UI hint for grouping (show mutation under a specific card)

## Data Structure Changes

### 1. New Timeslot Type

```typescript
// Minimal - just an ID. Items reference it, not vice versa.
interface Timeslot {
  id: string;
  createdAt: string;
}
```

### 2. TimelinePlacement Changes

```typescript
interface TimelinePlacement {
  id: string;
  objectId: string;
  type: 'creation' | 'mutation';

  // NEW: Reference timeslot by ID
  timeslotId: string;

  // REMOVED: position?: number
  // REMOVED: mutationDisplay?: 'between' | 'below'

  // KEPT: For UI grouping (optional - where to visually attach mutation)
  attachedToCardId?: string;

  // ... rest unchanged
  mutation?: { label, changes, contentChange, sectionChanges };
  threadIds?: string[];
  subthreadIds?: string[];
}
```

### 3. AethelObject Changes

```typescript
interface AethelObject {
  // ... existing fields

  // NEW: Which timeslot this object appears in (if rendered)
  timeslotId?: string;

  // REMOVED: position?: number
  // REMOVED: timelineSlot?: number (was for stacking)

  // For stacking multiple cards in same timeslot, use array order or explicit stackOrder
  stackOrder?: number;  // Order within a timeslot (optional)
}
```

### 4. Timeline Store State

```typescript
class TimelineStore {
  // NEW: Ordered list of timeslot IDs
  timeslotOrder = $state<string[]>([]);

  // NEW: Timeslot entities (minimal - just for ID stability)
  timeslots = $state<Map<string, Timeslot>>(new Map());

  // KEPT: Cursor is index into timeslotOrder
  cursorIndex = $state<number>(0);

  // KEPT: Anchor is index into timeslotOrder
  anchorIndex = $state<number | null>(null);

  // KEPT: Placements
  allPlacements = $state<TimelinePlacement[]>([]);

  // REMOVED: Position-based derived computations
}
```

## Implementation Plan

### Phase 1: Types & Store Foundation

1. **Update `$lib/types/index.ts`**
   - Add `Timeslot` interface
   - Update `TimelinePlacement` (timeslotId replaces position)
   - Update `AethelObject` (timeslotId replaces position)
   - Remove MutationDisplay type

2. **Update `$lib/stores/timeline.svelte.ts`**
   - Add `timeslotOrder` and `timeslots` state
   - Add timeslot CRUD methods:
     - `createTimeslot(): string` - creates new timeslot, returns ID
     - `insertTimeslot(afterIndex: number): string` - insert after index
     - `removeTimeslot(id: string)` - remove if empty
     - `getTimeslotIndex(id: string): number` - get position in order
   - Update derived computations to use timeslots

### Phase 2: Update Derived State

Update these derived values to work with timeslots:

```typescript
// Cards grouped by timeslot
cardsByTimeslot = $derived.by(() => {
  const map = new Map<string, AethelObject[]>();
  for (const obj of this.renderedObjects) {
    if (obj.timeslotId) {
      const list = map.get(obj.timeslotId) ?? [];
      list.push(obj);
      map.set(obj.timeslotId, list);
    }
  }
  return map;
});

// Mutations grouped by timeslot
mutationsByTimeslot = $derived.by(() => {
  const map = new Map<string, TimelinePlacement[]>();
  for (const p of this.allPlacements) {
    if (p.type === 'mutation') {
      const list = map.get(p.timeslotId) ?? [];
      list.push(p);
      map.set(p.timeslotId, list);
    }
  }
  return map;
});

// Timeline items in order (for rendering)
orderedItems = $derived.by(() => {
  return this.timeslotOrder.map(tsId => ({
    timeslotId: tsId,
    cards: this.cardsByTimeslot.get(tsId) ?? [],
    mutations: this.mutationsByTimeslot.get(tsId) ?? [],
    milestones: this.milestonesByTimeslot.get(tsId) ?? [],
  }));
});
```

### Phase 3: Update Core Operations

1. **Cursor/Anchor operations** (now trivial):
   ```typescript
   // Get mutations at or before anchor
   getMutationsAtOrBefore(objectId: string, timeslotIndex: number) {
     const validTimeslots = new Set(
       this.timeslotOrder.slice(0, timeslotIndex + 1)
     );
     return this.allPlacements.filter(p =>
       p.objectId === objectId &&
       p.type === 'mutation' &&
       validTimeslots.has(p.timeslotId)
     );
   }
   ```

2. **Object state computation** (simplified):
   ```typescript
   getObjectStateAtTimeslot(objectId: string, timeslotIndex: number) {
     const mutations = this.getMutationsAtOrBefore(objectId, timeslotIndex);
     // Apply mutations in timeslot order...
   }
   ```

3. **Add card to timeline**:
   ```typescript
   addCardToTimeslot(objectId: string, timeslotId: string) {
     objects.update(objectId, {
       rendered: true,
       timeslotId
     });
   }
   ```

4. **Add mutation**:
   ```typescript
   addMutation(objectId: string, timeslotId: string, label: string, changes: ...) {
     const placement = createPlacement(objectId, 'mutation', {
       timeslotId,
       mutation: { label, changes },
     });
     this.addPlacement(placement);
   }
   ```

### Phase 4: Update UI Components

1. **SingleTrackTimeline.svelte**
   - Render `orderedItems` (timeslots in order)
   - Each timeslot shows its cards, mutations, milestones
   - Connectors between timeslots for adding new slots
   - Remove position-based flow item logic

2. **Dialogs**
   - AddMutationDialog: takes `timeslotId` instead of `position`
   - AddExistingObjectDialog: takes `timeslotId`
   - CreateNewObjectDialog: takes `timeslotId`

3. **Drag-drop**
   - Moving items changes their `timeslotId`
   - Reordering timeslots updates `timeslotOrder`

### Phase 5: Migration

Create migration for existing data:

```typescript
function migratePositionsToTimeslots(data: OldData): NewData {
  // 1. Collect all unique positions
  const positions = new Set<number>();
  // ... gather from objects and placements

  // 2. Sort positions and create timeslot for each
  const sortedPositions = [...positions].sort((a, b) => a - b);
  const positionToTimeslot = new Map<number, string>();

  for (const pos of sortedPositions) {
    const tsId = generateId('ts');
    positionToTimeslot.set(pos, tsId);
    timeslotOrder.push(tsId);
  }

  // 3. Update objects and placements to reference timeslots
  // ...
}
```

### Phase 6: Update Editor Service

Update `$lib/services/editor/index.ts`:
- `object.select` uses timeslot comparison (now trivial)
- `cursor.goToMutation` finds timeslot, sets cursor
- Remove position-based logic

## Files to Modify

1. `src/lib/types/index.ts` - Core type changes
2. `src/lib/stores/timeline.svelte.ts` - Store refactor
3. `src/lib/stores/objects.svelte.ts` - Object timeslotId handling
4. `src/lib/stores/milestones.svelte.ts` - Milestone timeslotId
5. `src/lib/components/timeline/SingleTrackTimeline.svelte` - UI refactor
6. `src/lib/components/timeline/dialogs/*.svelte` - Dialog updates
7. `src/lib/services/editor/index.ts` - Operation updates
8. `src/lib/editor/EditorContext.svelte.ts` - selectObject fix
9. `src/lib/services/timeline-operations.ts` - Operation updates
10. `src/lib/services/persistence.ts` - Save/load migration

## Testing Checkpoints

1. [ ] Types compile with no errors
2. [ ] Timeline renders empty state
3. [ ] Can add card to new timeslot
4. [ ] Can add mutation to timeslot
5. [ ] Cursor navigation works
6. [ ] Anchor-relative lookup works correctly
7. [ ] Drag-drop between timeslots works
8. [ ] Save/load preserves data
9. [ ] Migration from old format works

## Rollback Plan

Keep old position-based code commented until migration is complete and tested.
