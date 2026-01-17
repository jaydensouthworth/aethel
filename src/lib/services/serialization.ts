/**
 * Serialization utilities for project save/load (v2 - single-track model)
 *
 * Note: Uses dynamic imports to avoid circular dependency with stores
 */

import type { AethelProject } from '$lib/types';

const PROJECT_VERSION = '2.0.0';

/**
 * Serialize the current application state to an AethelProject object
 */
export async function serializeProject(): Promise<AethelProject> {
  // Dynamic imports to avoid circular dependency
  const { objects } = await import('$lib/stores/objects.svelte');
  const { timeline } = await import('$lib/stores/timeline.svelte');
  const { milestones } = await import('$lib/stores/milestones.svelte');
  const { ui } = await import('$lib/stores/ui.svelte');
  const { timelineEditor } = await import('$lib/stores/timeline-editor.svelte');

  return {
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),

    // Core data (includes thread objects with isThread=true)
    objects: objects.all,

    // Timeline data (v2 format)
    timeline: {
      current: timeline.current,
      placements: timeline.allPlacements,
      // v2: milestones (threads are now stored as objects with isThread=true)
      milestones: milestones.all,
      // v2: cursor index (not position)
      cursorIndex: timeline.cursorIndex,
      panelHeight: timeline.panelHeight,
    },

    // UI state - convert Set to Array for JSON serialization
    ui: {
      selectedObjectId: ui.selectedObjectId,
      timelineCollapsed: ui.timelineCollapsed,
      treePanelWidth: ui.treePanelWidth,
      treeExpandedIds: Array.from(ui.treeExpandedIds),
      propertiesPanelCollapsed: ui.propertiesPanelCollapsed,
      // v2: visible threads
      visibleThreadIds: Array.from(timelineEditor.visibleThreadIds),
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
  const { milestones } = await import('$lib/stores/milestones.svelte');
  const { ui } = await import('$lib/stores/ui.svelte');
  const { timelineEditor } = await import('$lib/stores/timeline-editor.svelte');

  // Clear existing state
  objects.clear();
  timeline.clear();
  milestones.clear();
  ui.clear();
  timelineEditor.clear();

  // Restore objects (includes thread objects with isThread=true)
  objects.load(project.objects);

  // Restore milestones
  if (project.timeline.milestones) {
    milestones.load(project.timeline.milestones);
  }

  // Restore timeline (v2 format)
  timeline.loadV2(
    project.timeline.current,
    project.timeline.placements,
    project.timeline.cursorIndex ?? 0,
    project.timeline.panelHeight
  );

  // Restore UI - convert Array back to Set
  ui.restore({
    selectedObjectId: project.ui.selectedObjectId,
    timelineCollapsed: project.ui.timelineCollapsed,
    treePanelWidth: project.ui.treePanelWidth,
    treeExpandedIds: new Set(project.ui.treeExpandedIds),
    propertiesPanelCollapsed: project.ui.propertiesPanelCollapsed,
  });

  // Restore thread visibility
  if (project.ui.visibleThreadIds) {
    timelineEditor.showAllThreads(project.ui.visibleThreadIds);
  }
}

/**
 * Validate an AethelProject object structure (v2)
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
  if (typeof timeline.panelHeight !== 'number') return false;
  // v2: cursorIndex (cursorPosition is legacy)
  if (typeof timeline.cursorIndex !== 'number' && typeof timeline.cursorPosition !== 'number') return false;

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
