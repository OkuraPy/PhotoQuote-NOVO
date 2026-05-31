import { QueryClient } from '@tanstack/react-query';

// Single shared React Query client (so signOut can clear it — avoids retaining one account's
// cached data after switching accounts).
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});
