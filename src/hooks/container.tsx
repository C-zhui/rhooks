
import React, { MutableRefObject, createContext, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom'
import { BehaviorSubject } from 'rxjs';
import { every, identity, isArray, isEqual, keys, uniq, isObject } from 'lodash-es';

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

export function shallowEqual(obj1: any, obj2: any) {
  // 是否直接相等
  if (Object.is(obj1, obj2)) {
    return true
  }

  // 如果非对象直接比较
  if (!isObject(obj1) && !isObject(obj2)) {
    return obj1 === obj2;
  }

  // 处理都是 array 的情况
  if (isArray(obj1) && isArray(obj2)) {
    return obj1.length == obj2.length && every(obj1, (a, i) => { return obj1[i] === obj2[i] })
  }

  // 遍历对象的自身属性（不包括继承的属性）
  const allKeys = uniq(keys(obj1).concat(keys(obj2)))
  for (const key of allKeys) {
    if ((obj1.hasOwnProperty(key) || obj2.hasOwnProperty(key)) && !Object.is(obj1[key], obj2[key])) {
      return false;
    }
  }

  // 如果所有自身属性都相等，则返回 true
  return true;
}

export const deepEqual = isEqual;
