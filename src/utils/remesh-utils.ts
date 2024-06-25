/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Args,
  Remesh,
  RemeshCommand,
  RemeshCommandOptions,
  RemeshDomainAction,
  RemeshDomainOutput,
  RemeshEffect,
  RemeshEvent,
  RemeshEventOptions,
  RemeshQueryOptions,
  Serializable,
  VerifiedRemeshDomainDefinition
} from 'remesh';
import type {
  RemeshDomainContext,
  RemeshState,
  RemeshQuery,
  DomainConceptName,
  Capitalize,
  RemeshAction,
  RemeshEffectContext,
  RemeshStore,
  RemeshExtern,
  RemeshStateItem,
  RemeshQueryAction
} from 'remesh';
import { useRemeshDomain, useRemeshEvent, useRemeshQuery, useRemeshStore } from 'remesh-react';
import { useMemo } from 'react';
import { mapValues, noop, toPairs } from 'lodash-es';
import { Subject, merge, mergeMap } from 'rxjs';

/** 创建 states，注意属性命名必须是大驼峰 并以 State 结尾 */
export function createStates<T extends Record<DomainConceptName<'State'>, any>>(
  domain: RemeshDomainContext,
  states: T
): {
    [k in keyof T]: k extends DomainConceptName<'State'> ? RemeshState<T[k]> : never;
  } {
  return Object.keys(states)
    .filter((k) => k.endsWith('State'))
    .map((k) =>
      domain.state({
        name: k as any,
        default: (states as any)[k]
      })
    )
    .reduce((acc, x) => ((acc[x.stateName] = x), acc), {} as any);
}

type QueryImpl<T extends Serializable = void, U = any> = {
  impl: RemeshQueryOptions<[T], U>['impl'];
};

export function createQuery<T extends Serializable = void, U = any>(
  impl: RemeshQueryOptions<[T], U>['impl']
) {
  return { impl } as QueryImpl<T, U>;
}

/** 创建 querys，注意属性命名必须是大驼峰 并以 Query 结尾 */
export function createQuerys<T extends Record<DomainConceptName<'Query'>, QueryImpl<any, any>>>(
  domain: RemeshDomainContext,
  querys: T
): {
    [k in keyof T]: k extends DomainConceptName<'Query'>
    ? T[k] extends QueryImpl<infer A, infer R>
    ? RemeshQuery<[A], R>
    : RemeshQuery<any, any>
    : never;
  } {
  return Object.keys(querys)
    .filter((k) => k.endsWith('Query'))
    .map((k) =>
      domain.query({
        name: k as any,
        impl: querys[k as any].impl
      })
    )
    .reduce((acc, x) => ((acc[x.queryName] = x), acc), {} as any);
}

/** 直接创建 state 对应的 querys，注意属性命名必须是大驼峰 并以 Query 结尾 */
export function createQueryFromState<T extends Record<DomainConceptName<'Query'>, RemeshState<any>>>(
  domain: RemeshDomainContext,
  states: T
): {
    [k in keyof T]: k extends DomainConceptName<'Query'>
    ? RemeshQuery<[], T[k] extends RemeshState<infer S> ? S : null>
    : never;
  } {
  return Object.keys(states)
    .filter((k) => k.endsWith('Query'))
    .map((k) =>
      domain.query({
        name: k as any,
        impl({ get }) {
          return get(states[k as any]());
        }
      })
    )
    .reduce((acc, x) => ((acc[x.queryName] = x), acc), {} as any);
}

type CommandImpl<T> = {
  impl: RemeshCommandOptions<[T]>['impl'];
};

export function createCommand<T>(impl: RemeshCommandOptions<[T]>['impl']) {
  return { impl } as CommandImpl<T>;
}

