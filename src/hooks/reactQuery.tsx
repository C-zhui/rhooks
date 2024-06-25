import {
  UseQueryOptions,
  useQuery,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
  QueryFunctionContext
} from '@tanstack/react-query';
import { every, isNil, castArray } from 'lodash-es';
import ms from 'ms';
import React, { FC, ReactNode } from 'react';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      refetchOnWindowFocus: false
    }
  }
});

const ReactQueryDevtoolsProduction = React.lazy(() =>
  import('@tanstack/react-query-devtools/build/modern/production.js').then((d) => ({
    default: d.ReactQueryDevtools
  }))
);

export const AppQueryClientProvider: FC<{ showDevTool?: boolean; children: ReactNode }> = ({ children }) => {
  // !!! notice dev tools 不能在多个页面开，会有 localStorage 循环设置的问题，所以默认是关的
  const [showDevtools, setShowDevtools] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.toggleRQDevtools = () => setShowDevtools((old) => !old);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showDevtools && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtoolsProduction buttonPosition="top-left" />
        </React.Suspense>
      )}
    </QueryClientProvider>
  );
};

export const allNotNilCheck = (deps: unknown[]): unknown[] | null =>
  every(deps, (d) => !isNil(d) && d !== '') ? deps : null;

/**
 * @param key - json[]
 * @param init - 状态工厂函数
 * @returns [data<T>, update, reset, queryResult]
 */
export function useGlobalState<T>(
  key: UseQueryOptions<T>['queryKey'],
  init: () => T,
  options: Omit<UseQueryOptions<T>, 'queryKey'> & { withoutData?: boolean } = {}
) {
  const client = useQueryClient();
  const query = useQuery({
    gcTime: ms('30m'),
    staleTime: Infinity,
    queryKey: key,
    initialData: init,
    enabled: false, // 只通过 update 、reset 更新
    ...options
  });
  const update = (updater: ((old: T) => T) | T) => client.setQueryData(key, updater as any);
  const reset = () => client.setQueryData(key, init());
  return [options.withoutData ? (null as T) : (query.data as T), update, reset, query] as const;
}

export const API_CACHE_TIME = 60 * 60 * 1000;
export const API_STALE_TIME = 60 * 1000;

/**
 * @param key - json[]
 * @param init - 状态查询函数
 * @returns [data<T>, reset, queryResult]
 */
export function useAsyncState<T>(
  key: UseQueryOptions<T>['queryKey'],
  init: NonNullable<UseQueryOptions<T>['queryFn']>,
  options: Omit<UseQueryOptions<T>, 'queryKey'> = {}
) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: init,
    gcTime: API_CACHE_TIME,
    staleTime: API_STALE_TIME,
    enabled: Boolean(allNotNilCheck(castArray(key))),
    ...options
  });
  const reset = () => client.refetchQueries({ queryKey: key, exact: true });
  return [query.data, reset, query] as const;
}

/**
 * 定义全局副作用 Hook
 */
export function useGlobalEffect(
  key: UseQueryOptions<void>['queryKey'],
  callback: (ctx: QueryFunctionContext) => Promise<CallableFunction | void> | (CallableFunction | void)
) {
  useQuery({
    queryKey: key,
    gcTime: 10,
    staleTime: Infinity,
    queryFn(ctx) {
      return new Promise(async (res, rej) => {
        const dispose = await callback(ctx);
        if (ctx.signal.aborted) {
          dispose?.();
        } else {
          ctx.signal.addEventListener('abort', () => {
            rej();
            dispose?.();
          });
        }
      });
    }
  });
}
