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

  // Content
  content: JSONContent | null; // TipTap JSON document

  // Metadata
  aliases: string[];
  attributes: Attribute[];

  // Timestamps
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

// ============================================================================
// Timeline
// ============================================================================

/**
 * TimelinePlacement - Represents an object's appearance on the timeline.
 * An object can have multiple placements (creations, mutations, ranges).
 */
export interface TimelinePlacement {
  id: string;
  objectId: string; // Reference to AethelObject
  type: 'creation' | 'mutation'; // What kind of placement
  track: number; // Track index (0, 1, 2...) - fully flexible
  position: number; // Start position on timeline
  endPosition?: number; // Optional end (for ranges)

  // For mutations only
  mutation?: {
    label: string; // e.g., "Frodo receives Ring"
    changes: Record<string, { from: unknown; to: unknown }>;
  };

  // Editor state (persisted)
  locked?: boolean; // Prevent editing
  groupId?: string; // Group membership for batch operations
  slipOffset?: number; // For slip tool - offset into content

  createdAt: string;
  updatedAt: string;
}

/**
 * TimelineTrack - Configuration for a timeline track
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
  version: string; // "1.0.0" - for migration support
  savedAt: string; // ISO timestamp

  // Core data
  objects: AethelObject[];

  // Timeline data
  timeline: {
    current: Timeline;
    placements: TimelinePlacement[];
    tracks?: TimelineTrack[]; // Track configuration
    cursorPosition: number;
    panelHeight: number;
  };

  // UI state (persisted for continuity)
  ui: {
    selectedObjectId: string | null;
    timelineCollapsed: boolean;
    treePanelWidth: number;
    treeExpandedIds: string[]; // Serialized from Set<string>
    propertiesPanelCollapsed: boolean;
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
 * Create a new timeline placement
 */
export function createPlacement(
  objectId: string,
  type: 'creation' | 'mutation',
  position: number,
  track: number = 0,
  options?: {
    endPosition?: number;
    mutation?: { label: string; changes: Record<string, { from: unknown; to: unknown }> };
  }
): TimelinePlacement {
  const now = new Date().toISOString();
  return {
    id: createObjectId(),
    objectId,
    type,
    track,
    position,
    endPosition: options?.endPosition,
    mutation: options?.mutation,
    createdAt: now,
    updatedAt: now,
  };
}
