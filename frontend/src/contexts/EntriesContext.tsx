import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import type { PatchTypeWithKey } from '@/hooks/useConversationHistory';
import { TokenUsageInfo } from 'shared/types';
import { useChatCacheStore } from '@/stores/chatCacheStore';

interface EntriesContextType {
  entries: PatchTypeWithKey[];
  setEntries: (entries: PatchTypeWithKey[]) => void;
  setTokenUsageInfo: (info: TokenUsageInfo | null) => void;
  reset: () => void;
  // cache methods (delegated to global store)
  getCachedEntries: (attemptId: string) => PatchTypeWithKey[] | null;
  setCachedEntries: (
    attemptId: string,
    entries: PatchTypeWithKey[],
    loadedInitial: boolean,
    isComplete?: boolean
  ) => void;
  hasCachedEntries: (attemptId: string) => boolean;
  getCachedLoadedInitial: (attemptId: string) => boolean;
  invalidateCache: (attemptId?: string) => void;
  isConversationComplete: (attemptId: string) => boolean;
  tokenUsageInfo: TokenUsageInfo | null;
}

const EntriesContext = createContext<EntriesContextType | null>(null);

interface EntriesProviderProps {
  children: ReactNode;
}

export const EntriesProvider = ({ children }: EntriesProviderProps) => {
  const [entries, setEntriesState] = useState<PatchTypeWithKey[]>([]);
  const [tokenUsageInfo, setTokenUsageInfo] = useState<TokenUsageInfo | null>(
    null
  );

  // delegar cache methods al store global (persiste entre navegaciones)
  const {
    getCachedEntries,
    setCachedEntries,
    hasCachedEntries,
    getCachedLoadedInitial,
    invalidateCache,
    isConversationComplete,
  } = useChatCacheStore();

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
      isConversationComplete,
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
      isConversationComplete,
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
