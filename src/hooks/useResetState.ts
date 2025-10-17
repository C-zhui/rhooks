import { isEqual } from 'lodash-es';
import { useCallback, useMemo, useRef, SetStateAction, Dispatch } from 'react';
import { usePrevious, useUpdate } from 'react-use';

export const useResetState = <T>(
  init: () => T,
  autoReset: boolean,
  deps: any[],
): [T, Dispatch<SetStateAction<T>>, () => void] => {
  const preDeps = usePrevious(deps);
  const initState = useMemo(init, deps);

  const stateRef = useRef(initState);

  if (!isEqual(deps, preDeps) && autoReset) {
    stateRef.current = initState;
  }

  const forceUpdate = useUpdate();

  const setState = useCallback((action: SetStateAction<T>) => {
    let newS: T;
    if (typeof action === 'function') {
      const f = action as (v: T) => T;
      newS = f(stateRef.current);
    } else {
      newS = action;
    }
    if (!isEqual(newS, stateRef.current)) {
      stateRef.current = newS;
      forceUpdate();
    }
  }, []);

  const reset = useCallback(() => {
    stateRef.current = initState;
    forceUpdate();
  }, [initState]);

  return [stateRef.current, setState, reset];
};