/** 创建 commands，注意属性命名必须是大驼峰 并以 Command 结尾 */
export function createCommands<T extends Record<DomainConceptName<'Command'>, CommandImpl<any>>>(
  domain: RemeshDomainContext,
  cmds: T
): {
    [k in keyof T]: k extends DomainConceptName<'Command'>
    ? RemeshCommand<T[k] extends CommandImpl<infer P> ? [P] : []>
    : never;
  } {
  return Object.keys(cmds)
    .filter((k) => k.endsWith('Command'))
    .map((k) =>
      domain.command({
        name: k as any,
        impl: cmds[k as any].impl
      })
    )
    .reduce((acc, x) => ((acc[x.commandName] = x), acc), {} as any);
}

type EventImpl<T, U> = {
  impl?: RemeshEventOptions<[T], void>['impl'];
};

export function createEvent<T, U = T>(impl?: RemeshEventOptions<[T], U>['impl']) {
  return { impl } as EventImpl<T, U>;
}
/** 创建 events，注意属性命名必须是大驼峰 并以 Event 结尾 */
export function createEvents<T extends Record<DomainConceptName<'Event'>, EventImpl<any, any>>>(
  domain: RemeshDomainContext,
  events: T
): {
    [k in keyof T]: k extends DomainConceptName<'Event'>
    ? T[k] extends EventImpl<infer P, infer U>
    ? RemeshEvent<[P], U>
    : RemeshEvent<[any], any>
    : never;
  } {
  return Object.keys(events)
    .filter((k) => k.endsWith('Event'))
    .map((k) =>
      domain.event({
        name: k as any,
        impl: events[k as any]?.impl!
      })
    )
    .reduce((acc, x) => ((acc[x.eventName] = x), acc), {} as any);
}

export function createEventTrigger<T>(domain: RemeshDomainContext, name: Capitalize) {
  const Event = domain.event<T>({
    name: `${name}Event`
  });
  const Command = domain.command<[T]>({
    name: `${name}Command`,
    impl(_1, arg) {
      return Event(arg);
    }
  });

  return {
    TriggerCommand: Command,
    TriggerEvent: Event
  };
}

/** 创建 effects，注意属性命名必须是大驼峰 并以 Effect 结尾 */
export function createEffects(
  domain: RemeshDomainContext,
  effectMap: Record<DomainConceptName<'Effect'>, RemeshEffect['impl']>
): void {
  Object.keys(effectMap)
    .filter((k) => k.endsWith('Effect'))
    .forEach((k) =>
      domain.effect({
        name: k as any,
        impl: effectMap[k as any]
      })
    );
}

type Values<T extends Record<string | number | symbol, unknown>> = T[keyof T];
type ObjectFromEntries<T extends [string, any]> = {
  [P in T as P[0]]: P[1];
};

export function createStatesEx<T extends Record<Capitalize, any>>(
  domain: RemeshDomainContext,
  states: T
): {
  query: ObjectFromEntries<
    Values<{
      [k in keyof T]: [k: k extends Capitalize ? `${k}Query` : never, v: RemeshQuery<[], T[k]>];
    }>
  >;
  command: ObjectFromEntries<
    Values<{
      [k in keyof T]: [k: k extends Capitalize ? `${k}UpdateCommand` : never, v: RemeshCommand<[T[k]]>];
    }>
  > &
  ObjectFromEntries<
    Values<{
      [k in keyof T]: [
        k: k extends Capitalize ? `${k}ReducerCommand` : never,
        v: RemeshCommand<[(old: T[k]) => T[k]]>
      ];
    }>
  >;
  event: ObjectFromEntries<
    Values<{
      [k in keyof T]: [k: k extends Capitalize ? `${k}UpdateEvent` : never, v: RemeshEvent<[T[k]], void>];
    }>
  >;
} {
  const ps = toPairs(states);

  const result: any = { query: {}, command: {}, event: {} };

  ps.map((p) => {
    const name: Capitalize = p[0] as Capitalize;
    const state = p[1];

    const s = domain.state({
      name: `${name}State`,
      default: state
    });
    const q = domain.query({
      name: `${name}Query`,
      impl({ get }) {
        return get(s());
      }
    });
    const e = domain.event({
      name: `${name}UpdateEvent`
    });

    const c = domain.command({
      name: `${name}UpdateCommand`,
      impl({ }, newOne: any) {
        return [s().new(newOne), e(newOne)];
      }
    });

    const rc = domain.command({
      name: `${name}ReducerCommand`,
      impl({ get }, cb: (a: any) => any) {
        const newOne = cb(get(s()));
        return c(newOne);
      }
    });
    result.query[`${name}Query`] = q;
    result.command[`${name}UpdateCommand`] = c;
    result.command[`${name}ReducerCommand`] = rc;
    result.event[`${name}UpdateEvent`] = e;
  });

  return result;
}

