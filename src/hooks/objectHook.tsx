import { createRoot } from "react-dom/client";
import { BehaviorSubject, map, skip, Subject, tap } from "rxjs";
import {
  useForceUpdate,
  useObservable,
  useObservableEagerState,
  useObservableState,
  useSubscription,
} from "observable-hooks";
import { Fragment, useMemo, useState } from "react";
import { identity, isEqual } from "lodash-es";
import { shallowEqual } from "../utils/equal";

interface IHookApi<T> {
  state: T;
  setState: (state: Partial<T> | ((prevState: T) => Partial<T>)) => void;
  id: string;
}

interface IModelOption<
  T extends object,
  P extends object,
  R extends object = T
> {
  initState: (id: string, param: P) => T;
  hook?: (params: IHookApi<T>) => R;
}

interface IModel<T extends object, P extends object, R extends object = T> {
  _id: string;
  create(
    id: string,
    param: P,
    parent?: IModelInstance<any>
  ): IModelInstance<T, R>;
  get(
    id: string,
    parent?: IModelInstance<any>
  ): IModelInstance<T, R> | undefined;
}

interface IModelInstance<T extends object, R extends object = T> {
  id: string;
  alive: boolean;
  children: Map<IModel<any, any>, IModelInstance<T>[]>;
  childrenChange: Subject<void>;
  hook?: (params: IHookApi<T>) => R;
  state: BehaviorSubject<T>;
  mergeState: BehaviorSubject<T & R>;
  getState(): T;
  setState: (state: Partial<T> | ((prevState: T) => Partial<T>)) => void;
  getHookState(): T & R;
  useState<Ret = T & R>(selector?: (state: T & R) => Ret): Ret;
  getChildren<T1 extends object, P1 extends object, R1 extends object = T1>(
    model: IModel<T1, P1, R1>
  ): IModelInstance<T, R>[];
  useChildren<T1 extends object, P1 extends object, R1 extends object = T1>(
    model: IModel<T1, P1, R1>
  ): IModelInstance<T, R>[];
  removeChildren(model: IModel<any, any, any>, id: string): void;
  destroy(): void;
}

const rootModelInstance: IModelInstance<any> = {
  id: "root",
  alive: false,
  children: new Map(),
  childrenChange: new Subject<void>(),
  hook: undefined,
  state: new BehaviorSubject<any>({}),
  mergeState: new BehaviorSubject<any>({}),
  getState() {
    return this.state.value;
  },
  useState() {
    return this.state.value;
  },
  setState() {},
  getHookState() {
    return this.mergeState.value;
  },
  getChildren(model: IModel<any, any>) {
    return this.children.get(model) || [];
  },
  useChildren(model: IModel<any, any>) {
    useObservableEagerState(this.childrenChange);
    return this.children.get(model) || [];
  },
  removeChildren(model: IModel<any, any>, id: string) {
    const children = this.children.get(model) || [];
    this.children.set(
      model,
      children.filter((child) => child.id !== id)
    );
    this.childrenChange.next();
  },
  destroy() {
    this.children.forEach((childrenType) => {
      childrenType.forEach((child) => child.destroy());
    });
    this.children.clear();
    this.childrenChange.next();
    this.childrenChange.complete();
    this.alive = false;
  },
};

const LogicTree = ({ node }: { node: IModelInstance<any> }) => {
  useObservableState(node.childrenChange);
  const state = useObservableEagerState(node.state);

  const ret = node.hook?.({ state, setState: node.setState, id: node.id });

  useMemo(() => {
    const nextMergeState = { ...node.getState(), ...ret };

    if (!isEqual(nextMergeState, node.mergeState.value)) {
      node.mergeState.next(nextMergeState);
    }
  }, [ret]);

  const items = [...node.children.entries()];

  return (
    <>
      {items.map(([model, children]) => (
        <Fragment key={model._id}>
          {children.map((child) => (
            <LogicTree key={child.id} node={child} />
          ))}
        </Fragment>
      ))}
    </>
  );
};

function ensureLogicTreeMounted() {
  if (rootModelInstance.alive) {
    return;
  }
  rootModelInstance.alive = true;
  const rootContainer = createRoot(document.createElement("div"));
  rootContainer.render(<LogicTree node={rootModelInstance} />);
}

export default function createModel<
  T extends object,
  P extends object,
  R extends object
>(option: IModelOption<T, P, R>): IModel<T, P, R> {
  ensureLogicTreeMounted();

  const { initState, hook } = option;

  const model: IModel<T, P, R> = {
    _id: Math.random().toString(36).substring(2),
    create(id: string, param: P, parent?: IModelInstance<any>) {
      if (!parent) {
        parent = rootModelInstance;
      }

      const exist = parent.getChildren(model).find((child) => child.id === id);
      if (exist) {
        return exist as IModelInstance<T, R>;
      }

      const state = new BehaviorSubject(initState(id, param) as T);
      const mergeState = new BehaviorSubject(initState(id, param) as T & R);

      const instance: IModelInstance<T, R> = {
        id,
        alive: true,
        children: new Map(),
        childrenChange: new Subject<void>(),
        hook,
        state,
        mergeState,
        getState() {
          return state.value;
        },
        setState(s: Partial<T> | ((prevState: T) => Partial<T>)) {
          let nextState = typeof s === "function" ? s(state.value) : s;
          nextState = { ...state.value, ...nextState };
          state.next(nextState as T);
        },
        getHookState() {
          return mergeState.value;
        },
        useState<Ret = T & R>(selector?: (state: T & R) => Ret): Ret {
          useForceUpdate();

          selector = selector || identity;
          const [v, set] = useState(() => selector(mergeState.value));
          useSubscription(
            useObservable(() =>
              mergeState.pipe(
                skip(1),
                map(selector),
                tap((s) => {
                  !shallowEqual(s, v) && set(s);
                })
              )
            )
          );
          return v;
        },
        getChildren: function (model: any) {
          return instance.children.get(model) || [];
        } as any,
        useChildren: function (model: any) {
          useObservableEagerState(instance.childrenChange);
          return instance.children.get(model) || [];
        } as any,
        removeChildren(model, id) {
          const children = instance.children.get(model) || [];
          instance.children.set(
            model,
            children.filter((child) => child.id !== id)
          );
          instance.childrenChange.next();
        },
        destroy() {
          instance.children.forEach((childrenType) => {
            childrenType.forEach((child) => child.destroy());
          });
          instance.children.clear();
          instance.childrenChange.next();
          parent.removeChildren(model, id);
        },
      };

      if (hook) {
        const children = parent.children.get(model) || [];
        children.push(instance);
        parent.children.set(model, children);
        parent.childrenChange.next();
      }
      return instance;
    },
    get(id: string, parent?: IModelInstance<any>) {
      if (!parent) {
        parent = rootModelInstance;
      }
      const children = parent.getChildren(model);

      return children.find((child) => child.id === id);
    },
  };

  return model;
}
