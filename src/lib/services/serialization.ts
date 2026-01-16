/**
 * Serialization utilities for project save/load
 *
 * Note: Uses dynamic imports to avoid circular dependency with stores
 */

import type { AethelProject } from '$lib/types';

const PROJECT_VERSION = '1.0.0';

/**
 * Serialize the current application state to an AethelProject object
 */
export async function serializeProject(): Promise<AethelProject> {
  // Dynamic imports to avoid circular dependency
  const { objects } = await import('$lib/stores/objects.svelte');
  const { timeline } = await import('$lib/stores/timeline.svelte');
  const { ui } = await import('$lib/stores/ui.svelte');

  return {
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),

    // Core data
    objects: objects.all,

    // Timeline data
    timeline: {
      current: timeline.current,
      placements: timeline.allPlacements,
      tracks: timeline.allTracks,
      cursorPosition: timeline.cursorPosition,
      panelHeight: timeline.panelHeight,
    },

    // UI state - convert Set to Array for JSON serialization
    ui: {
      selectedObjectId: ui.selectedObjectId,
      timelineCollapsed: ui.timelineCollapsed,
      treePanelWidth: ui.treePanelWidth,
      treeExpandedIds: Array.from(ui.treeExpandedIds),
      propertiesPanelCollapsed: ui.propertiesPanelCollapsed,
    },
  };
}

/**
 * Deserialize an AethelProject and restore application state
 */
export async function deserializeProject(project: AethelProject): Promise<void> {
  // Dynamic imports to avoid circular dependency
  const { objects } = await import('$lib/stores/objects.svelte');
  const { timeline } = await import('$lib/stores/timeline.svelte');
  const { ui } = await import('$lib/stores/ui.svelte');

  // Clear existing state
  objects.clear();
  timeline.clear();
  ui.clear();

  // Restore objects
  objects.load(project.objects);

  // Restore timeline
  timeline.load(
    project.timeline.current,
    project.timeline.placements,
    project.timeline.cursorPosition,
    project.timeline.panelHeight,
    project.timeline.tracks
  );

  // Restore UI - convert Array back to Set
  ui.restore({
    selectedObjectId: project.ui.selectedObjectId,
    timelineCollapsed: project.ui.timelineCollapsed,
    treePanelWidth: project.ui.treePanelWidth,
    treeExpandedIds: new Set(project.ui.treeExpandedIds),
    propertiesPanelCollapsed: project.ui.propertiesPanelCollapsed,
  });
}

/**
 * Validate an AethelProject object structure
 */
export function validateProject(data: unknown): data is AethelProject {
  if (!data || typeof data !== 'object') return false;

  const project = data as Record<string, unknown>;

  // Check required top-level fields
  if (typeof project.version !== 'string') return false;
  if (typeof project.savedAt !== 'string') return false;
  if (!Array.isArray(project.objects)) return false;
  if (!project.timeline || typeof project.timeline !== 'object') return false;
  if (!project.ui || typeof project.ui !== 'object') return false;

  // Check timeline structure
  const timeline = project.timeline as Record<string, unknown>;
  if (!timeline.current || typeof timeline.current !== 'object') return false;
  if (!Array.isArray(timeline.placements)) return false;
  if (typeof timeline.cursorPosition !== 'number') return false;
  if (typeof timeline.panelHeight !== 'number') return false;

  // Check ui structure
  const ui = project.ui as Record<string, unknown>;
  if (ui.selectedObjectId !== null && typeof ui.selectedObjectId !== 'string') return false;
  if (typeof ui.timelineCollapsed !== 'boolean') return false;
  if (typeof ui.treePanelWidth !== 'number') return false;
  if (!Array.isArray(ui.treeExpandedIds)) return false;
  if (typeof ui.propertiesPanelCollapsed !== 'boolean') return false;

  return true;
}

/**
 * Get the current project version
 */
export function getProjectVersion(): string {
  return PROJECT_VERSION;
}
