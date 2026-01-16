/**
 * LocalStorage provider for browser-based persistence
 */

import type { AethelProject } from '$lib/types';
import type { StorageProvider } from './index';
import { validateProject } from '../serialization';

const STORAGE_KEY_PREFIX = 'aethel_project_';
export const AUTO_SAVE_KEY = 'autosave';

/**
 * LocalStorage-based storage provider
 * Used for auto-save and quick saves within the browser
 */
export class LocalStorageProvider implements StorageProvider {
  /**
   * Save a project to localStorage
   */
  async save(key: string, data: AethelProject): Promise<void> {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY_PREFIX + key, json);
    } catch (error) {
      // Handle quota exceeded or other errors
      console.error('Failed to save to localStorage:', error);
      throw new Error('Failed to save project to browser storage');
    }
  }

  /**
   * Load a project from localStorage
   */
  async load(key: string): Promise<AethelProject | null> {
    try {
      const json = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      if (!json) return null;

      const data = JSON.parse(json);

      // Validate the loaded data
      if (!validateProject(data)) {
        console.warn('Invalid project data in localStorage, ignoring');
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Delete a project from localStorage
   */
  async delete(key: string): Promise<void> {
    localStorage.removeItem(STORAGE_KEY_PREFIX + key);
  }

  /**
   * List all saved project keys
   */
  async list(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        keys.push(key.slice(STORAGE_KEY_PREFIX.length));
      }
    }
    return keys;
  }

  /**
   * Check if localStorage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}
