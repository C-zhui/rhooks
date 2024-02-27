export function uuid() {
    return Math.random().toString(36).slice(2);
  }
  
  export function warn(...contents: any[]) {
    console.warn("[vstore]: ", ...contents);
  }
  
  export function error(...contents: any[]) {
    console.error("[vstore]: ", ...contents);
  }
  
  export const nextTick = queueMicrotask || setTimeout;
  
  type DeferPromise<T> = Promise<T> & {
    value: T;
    error: Error;
    set: (v: T) => void;
    throw: (e: Error) => void;
  };
  export function PromiseSetable<T>(): DeferPromise<T> {
    const binderSetter = (f: any) => (e: any) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      p.value = e;
      f(e);
    };
    const binderError = (f: any) => (e: any) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      p.error = e;
      f(e);
    };
    let setter, throwErr;
    const p = new Promise((res, rej) => {
      setter = binderSetter(res);
      throwErr = binderError(rej);
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    p.set = setter;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    p.throw = throwErr;
    return p as DeferPromise<T>;
  }
  