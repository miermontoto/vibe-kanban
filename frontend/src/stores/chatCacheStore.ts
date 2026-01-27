import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import type { PatchTypeWithKey } from '@/hooks/useConversationHistory';
import { get, set, del, createStore as createIdbStore } from 'idb-keyval';

// ttl de cache: 30 minutos (persistent storage puede durar más que in-memory)
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedConversation {
  entries: PatchTypeWithKey[];
  loadedInitial: boolean;
  timestamp: number;
  // indicador de si la conversación está completa (proceso no running)
  isComplete: boolean;
}

interface ChatCacheState {
  // map de attemptId -> cached conversation
  conversations: Record<string, CachedConversation>;

  // acciones
  getCachedEntries: (attemptId: string) => PatchTypeWithKey[] | null;
  setCachedEntries: (
    attemptId: string,
    entries: PatchTypeWithKey[],
    loadedInitial: boolean,
    isComplete?: boolean
  ) => void;
  hasCachedEntries: (attemptId: string) => boolean;
  getCachedLoadedInitial: (attemptId: string) => boolean;
  isConversationComplete: (attemptId: string) => boolean;
  invalidateCache: (attemptId?: string) => void;
  cleanStaleEntries: () => void;
}

// crear store de IndexedDB separado para chat cache
const chatCacheIdbStore = createIdbStore('vkm-chat-cache', 'conversations');

// custom storage usando idb-keyval
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get(name, chatCacheIdbStore);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value, chatCacheIdbStore);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name, chatCacheIdbStore);
  },
};

// helper para verificar si un entry está stale
const isCacheStale = (timestamp: number): boolean => {
  return Date.now() - timestamp > CACHE_TTL_MS;
};

export const useChatCacheStore = create<ChatCacheState>()(
  persist(
    (set, get) => ({
      conversations: {},

      getCachedEntries: (attemptId: string) => {
        const cached = get().conversations[attemptId];
        if (!cached) return null;

        // invalidar si está stale
        if (isCacheStale(cached.timestamp)) {
          set((state) => {
            const rest = Object.fromEntries(
              Object.entries(state.conversations).filter(
                ([k]) => k !== attemptId
              )
            );
            return { conversations: rest };
          });
          return null;
        }

        return cached.entries;
      },

      setCachedEntries: (
        attemptId: string,
        entries: PatchTypeWithKey[],
        loadedInitial: boolean,
        isComplete = false
      ) => {
        set((state) => ({
          conversations: {
            ...state.conversations,
            [attemptId]: {
              entries: [...entries],
              loadedInitial,
              timestamp: Date.now(),
              isComplete,
            },
          },
        }));
      },

      hasCachedEntries: (attemptId: string) => {
        const cached = get().conversations[attemptId];
        if (!cached) return false;
        return !isCacheStale(cached.timestamp);
      },

      getCachedLoadedInitial: (attemptId: string) => {
        const cached = get().conversations[attemptId];
        return cached?.loadedInitial ?? false;
      },

      isConversationComplete: (attemptId: string) => {
        const cached = get().conversations[attemptId];
        return cached?.isComplete ?? false;
      },

      invalidateCache: (attemptId?: string) => {
        if (attemptId) {
          set((state) => {
            const rest = Object.fromEntries(
              Object.entries(state.conversations).filter(
                ([k]) => k !== attemptId
              )
            );
            return { conversations: rest };
          });
        } else {
          set({ conversations: {} });
        }
      },

      cleanStaleEntries: () => {
        set((state) => {
          const cleaned: Record<string, CachedConversation> = {};
          for (const [id, cached] of Object.entries(state.conversations)) {
            if (!isCacheStale(cached.timestamp)) {
              cleaned[id] = cached;
            }
          }
          return { conversations: cleaned };
        });
      },
    }),
    {
      name: 'vkm-chat-cache',
      storage: createJSONStorage(() => idbStorage),
      // solo persistir conversaciones completas para evitar datos parciales
      partialize: (state) => ({
        conversations: Object.fromEntries(
          Object.entries(state.conversations).filter(
            ([, v]) => v.isComplete && !isCacheStale(v.timestamp)
          )
        ),
      }),
    }
  )
);

// limpiar entries stale al inicio
if (typeof window !== 'undefined') {
  // ejecutar cleanup después de que la store se hidrate
  setTimeout(() => {
    useChatCacheStore.getState().cleanStaleEntries();
  }, 1000);
}
