/**
 * Browser storage provider for file export/import
 * Uses standard browser APIs (no Tauri)
 */

import type { AethelProject } from '$lib/types';
import { validateProject } from '../serialization';

/**
 * Browser-based storage provider for file export/import
 * Uses blob downloads and file input for cross-platform compatibility
 */
export class BrowserStorageProvider {
  /**
   * Export project as JSON download
   */
  static exportAsDownload(data: AethelProject, filename: string = 'project.aethel'): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Import project from file input
   */
  static importFromInput(): Promise<AethelProject | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.aethel,.json';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const content = await file.text();
          const data = JSON.parse(content);

          if (!validateProject(data)) {
            throw new Error('Invalid project file format');
          }

          resolve(data);
        } catch (error) {
          console.error('Failed to import file:', error);
          resolve(null);
        }
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }
}
