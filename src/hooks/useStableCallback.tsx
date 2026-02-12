import { usePrevious } from "ahooks";
import { sortBy } from "lodash-es";
import { useCallback, useRef, useState } from "react";

export function useStableCallback<T extends CallableFunction>(callback: T): T {
  const ref = useRef(callback);
  ref.current = callback;
  return useCallback(
    (...args: any[]) => ref.current(...args),
    [],
  ) as unknown as T;
}

export function useStableApis<T extends Record<string, CallableFunction>>(
  apis: T,
): T {
  const [stableApis] = useState({} as T);

  const prevApis = usePrevious(apis);

  let keys = sortBy(Object.keys(apis));

  if (prevApis) {
    if (keys.length !== Object.keys(prevApis).length) {
      throw new Error("apis length must be same");
    }
  }

  for (const key of keys) {
    stableApis[key as unknown as keyof T] = useStableCallback(apis[key]) as T[keyof T];
  }
  return stableApis;
}
