/**
 * Core type definitions for Aethel
 */

import type { JSONContent } from '@tiptap/core';

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

  // Ordering within parent
  sortOrder?: number; // For manual ordering (lower = earlier)

  // Book output
  rendered: boolean; // Include in book output?

  // Timeline positioning
  timelineSlot?: number; // Cards with same slot number are stacked (simultaneous events)

  // Content
  content: JSONContent | null; // TipTap JSON document

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
// Timeline
// ============================================================================

/**
 * Milestone - Section groupings for timeline organization (acts, parts, sections)
 * Appears between cards as visual dividers
 */
export interface Milestone {
  id: string;
  name: string;
  color?: string;
  description?: string;
  // Position: after which rendered object index this milestone appears
  afterIndex: number;
  // Export metadata
  exportAs?: 'part' | 'act' | 'section' | 'book';
  exportTitle?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * MutationDisplay - How a mutation is displayed on the timeline
 * - 'between': appears as a marker in the flow between cards
 * - 'below': attached underneath a specific chapter card
 */
export type MutationDisplay = 'between' | 'below';

/**
 * TimelinePlacement - Represents an object's appearance on the timeline.
 * An object can have multiple placements (creations, mutations, ranges).
 */
export interface TimelinePlacement {
  id: string;
  objectId: string; // Reference to AethelObject
  type: 'creation' | 'mutation'; // What kind of placement

  // === Single-track positioning (v2) ===
  // For mutations with 'below' display: attach to this card
  attachedToObjectId?: string;
  // For mutations with 'between' display: position after this rendered index
  afterRenderedIndex?: number;
  // How this mutation is displayed (only for type: 'mutation')
  mutationDisplay?: MutationDisplay;
  // Thread associations (many-to-many)
  threadIds?: string[];

  // === Legacy track-based positioning (v1 - kept for migration) ===
  /** @deprecated Use single-track model instead */
  track?: number; // Track index (0, 1, 2...)
  /** @deprecated Use afterRenderedIndex instead */
  position?: number; // Start position on timeline
  /** @deprecated No longer used in single-track model */
  endPosition?: number; // Optional end (for ranges)

  // For mutations only
  mutation?: {
    label: string; // e.g., "Frodo receives Ring"
    changes: Record<string, { from: unknown; to: unknown }>;
  };

  // Editor state (persisted)
  locked?: boolean; // Prevent editing
  groupId?: string; // Group membership for batch operations
  /** @deprecated No longer used in single-track model */
  slipOffset?: number; // For slip tool - offset into content

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
  version: string; // "2.0.0" - for migration support
  savedAt: string; // ISO timestamp

  // Core data
  objects: AethelObject[];

  // Timeline data (v2 - single-track model)
  timeline: {
    current: Timeline;
    placements: TimelinePlacement[];
    // v2: Milestones for section groupings
    milestones?: Milestone[];
    // v2: Cursor indexes into rendered objects (not absolute position)
    cursorIndex: number;
    panelHeight: number;

    // Legacy v1 fields (kept for migration)
    /** @deprecated Use cursorIndex instead */
    cursorPosition?: number;
    /** @deprecated Tracks removed in v2 single-track model */
    tracks?: TimelineTrack[];
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
 * Create a new timeline placement (v2 - single-track model)
 */
export function createPlacement(
  objectId: string,
  type: 'creation' | 'mutation',
  options?: {
    // For mutations: display mode
    mutationDisplay?: MutationDisplay;
    attachedToObjectId?: string; // For 'below' display
    afterRenderedIndex?: number; // For 'between' display
    // Thread associations
    threadIds?: string[];
    // Mutation data
    mutation?: { label: string; changes: Record<string, { from: unknown; to: unknown }> };
    // Legacy support
    position?: number;
    track?: number;
  }
): TimelinePlacement {
  const now = new Date().toISOString();
  return {
    id: createObjectId(),
    objectId,
    type,
    // v2 fields
    mutationDisplay: options?.mutationDisplay,
    attachedToObjectId: options?.attachedToObjectId,
    afterRenderedIndex: options?.afterRenderedIndex,
    threadIds: options?.threadIds,
    mutation: options?.mutation,
    // Legacy fields (for migration compatibility)
    track: options?.track,
    position: options?.position,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new milestone
 */
export function createMilestone(
  name: string,
  afterIndex: number,
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
    afterIndex,
    color: options?.color,
    description: options?.description,
    exportAs: options?.exportAs,
    exportTitle: options?.exportTitle,
    createdAt: now,
    updatedAt: now,
  };
}
