
import React, { MutableRefObject, createContext, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom'
import { BehaviorSubject } from 'rxjs';
import { identity } from 'lodash-es';
import { shallowEqual } from '../utils/shallowEqual';

const EMPTY: unique symbol = Symbol();

export interface ContainerProviderProps<State = void> {
  initialState?: State;
  memoChildren?: boolean;
  children: React.ReactNode;
}

export interface Container<Value, State = void> {
  Provider: React.ComponentType<ContainerProviderProps<State>>;
  useContainer: <R = Value>(
    selector?: (s: Value) => R,
    eqFn?: (a: R, b: R) => boolean
  ) => [R, MutableRefObject<Value>];
}

export function createContainer<Value, State = void>(
  useHook: (initialState?: State) => Value,
): Container<Value, State> {
  let Context = createContext<BehaviorSubject<Value>>(EMPTY as any);

  const Provider = memo((props: ContainerProviderProps<State>) => {
    let value = useHook(props.initialState);
    const [valueSubject] = useState(() => new BehaviorSubject(value));

    useLayoutEffect(() => {
      if (valueSubject.value !== value) {
        unstable_batchedUpdates(() => {
          valueSubject.next(value);
        })
      }
    }, [value]);

    const children = useMemo(() => {
      return props.children;
    }, [props.memoChildren]);

    return <Context.Provider value={valueSubject}>{props.memoChildren ? children : props.children}</Context.Provider>;
  })

  function useContainer<R = Value>(
    selector: (s: Value) => R = identity,
    eqFn: (a: R, b: R) => boolean = shallowEqual
  ): [R, MutableRefObject<Value>] {

    selector = selector;
    let valueSubject = useContext(Context);

    // @ts-ignore
    if (valueSubject === EMPTY) {
      throw new Error('Component must be wrapped with <Container.Provider>');
    }

    const latestAll = useRef<Value>(valueSubject.value);
    const [selected, setSelected] = useState(() => selector(valueSubject.value));
    const latestSelected = useRef(selected);
    latestSelected.current = selected;

    useEffect(() => {
      const subp = valueSubject.subscribe(e => {
        const newSelected = selector(e);
        if (e === latestAll.current) {
          return;
        }
        latestAll.current = e;
        if (!eqFn(latestSelected.current, newSelected)) {
          setSelected(newSelected);
        }
      });
      return () => subp.unsubscribe()
    }, [valueSubject])

    return [selected, latestAll];
  }

  return { Provider, useContainer };
}
