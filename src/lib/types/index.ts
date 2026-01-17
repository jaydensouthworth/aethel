/**
 * Core type definitions for Aethel
 */

import type { JSONContent } from '@tiptap/core';
export type { JSONContent } from '@tiptap/core';

// ============================================================================
// Object Types
// ============================================================================

export interface ObjectType {
  id: string;
  name: string;
  icon: string;
  color: string;
  isContentType: boolean; // Can have editable content?
}

// Built-in object types
export const OBJECT_TYPES: Record<string, ObjectType> = {
  chapter: {
    id: 'chapter',
    name: 'Chapter',
    icon: '📖',
    color: '#3b82f6', // blue
    isContentType: true,
  },
  scene: {
    id: 'scene',
    name: 'Scene',
    icon: '🎬',
    color: '#8b5cf6', // purple
    isContentType: true,
  },
  character: {
    id: 'character',
    name: 'Character',
    icon: '👤',
    color: '#06b6d4', // cyan
    isContentType: true,
  },
  location: {
    id: 'location',
    name: 'Location',
    icon: '📍',
    color: '#22c55e', // green
    isContentType: true,
  },
  item: {
    id: 'item',
    name: 'Item',
    icon: '⚔️',
    color: '#f59e0b', // amber
    isContentType: true,
  },
  event: {
    id: 'event',
    name: 'Event',
    icon: '⚡',
    color: '#ec4899', // pink
    isContentType: true,
  },
  note: {
    id: 'note',
    name: 'Note',
    icon: '📝',
    color: '#64748b', // slate
    isContentType: true,
  },
  folder: {
    id: 'folder',
    name: 'Folder',
    icon: '📁',
    color: '#78716c', // stone
    isContentType: false,
  },
};

// ============================================================================
// Object Sections (Multiple Text Contexts)
// ============================================================================

/**
 * ObjectSection - A named text section within an AethelObject
 * Each section has its own independent TipTap content.
 * When the parent object is used as a thread, each section becomes a subthread.
 */
export interface ObjectSection {
  id: string;
  name: string; // User-defined name (e.g., "Synopsis", "Content", "Notes")
  content: JSONContent | null;
  sortOrder: number; // For ordering sections within the object (lower = first)
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Attributes
// ============================================================================

export type AttributeValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number; unit?: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'date'; value: string } // ISO date string
  | { type: 'reference'; objectId: string }
  | { type: 'list'; values: AttributeValue[] };

export interface Attribute {
  key: string;
  value: AttributeValue;
  timelinePosition?: number; // When this became true
}

// ============================================================================
// Core Object
// ============================================================================

export interface AethelObject {
  id: string;
  name: string;
  typeId: string; // References ObjectType.id
  parentId: string | null; // For tree hierarchy

  // Visual customization
  color?: string; // Custom color (null/undefined = inherit from parent or type default)
  icon?: string; // Custom icon (null/undefined = inherit from parent or type default)

  // Ordering within parent (tree panel)
  sortOrder?: number; // For manual ordering in tree (lower = earlier)

  // Timeline - which timeslot this object appears in (if rendered)
  timeslotId?: string;

  // Book output
  rendered: boolean; // Include in book output?

  // Content
  content: JSONContent | null; // TipTap JSON document (legacy single content)

  // Multiple text sections (when present, replaces content semantically)
  // Each section can become a subthread when this object is used as a thread
  sections?: ObjectSection[];

  // Metadata
  aliases: string[];
  attributes: Attribute[];

  // Thread functionality (any object can be used as a narrative thread)
  isThread?: boolean; // Can be used as a narrative thread
  threadColor?: string; // Color when displayed as thread lane (defaults to object color)

  // Timestamps
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

// ============================================================================
// Timeline - Timeslot-Based Model
// ============================================================================

/**
 * Timeslot - A unit of narrative time on the timeline.
 * Everything in a timeslot happens "at the same time".
 * Items reference timeslots by ID, timeslots are ordered via timeslotOrder array.
 */
export interface Timeslot {
  id: string;
  createdAt: string;
}

/**
 * Milestone - Section groupings for timeline organization (acts, parts, sections)
 * Appears between timeslots as visual dividers
 */
export interface Milestone {
  id: string;
  name: string;
  color?: string;
  description?: string;
  // Which timeslot this milestone appears BEFORE
  // (null means at the very beginning, before all timeslots)
  timeslotId: string | null;
  // Export metadata
  exportAs?: 'part' | 'act' | 'section' | 'book';
  exportTitle?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * TimelinePlacement - Represents an object's appearance on the timeline.
 * An object can have multiple placements (creations, mutations).
 */
export interface TimelinePlacement {
  id: string;
  objectId: string; // Reference to AethelObject
  type: 'creation' | 'mutation'; // What kind of placement

  // === Timeslot-based model ===
  // Which timeslot this placement belongs to
  timeslotId: string;

  // Optional: For UI grouping - show this mutation under a specific card
  // (only affects visual display, not timeline logic)
  attachedToCardId?: string;

  // Thread associations (many-to-many)
  threadIds?: string[];

  // Subthread targeting (when thread has sections)
  // undefined/empty = full thread (all sections)
  // specified = only these section IDs (subthreads)
  subthreadIds?: string[];

