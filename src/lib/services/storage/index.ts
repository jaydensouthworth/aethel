/**
 * Storage abstraction layer
 * Provides a unified interface for different storage backends
 */

import type { AethelProject } from '$lib/types';

/**
 * Storage provider interface
 * All storage implementations must conform to this interface
 */
export interface StorageProvider {
  /** Save a project to storage */
  save(key: string, data: AethelProject): Promise<void>;

  /** Load a project from storage */
  load(key: string): Promise<AethelProject | null>;

  /** Delete a project from storage */
  delete(key: string): Promise<void>;

  /** List all saved project keys */
  list(): Promise<string[]>;
}

export { LocalStorageProvider, AUTO_SAVE_KEY } from './localStorage';
export { BrowserStorageProvider } from './browser';
