import { difference, intersection, isNil, keys, noop, pickBy, sortBy } from "lodash-es";
import { DependencyList, EffectCallback, useEffect, useRef } from "react";
import { shallowEqual } from "../utils/equal";


type Effect = { effect: EffectCallback, deps?: DependencyList, order: number };

interface UseEffects {
  (effects: Record<string, Effect | null | undefined>): void;
  effect: (effect: EffectCallback, deps?: DependencyList, order?: number) =>
    { effect: EffectCallback, deps?: DependencyList, order: number }
  ;
}

export const useEffects: UseEffects = (effects) => {

  const lastEffects = useRef<Record<string, Effect | null | undefined>>({});
  const cleanups = useRef<Record<string, CallableFunction>>({});
  useEffect(() => {
    const lastKeys = keys(lastEffects.current).filter(e => lastEffects.current[e]);
    const curKeys = keys(effects).filter(e => effects[e]);
    // 清理消失的 effect
    const shouldCleanKeys = difference(lastKeys, curKeys);

    shouldCleanKeys.forEach(k => {
      if (cleanups.current[k]) {
        cleanups.current[k]?.();
        delete cleanups.current[k];
      }
    })

    // 添加的 effect
    const effectTobeRunKeys = difference(curKeys, lastKeys).map((k) => ['add', k, effects[k]] as [string, string, Effect]);
    // 上次存在的 effect
    const remainedKeys = intersection(curKeys, lastKeys).map(k => ['remain', k, effects[k]] as [string, string, Effect])

    sortBy(effectTobeRunKeys.concat(remainedKeys), e => e[2].order)
      .forEach(([type, key, effect]) => {
        if (type === 'add') {
          cleanups.current[key] = effect.effect() || noop;
        } else if (type === 'remain') {
          // 先检查依赖变化，运行副作用
          if (isNil(effect.deps) || !shallowEqual(lastEffects.current[key]?.deps, effects[key]?.deps)) {
            cleanups.current[key]?.();
            delete cleanups.current[key];
            cleanups.current[key] = effect.effect() || noop;
          }
        }
      })

    lastEffects.current = pickBy(effects) // 去除 null 值
  });

  useEffect(() => {
    return () => {
      keys(cleanups.current).forEach(k => {
        cleanups.current[k]?.();
        delete cleanups.current[k];
      });
    }
  }, [])
}

useEffects.effect = (effect: EffectCallback, deps?: DependencyList, order = 100) => {
  return { effect, deps, order }
}