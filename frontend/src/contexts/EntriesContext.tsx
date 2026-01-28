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
import { TokenUsageInfo } from 'shared/types';

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
  setTokenUsageInfo: (info: TokenUsageInfo | null) => void;
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
  tokenUsageInfo: TokenUsageInfo | null;
}

const EntriesContext = createContext<EntriesContextType | null>(null);

interface EntriesProviderProps {
  children: ReactNode;
}

export const EntriesProvider = ({ children }: EntriesProviderProps) => {
  const [entries, setEntriesState] = useState<PatchTypeWithKey[]>([]);
  const conversationCache = useRef<ConversationCache>(new Map());
  const [tokenUsageInfo, setTokenUsageInfo] = useState<TokenUsageInfo | null>(
    null
  );

  const setEntries = useCallback((newEntries: PatchTypeWithKey[]) => {
    setEntriesState(newEntries);
  }, []);

  const setTokenUsageInfoCallback = useCallback(
    (info: TokenUsageInfo | null) => {
      setTokenUsageInfo(info);
    },
    []
  );

  const reset = useCallback(() => {
    setEntriesState([]);
    setTokenUsageInfo(null);
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
      setTokenUsageInfo: setTokenUsageInfoCallback,
      reset,
      getCachedEntries,
      setCachedEntries,
      hasCachedEntries,
      getCachedLoadedInitial,
      invalidateCache,
      tokenUsageInfo,
    }),
    [
      entries,
      setEntries,
      setTokenUsageInfoCallback,
      reset,
      getCachedEntries,
      setCachedEntries,
      hasCachedEntries,
      getCachedLoadedInitial,
      invalidateCache,
      tokenUsageInfo,
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

export const useTokenUsage = () => {
  const context = useContext(EntriesContext);
  if (!context) {
    throw new Error('useTokenUsage must be used within an EntriesProvider');
  }
  return context.tokenUsageInfo;
};
