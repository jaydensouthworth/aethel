/**
 * Font configuration for the Aethel editor
 */

export interface FontOption {
  name: string;
  value: string;
  category: 'serif' | 'sans' | 'mono';
}

export const DEFAULT_FONTS: FontOption[] = [
  // Serif - elegant, book-like
  { name: 'Georgia', value: 'Georgia, serif', category: 'serif' },
  { name: 'Garamond', value: '"EB Garamond", Garamond, serif', category: 'serif' },
  { name: 'Palatino', value: '"Palatino Linotype", Palatino, serif', category: 'serif' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif', category: 'serif' },
  { name: 'Libre Baskerville', value: '"Libre Baskerville", serif', category: 'serif' },

  // Sans-serif - clean, modern
  { name: 'Inter', value: 'Inter, sans-serif', category: 'sans' },
  { name: 'Helvetica', value: 'Helvetica, Arial, sans-serif', category: 'sans' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif', category: 'sans' },

  // Monospace - typewriter feel
  { name: 'Courier', value: '"Courier New", Courier, monospace', category: 'mono' },
];

export const DEFAULT_FONT = 'Georgia, serif';

export const FONT_SIZES = [
  { name: 'Small', value: '14px' },
  { name: 'Normal', value: '16px' },
  { name: 'Medium', value: '18px' },
  { name: 'Large', value: '20px' },
  { name: 'Extra Large', value: '24px' },
];

export const DEFAULT_FONT_SIZE = '16px';

export const TEXT_COLORS = [
  { name: 'Default', value: null },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Gray', value: '#6b7280' },
];

export const HIGHLIGHT_COLORS = [
  { name: 'None', value: null },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Purple', value: '#e9d5ff' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
];