type QueryToUse<T> = T extends RemeshQuery<infer T, infer U> ? (...arg: T) => U : null;

type CommandToUse<T> = T extends RemeshCommand<infer T> ? (...arg: T) => void : null;

type EventToUse<T> = T extends RemeshEvent<infer T, infer U> ? (cb: (...arg: T) => void) => void : null;

type useBoundDomainReturn<T extends Partial<RemeshDomainOutput>, U extends Args<Serializable>> = {
  domain: VerifiedRemeshDomainDefinition<T>;
  useQuery: { [k in keyof T['query']]: QueryToUse<T['query'][k]> };
  commands: { [k in keyof T['command']]: CommandToUse<T['command'][k]> };
  useEvent: { [k in keyof T['event']]: EventToUse<T['event'][k]> };
};

function withFallbackKey(obj: any, fallback: (k: string) => any) {
  return new Proxy(obj, {
    get(target, key: string, receiver) {
      if (target[key]) {
        return Reflect.get(target, key, receiver);
      } else {
        return fallback(key);
      }
    },
    // make it read only
    set() {
      return true;
    },
    defineProperty() {
      return true;
    }
  });
}

/**
 * 创建绑定了的 domain 接口
 * const domainApi = useBoundDomain(YourDomain());
 * domainApi.useQuery.YourQuery(arg);
 * domainApi.useEvent.YourEvent((e)=>{ dosomething(e) });
 * domainApi.command.YourCommand(payload);
 */
export function useBoundDomain<T extends Partial<RemeshDomainOutput>, U extends Args<Serializable>>(
  domainAct: RemeshDomainAction<T, U>
): useBoundDomainReturn<T, U> {
  const domain = useRemeshDomain(domainAct);
  const store = useRemeshStore();

  const { commands, useQuery, useEvent } = useMemo(() => {
    const commands = withFallbackKey(
      mapValues(
        domain.command,
        (cmd) =>
          (...arg: any[]) =>
            store.send((cmd as RemeshCommand<any>)(...arg))
      ),
      (key) => {
        console.error(`command ${key} don't exist`);
        return noop;
      }
    );

    const useQuery = withFallbackKey(
      mapValues(
        domain.query,
        (query) =>
          (...arg: any[]) =>
            useRemeshQuery((query as RemeshQuery<any, any>)(...arg))
      ),
      (key) => {
        console.error(`query ${key} don't exist`);
        return noop;
      }
    );

    const useEvent = withFallbackKey(
      mapValues(
        domain.event,
        (event: RemeshEvent<any, any>) => (cb: (arg: any) => void) => useRemeshEvent(event, cb)
      ),
      (key) => {
        console.error(`event ${key} don't exist`);
        return noop;
      }
    );

    return { commands, useQuery, useEvent };
  }, [domain]);

  return { domain, commands, useQuery, useEvent } as any;
}

type PromiseSetableType<T> = Promise<T> & {
  value: T;
  error: Error;
  set: (v: T) => void;
  throw: (e: Error) => void;
};

export function PromiseSetable<T>(): PromiseSetableType<T> {
  let p: PromiseSetableType<T> | null = null;
  let setter: CallableFunction = noop;
  let throwErr: CallableFunction = noop;
  const binderSetter = (f: CallableFunction) => (e: T) => {
    if (p) {
      p.value = e;
    }
    f(e);
  };
  const binderError = (f: CallableFunction) => (e: Error) => {
    if (p) {
      p.error = e;
    }
    f(e);
  };
  p = new Promise((res, rej) => {
    setter = binderSetter(res);
    throwErr = binderError(rej);
  }) as PromiseSetableType<T>;
  p.set = setter as any;
  p.throw = throwErr as any;
  return p;
}

