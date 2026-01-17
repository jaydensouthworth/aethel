/**
 * Editor Context
 *
 * Provides centralized access to stores and event communication
 * for all editor components. Uses Svelte's context API to avoid prop drilling.
 */

import { setContext, getContext } from 'svelte';
import type { Editor } from '@tiptap/core';
import type { AethelObject } from '$lib/types';
import { objects } from '$lib/stores/objects.svelte';
import { timeline } from '$lib/stores/timeline.svelte';
import { ui } from '$lib/stores/ui.svelte';
import { getObjectType } from '$lib/types';

// ============================================================================
// Types
// ============================================================================

export type EditorEvent =
  | 'ref:click'
  | 'ref:rightclick'
  | 'ref:navigate'
  | 'ref:remove'
  | 'mutation:create'
  | 'mutation:open'
  | 'selection:change'
  | 'content:change'
  | 'focus:toggle';

export interface EditorEventData {
  'ref:click': { objectId: string; pos: number };
  'ref:rightclick': { objectId: string; displayText: string; pos: number; clientX: number; clientY: number };
  'ref:navigate': { objectId: string };
  'ref:remove': { pos: number };
  'mutation:create': { objectId: string; label: string; changes: Record<string, { from: unknown; to: unknown }> };
  'mutation:open': { objectId: string };
  'selection:change': { from: number; to: number; empty: boolean };
  'content:change': { };
  'focus:toggle': { enabled: boolean };
}

type EventHandler<E extends EditorEvent> = (data: EditorEventData[E]) => void;

export interface EditorContextValue {
  // TipTap editor instance (set after mount)
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;

  // Object accessors (read-only)
  getObject: (id: string) => AethelObject | undefined;
  getObjectByName: (name: string) => AethelObject | undefined;
  getEffectiveColor: (id: string) => string;
  resolveObject: (text: string) => { id: string; name: string; color: string } | null;
  getMatchingObjects: (word: string) => Array<{ id: string; name: string; color: string }>;

  // Timeline integration
  getCursorPosition: () => number;
  addMutation: (
    objectId: string,
    label: string,
    changes: Record<string, { from: unknown; to: unknown }>
  ) => void;
  getObjectMutations: (objectId: string) => {
    past: import('$lib/types').TimelinePlacement[];
    future: import('$lib/types').TimelinePlacement[];
  };

  // Navigation
  selectObject: (id: string) => void;

  // Event system
  on: <E extends EditorEvent>(event: E, handler: EventHandler<E>) => () => void;
  emit: <E extends EditorEvent>(event: E, data: EditorEventData[E]) => void;
}

// ============================================================================
// Context Key
// ============================================================================

const EDITOR_CONTEXT_KEY = Symbol('aethel-editor');

// ============================================================================
// Create Context
// ============================================================================

export function createEditorContext(): EditorContextValue {
  // Event listeners storage
  const listeners = new Map<EditorEvent, Set<EventHandler<any>>>();

  // Mutable editor reference
  let editorInstance: Editor | null = null;

  const ctx: EditorContextValue = {
    // Editor instance
    get editor() {
      return editorInstance;
    },
    setEditor(editor: Editor | null) {
      editorInstance = editor;
    },

    // Object accessors
    getObject(id: string) {
      return objects.get(id);
    },

    getObjectByName(name: string) {
      return objects.getByName(name);
    },

    getEffectiveColor(id: string) {
      return objects.getEffectiveColor(id);
    },

    resolveObject(text: string) {
      const searchTerm = text.toLowerCase().trim();
      for (const obj of objects.all) {
        // Match by name
        if (obj.name.toLowerCase() === searchTerm) {
          const objType = getObjectType(obj.typeId);
          return {
            id: obj.id,
            name: obj.name,
            color: obj.color ?? objType.color,
          };
        }
        // Match by alias
        if (obj.aliases?.some((alias) => alias.toLowerCase() === searchTerm)) {
          const objType = getObjectType(obj.typeId);
          return {
            id: obj.id,
            name: obj.name,
            color: obj.color ?? objType.color,
          };
        }
      }
      return null;
    },

    getMatchingObjects(word: string) {
      const matches = objects.getAllMatches(word);
      return matches.map((obj) => {
        const objType = getObjectType(obj.typeId);
        return {
          id: obj.id,
          name: obj.name,
          color: obj.color ?? objType.color,
        };
      });
    },

    // Timeline integration
    getCursorPosition() {
      // v2: Return cursor index (card-based)
      return timeline.cursorIndex;
    },

    addMutation(objectId, label, changes) {
      // v2: Add mutation below the current card
      const currentCard = timeline.currentCard;
      if (currentCard) {
        timeline.addMutationBelow(objectId, currentCard.id, label, changes);
      }
    },

    getObjectMutations(objectId: string) {
      return timeline.getObjectMutations(objectId);
    },

    // Navigation
    selectObject(id: string) {
      ui.select(id);
    },

    // Event system
    on<E extends EditorEvent>(event: E, handler: EventHandler<E>) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);

      // Return unsubscribe function
      return () => {
        listeners.get(event)?.delete(handler);
      };
    },

    emit<E extends EditorEvent>(event: E, data: EditorEventData[E]) {
      const handlers = listeners.get(event);
      if (handlers) {
        for (const handler of handlers) {
          handler(data);
        }
      }
    },
  };

  return ctx;
}

// ============================================================================
// Context Accessors
// ============================================================================

export function setEditorContext(ctx: EditorContextValue): void {
  setContext(EDITOR_CONTEXT_KEY, ctx);
}

export function getEditorContext(): EditorContextValue {
  const ctx = getContext<EditorContextValue>(EDITOR_CONTEXT_KEY);
  if (!ctx) {
    throw new Error('EditorContext not found. Make sure Editor component is mounted.');
  }
  return ctx;
}

export function tryGetEditorContext(): EditorContextValue | undefined {
  return getContext<EditorContextValue>(EDITOR_CONTEXT_KEY);
}
