import React, { MutableRefObject, useRef } from 'react';
import { createContext, useContextSelector } from 'use-context-selector';

const EMPTY: unique symbol = Symbol();

export interface ContainerProviderProps<State = void> {
  initialState?: State;
  children: React.ReactNode;
}

export interface Container<Value, State = void> {
  Provider: React.ComponentType<ContainerProviderProps<State>>;
  useContainer: <R = Value>(
    selector?: (s: Value) => R
  ) => [R, MutableRefObject<Value>];
}

function refEq(a: any, b: any): boolean {
  return a === b;
}

export function createContainer<Value, State = void>(
  useHook: (initialState?: State) => Value,
  equalFn: (a: any, b: any) => boolean = refEq
): Container<Value, State> {
  let Context = createContext<Value | typeof EMPTY>(EMPTY);

  function Provider(props: ContainerProviderProps<State>) {
    let value = useHook(props.initialState);
    return <Context.Provider value={value}>{props.children}</Context.Provider>;
  }

  function identity(a: any) {
    return a;
  }

  function useContainer<R = Value>(
    selector?: (s: Value) => R
  ): [R, MutableRefObject<Value>] {
    const latest = useRef<Value>(null as any);

    selector = selector || identity;
    let value = useContextSelector<Value, R>(Context as any, (s) => {
      return selector?.(s);
      const curVal =
        latest.current == null ? null : (selector || identity)(latest.current);
      latest.current = s;
      const newVal = (selector || identity)(s);
      if (equalFn(curVal, newVal)) {
        return curVal;
      }

      return newVal;
    });

    if (value === EMPTY) {
      throw new Error('Component must be wrapped with <Container.Provider>');
    }
    return [value, latest];
  }

  return { Provider, useContainer };
}