/**
 * 创建
 * @param domain
 * @param methods 方法 map，方法的签名为 ({ get, put }, arg: P) => T; get 同 command 的 context.get， put 可以放入 command 和 event 执行
 * @returns { MethodsQuery }
 */
export function createMethods<
  T extends Record<
    string,
    (
      ...args: [
        {
          get: RemeshEffectContext['get'];
          put: (action: RemeshAction) => void;
        },
        any
      ]
    ) => any
  >
>(
  domain: RemeshDomainContext,
  methods: T
): {
  // eslint-disable-next-line @typescript-eslint/ban-types
  MethodsQuery: RemeshQuery<
    [],
    {
      [k in keyof T]: (arg: Parameters<T[k]>[1]) => ReturnType<T[k]>;
    }
  >;
} {
  const callingEvents = new Subject<{
    callback: CallableFunction;
    arg: any;
    pid: string;
    promise: PromiseSetableType<any>;
  }>();

  const wrapCallback = mapValues(methods, (callback) => (arg: any) => {
    const p = PromiseSetable<any>();

    callingEvents.next({
      callback,
      arg,
      pid: Math.random().toString(),
      promise: p
    });
    return p;
  }) as any;

  const MethodsQuery = domain.query({
    name: 'MethodsQuery',
    impl() {
      return wrapCallback;
    }
  });

  domain.effect({
    name: 'MethodsEffect',
    impl({ get }) {
      const $actions = new Subject<RemeshAction>();
      const put = (action: RemeshAction) => $actions.next(action);

      const $effect = callingEvents.pipe(
        mergeMap(async (cbEvent) => {
          try {
            const res = await cbEvent.callback({ get, put }, cbEvent.arg);
            cbEvent.promise.set(res);
          } catch (e) {
            cbEvent.promise.throw(e as Error);
          }
          return null;
        })
      );
      return merge($actions, $effect);
    }
  });

  return {
    MethodsQuery
  };
}

/**
 * 创建一个可以随处触发 command 和 event 的工具。
 * 通常 command 只能在 store 或者 effect 中 触发，event 只能在 command 和 effect 中触发。
 * 通过该工具可以到处触发。这是一个后门，当你知道自己在做什么之前，请不要考虑使用它。
 * @param domain RemeshDomainContext
 */
export function createDangerousAction(domain: RemeshDomainContext) {
  const $action = new Subject<RemeshAction>();
  domain.effect({
    name: 'DangerousActionEffect',
    impl() {
      return $action;
    }
  });
  return function putAction(action: RemeshAction) {
    $action.next(action);
  };
}

/**
 * 创建一个可以随处 get state 和 query 的工具。
 * 需要 domain 是 ignited 状态
 * @param domain RemeshDomainContext
 */
export function createDangerousGetter(domain: RemeshDomainContext) {
  let lazyGet: any = () => null;

  const wraper = <T, R extends Args<Serializable>>(input: RemeshStateItem<T> | RemeshQueryAction<R, T>): T =>
    lazyGet(input);

  domain.effect({
    name: 'DangerousGetterEffect',
    impl({ get }) {
      lazyGet = get;
      return null;
    }
  });

  return wraper;
}

const ExternHelperDomain = Remesh.domain({
  name: 'ExternHelperDomain',
  impl(domain) {
    const ExternGetterState = domain.state({
      name: 'ExternGetterState',
      default: () => domain.getExtern
    });

    const ExternGetterQuery = domain.query({
      name: 'ExternQuery',
      impl({ get }) {
        return get(ExternGetterState());
      }
    });

    return {
      query: {
        ExternGetterQuery
      }
    };
  }
});

/**
 * 从 store 里面直接拿出特定的 extern
 * @param store
 * @param extern
 * @returns T
 */
export function getExtern<T>(store: RemeshStore, extern: RemeshExtern<T>) {
  const helperDomain = store.getDomain(ExternHelperDomain());
  const externGetter = store.query(helperDomain.query.ExternGetterQuery());
  return externGetter(extern);
}
