import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import type { PatchTypeWithKey } from '@/hooks/useConversationHistory';

// cache of conversations indexed by attempt id
type ConversationCache = Map<
  string,
  {
    entries: PatchTypeWithKey[];
    loadedInitial: boolean;
    timestamp: number;
  }
>;

// cache TTL is 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

// helper to check if a cache entry is stale
const isCacheStale = (timestamp: number): boolean => {
  return Date.now() - timestamp > CACHE_TTL_MS;
};

interface EntriesContextType {
  entries: PatchTypeWithKey[];
  setEntries: (entries: PatchTypeWithKey[]) => void;
  reset: () => void;
  // cache methods
  getCachedEntries: (attemptId: string) => PatchTypeWithKey[] | null;
  setCachedEntries: (
    attemptId: string,
    entries: PatchTypeWithKey[],
    loadedInitial: boolean
  ) => void;
  hasCachedEntries: (attemptId: string) => boolean;
  getCachedLoadedInitial: (attemptId: string) => boolean;
  invalidateCache: (attemptId?: string) => void;
}

const EntriesContext = createContext<EntriesContextType | null>(null);

interface EntriesProviderProps {
  children: ReactNode;
}

export const EntriesProvider = ({ children }: EntriesProviderProps) => {
  const [entries, setEntriesState] = useState<PatchTypeWithKey[]>([]);
  const conversationCache = useRef<ConversationCache>(new Map());

  const setEntries = useCallback((newEntries: PatchTypeWithKey[]) => {
    setEntriesState(newEntries);
  }, []);

  const reset = useCallback(() => {
    setEntriesState([]);
  }, []);

  // get cached entries for an attempt
  const getCachedEntries = useCallback(
    (attemptId: string): PatchTypeWithKey[] | null => {
      const cached = conversationCache.current.get(attemptId);
      if (!cached) return null;

      // invalidate stale cache
      if (isCacheStale(cached.timestamp)) {
        conversationCache.current.delete(attemptId);
        return null;
      }

      return cached.entries;
    },
    []
  );

  // store entries in cache
  const setCachedEntries = useCallback(
    (
      attemptId: string,
      entries: PatchTypeWithKey[],
      loadedInitial: boolean
    ) => {
      conversationCache.current.set(attemptId, {
        entries: [...entries],
        loadedInitial,
        timestamp: Date.now(),
      });
    },
    []
  );

  // check if cache exists (without side effects)
  const hasCachedEntries = useCallback((attemptId: string): boolean => {
    const cached = conversationCache.current.get(attemptId);
    if (!cached) return false;

    // check if stale without deleting
    return !isCacheStale(cached.timestamp);
  }, []);

  // get initial load state from cache
  const getCachedLoadedInitial = useCallback((attemptId: string): boolean => {
    const cached = conversationCache.current.get(attemptId);
    return cached?.loadedInitial ?? false;
  }, []);

  // invalidate cache (specific attempt or all)
  const invalidateCache = useCallback((attemptId?: string) => {
    if (attemptId) {
      conversationCache.current.delete(attemptId);
    } else {
      conversationCache.current.clear();
    }
  }, []);

  const value = useMemo(
    () => ({
      entries,
      setEntries,
      reset,
      getCachedEntries,
      setCachedEntries,
      hasCachedEntries,
      getCachedLoadedInitial,
      invalidateCache,
    }),
    [
      entries,
      setEntries,
      reset,
      getCachedEntries,
      setCachedEntries,
      hasCachedEntries,
      getCachedLoadedInitial,
      invalidateCache,
    ]
  );

  return (
    <EntriesContext.Provider value={value}>{children}</EntriesContext.Provider>
  );
};

export const useEntries = (): EntriesContextType => {
  const context = useContext(EntriesContext);
  if (!context) {
    throw new Error('useEntries must be used within an EntriesProvider');
  }
  return context;
};
