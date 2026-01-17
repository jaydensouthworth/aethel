/**
 * Project store - manages project-level operations and dirty state
 * Uses Svelte 5 Runes for reactivity
 */

import { serializeProject, deserializeProject } from '$lib/services/serialization';
import { LocalStorageProvider, AUTO_SAVE_KEY, BrowserStorageProvider } from '$lib/services/storage';
import { debounce } from '$lib/utils/debounce';

// ============================================================================
// Constants
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 2000;

class ProjectStore {
  // ============================================================================
  // Core State
  // ============================================================================

  currentProjectId = $state<string | null>(null);
  isDirty = $state<boolean>(false);
  lastSavedAt = $state<string | null>(null);
  autoSaveEnabled = $state<boolean>(true);
  isSaving = $state<boolean>(false);
  isLoading = $state<boolean>(false);

  // ============================================================================
  // Storage Providers
  // ============================================================================

  private localStorage = new LocalStorageProvider();
  private debouncedAutoSave: ReturnType<typeof debounce> | null = null;

  // ============================================================================
  // Settings
  // ============================================================================

  setAutoSaveEnabled(enabled: boolean): void {
    this.autoSaveEnabled = enabled;
  }

  // ============================================================================
  // Auto-save
  // ============================================================================

  private getAutoSave() {
    if (!this.debouncedAutoSave) {
      this.debouncedAutoSave = debounce(async () => {
        if (!this.autoSaveEnabled || !this.isDirty) return;

        try {
          this.isSaving = true;
          const proj = await serializeProject();
          await this.localStorage.save(AUTO_SAVE_KEY, proj);
          this.lastSavedAt = proj.savedAt;
          this.isDirty = false;
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          this.isSaving = false;
        }
      }, AUTO_SAVE_DEBOUNCE_MS);
    }
    return this.debouncedAutoSave;
  }

  /**
   * Mark the project as dirty (has unsaved changes)
   * Triggers auto-save if enabled
   */
  markDirty(): void {
    this.isDirty = true;
    if (this.autoSaveEnabled) {
      this.getAutoSave()();
    }
  }

  // ============================================================================
  // Project Operations
  // ============================================================================

  /**
   * Start a new project (clears all data)
   */
  async newProject(): Promise<void> {
    // Import stores here to avoid circular dependencies
    const { objects } = await import('./objects.svelte');
    const { timeline } = await import('./timeline.svelte');
    const { ui } = await import('./ui.svelte');
    const { milestones } = await import('./milestones.svelte');
    const { timelineEditor } = await import('./timeline-editor.svelte');

    objects.clear();
    timeline.clear();
    ui.clear();
    milestones.clear();
    timelineEditor.clear();

    this.currentProjectId = null;
    this.isDirty = false;
    this.lastSavedAt = null;
  }

  /**
   * Save project to localStorage
   */
  async saveProject(): Promise<void> {
    try {
      this.isSaving = true;
      const proj = await serializeProject();
      const key = this.currentProjectId ?? AUTO_SAVE_KEY;
      await this.localStorage.save(key, proj);
      this.lastSavedAt = proj.savedAt;
      this.isDirty = false;
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Load project from localStorage
   */
  async loadProject(key: string = AUTO_SAVE_KEY): Promise<boolean> {
    try {
      this.isLoading = true;
      const proj = await this.localStorage.load(key);

      if (proj) {
        await deserializeProject(proj);
        this.currentProjectId = key === AUTO_SAVE_KEY ? null : key;
        this.lastSavedAt = proj.savedAt;
        this.isDirty = false;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Load failed:', error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Export project to a file (browser download)
   */
  async exportProject(): Promise<boolean> {
    try {
      this.isSaving = true;
      const proj = await serializeProject();
      BrowserStorageProvider.exportAsDownload(proj);
      return true;
    } catch (error) {
      console.error('Export failed:', error);
      return false;
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Import project from a file (browser file picker)
   */
  async importProject(): Promise<boolean> {
    try {
      this.isLoading = true;
      const proj = await BrowserStorageProvider.importFromInput();

      if (proj) {
        await deserializeProject(proj);
        this.currentProjectId = null;
        this.lastSavedAt = proj.savedAt;
        this.isDirty = false;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Try to restore from auto-save on startup
   */
  async tryRestoreAutoSave(): Promise<boolean> {
    return await this.loadProject(AUTO_SAVE_KEY);
  }

  /**
   * List all saved projects
   */
  async listProjects(): Promise<string[]> {
    return await this.localStorage.list();
  }

  /**
   * Delete a saved project
   */
  async deleteProject(key: string): Promise<void> {
    await this.localStorage.delete(key);
  }
}

export const project = new ProjectStore();