  // For mutations only
  mutation?: {
    label: string; // e.g., "Frodo receives Ring"
    // Attribute changes (key-value properties)
    changes: Record<string, { from: unknown; to: unknown }>;
    // Content change (main content field - replaces the entire content at this point)
    contentChange?: {
      from: JSONContent | null;
      to: JSONContent | null;
    };
    // Section-specific content changes (for objects with multiple sections)
    // Key is sectionId, value is the content change for that section
    sectionChanges?: Record<string, { from: JSONContent | null; to: JSONContent | null }>;
  };

  // Editor state (persisted)
  locked?: boolean; // Prevent editing
  groupId?: string; // Group membership for batch operations

  createdAt: string;
  updatedAt: string;
}

/**
 * TimelineTrack - Configuration for a timeline track
 * @deprecated Use single-track model with Threads instead
 */
export interface TimelineTrack {
  id: number;
  name?: string;
  locked: boolean;
  height?: number; // Custom track height
  color?: string; // Track accent color
  muted?: boolean; // Mute track (dim visually)
  solo?: boolean; // Solo track (highlight this, dim others)
}

/**
 * TimelineMarker - Named position markers on timeline
 * @deprecated Use Milestone instead for section groupings
 */
export interface TimelineMarker {
  id: string;
  name?: string;
  label?: string; // Display label (fallback to name)
  position: number;
  description?: string;
  color?: string;
}

export interface Timeline {
  id: string;
  name: string;
  markers: TimelineMarker[];
}

// ============================================================================
// Project
// ============================================================================

export interface ProjectConfig {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  customTypes?: ObjectType[];
}

/**
 * Complete project save file format
 * Used for localStorage auto-save and file export/import
 */
export interface AethelProject {
  version: string; // "3.0.0" - timeslot-based model
  savedAt: string; // ISO timestamp

  // Core data
  objects: AethelObject[];

  // Timeline data (v3 - timeslot-based model)
  timeline: {
    current: Timeline;
    placements: TimelinePlacement[];
    // v3: Ordered list of timeslot IDs (the source of truth for order)
    timeslotOrder: string[];
    // v3: Timeslot entities (minimal - just for ID stability)
    timeslots: Timeslot[];
    // v3: Milestones for section groupings
    milestones?: Milestone[];
    // Cursor indexes into timeslotOrder
    cursorIndex: number;
    panelHeight: number;
  };

  // UI state (persisted for continuity)
  ui: {
    selectedObjectId: string | null;
    timelineCollapsed: boolean;
    treePanelWidth: number;
    treeExpandedIds: string[]; // Serialized from Set<string>
    propertiesPanelCollapsed: boolean;
    // v2: Track which threads are visible
    visibleThreadIds?: string[];
  };
}

// ============================================================================
// UI State Types
// ============================================================================

export interface UIState {
  selectedObjectId: string | null;
  timelineCollapsed: boolean;
  treePanelWidth: number;
  treeExpandedIds: Set<string>;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getObjectType(typeId: string, customTypes?: ObjectType[]): ObjectType {
  if (customTypes) {
    const custom = customTypes.find((t) => t.id === typeId);
    if (custom) return custom;
  }
  return OBJECT_TYPES[typeId] ?? OBJECT_TYPES.note;
}

export function createObjectId(): string {
  return crypto.randomUUID();
}

export function createObject(
  name: string,
  typeId: string,
  parentId: string | null = null
): AethelObject {
  const now = new Date().toISOString();
  return {
    id: createObjectId(),
    name,
    typeId,
    parentId,
    rendered: false,
    content: null,
    aliases: [],
    attributes: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new object section
 */
export function createSection(name: string, sortOrder: number = 0): ObjectSection {
  const now = new Date().toISOString();
  return {
    id: createObjectId(),
    name,
    content: null,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new timeslot
 */
export function createTimeslot(): Timeslot {
  const now = new Date().toISOString();
  return {
    id: createObjectId(),
    createdAt: now,
  };
}

/**
 * Create a new timeline placement (timeslot-based model)
 */
export function createPlacement(
  objectId: string,
  type: 'creation' | 'mutation',
  timeslotId: string,
  options?: {
    // For UI grouping - show mutation under a specific card
    attachedToCardId?: string;
    // Thread associations
    threadIds?: string[];
    // Subthread targeting (section IDs when thread has sections)
    subthreadIds?: string[];
    // Mutation data
    mutation?: {
      label: string;
      changes: Record<string, { from: unknown; to: unknown }>;
      // Content change (replaces main content at this point)
      contentChange?: { from: JSONContent | null; to: JSONContent | null };
      // Section-specific content changes
      sectionChanges?: Record<string, { from: JSONContent | null; to: JSONContent | null }>;
    };
  }
): TimelinePlacement {
  const now = new Date().toISOString();
  return {
    id: createObjectId(),
    objectId,
    type,
    timeslotId,
    attachedToCardId: options?.attachedToCardId,
    threadIds: options?.threadIds,
    subthreadIds: options?.subthreadIds,
    mutation: options?.mutation,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new milestone
 */
export function createMilestone(
  name: string,
  beforeTimeslotId: string | null,
  options?: {
    color?: string;
    description?: string;
    exportAs?: 'part' | 'act' | 'section' | 'book';
    exportTitle?: string;
  }
): Milestone {
  const now = new Date().toISOString();
  return {
    id: createObjectId(),
    name,
    timeslotId: beforeTimeslotId,
    color: options?.color,
    description: options?.description,
    exportAs: options?.exportAs,
    exportTitle: options?.exportTitle,
    createdAt: now,
    updatedAt: now,
  };
}
