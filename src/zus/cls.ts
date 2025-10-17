import { identity } from "lodash-es";
import { create, StoreApi, useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { dPromise } from "../utils/dPromise";

export const syncStore = <A, B>(
  a: StoreApi<A>,
  b: StoreApi<B>,
  mapProp: (stateA: A) => Partial<B>
): CallableFunction => a.subscribe((s) => b.setState(mapProp(s)));

export class ZStore<S> {
  store: StoreApi<S>;

  constructor(initor: () => S) {
    this.store = create(() => initor());
  }

  get state() {
    return this.store.getState();
  }

  setState(partial: Partial<S> | ((state: S) => Partial<S>)) {
    this.store.setState(partial);
  }

  useState = <T>(selector?: (state: S) => T) => {
    const finalSelector = selector || identity;
    return useStore(this.store, useShallow(finalSelector));
  };
}

interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  updatedAt: Date | null;
}

export class QueryStore<P, T> extends ZStore<QueryResult<T>> {
  private queryFn: (params: P, ab: AbortController) => Promise<T>;
  // private params: P | null = null;

  constructor(option: {
    queryFn: (params: P, ab: AbortController) => Promise<T>;
    initParams?: P;
    autoFetch?: boolean;
    debounce?: number;
  }) {
    super(() => ({
      data: null,
      loading: false,
      error: null,
      updatedAt: null,
    }));
    this.queryFn = option.queryFn;
    if (option.autoFetch) {
      this.fetch(option.initParams || ({} as P));
    }
  }

  nextResolve = dPromise<QueryResult<T>>();
  cnt = 0;
  ab = new AbortController();
  fetch(params: P) {
    // this.params = params;
    this.cnt++;
    const _cnt = this.cnt;
    this.ab.abort();
    this.ab = new AbortController();
    this.setState({ loading: true, error: null });

    this.queryFn(params, this.ab)
      .then((data) => {
        if (_cnt !== this.cnt) {
          return;
        }

        this.setState({
          data,
          loading: false,
          error: null,
          updatedAt: new Date(),
        });
        this.nextResolve.set(this.store.getState());
        this.nextResolve = dPromise();
      })
      .catch((error) => {
        if (_cnt !== this.cnt) {
          return;
        }
        this.setState({
          data: null,
          loading: false,
          error,
          updatedAt: null,
        });
        this.nextResolve.set(this.store.getState());
        this.nextResolve = dPromise();
      });
  }
}
