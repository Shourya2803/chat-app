import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ToneType = 'professional' | 'polite' | 'formal' | null;

interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  toneEnabled: boolean;
  selectedTone: ToneType;
  showTonePreview: boolean;
  previewContent: { original: string; converted: string } | null;

  // Actions
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTone: () => void;
  setToneEnabled: (enabled: boolean) => void;
  setSelectedTone: (tone: ToneType) => void;
  setShowTonePreview: (show: boolean) => void;
  setPreviewContent: (content: { original: string; converted: string } | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarOpen: true,
      toneEnabled: false,
      selectedTone: null,
      showTonePreview: false,
      previewContent: null,

      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light';
          if (typeof window !== 'undefined') {
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            localStorage.setItem('theme', newTheme);
          }
          return { theme: newTheme };
        }),

      setTheme: (theme) => {
        if (typeof window !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
          localStorage.setItem('theme', theme);
        }
        set({ theme });
      },

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      toggleTone: () => set((state) => ({ toneEnabled: !state.toneEnabled })),

      setToneEnabled: (enabled) => set({ toneEnabled: enabled }),

      setSelectedTone: (tone) => set({ selectedTone: tone }),

      setShowTonePreview: (show) => set({ showTonePreview: show }),

      setPreviewContent: (content) => set({ previewContent: content }),
    }),
    {
      name: 'ui-storage',
      skipHydration: true,
      partialize: (state) => ({ 
        theme: state.theme,
        toneEnabled: state.toneEnabled,
        selectedTone: state.selectedTone,
      }),
    }
  )
);
