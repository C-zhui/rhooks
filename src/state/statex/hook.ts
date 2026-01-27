import { StateX } from './statex';
import { nextTick as defaultNextTick } from '../misc/schedule';
import ReactDOM from 'react-dom';
import { useObservableEagerState } from 'observable-hooks';
import { useMemo } from 'react';
import { distinctUntilChanged, map, of } from 'rxjs';
import { shallowEqual } from '../../utils/equal';

/** 将异步状态更新运行在 react 的 batchUpdate 上下文中 */
export function enableNextTickBatching() {
  StateX.nextTick = (cb: CallableFunction) =>
    defaultNextTick(() => {
      if (ReactDOM.unstable_batchedUpdates) {
        ReactDOM.unstable_batchedUpdates(() => {
          cb();
        });
      } else {
        cb();
      }
    });
}

/**
 * enableNextTickBatching 将异步状态更新运行在 react 的 batchUpdate 上下文中，而 disableNextTickBatching 恢复原有的异步环境
 */
export function disableNextTickBatching() {
  StateX.nextTick = defaultNextTick;
}

function identity<T>(a: T) {
  return a;
}

/**
 * 用于响应 StateX 的状态
 *
 * ```tsx
 * export default function Test() {
 *   const [cd] = useState(() => new CountDownModel());
 *
 *   useEffect(() => {
 *     cd.runEffect(() => {
 *       const sub1 = cd.events.timeout.subscribe((e) => {
 *         console.log('timeout');
 *       });
 *
 *       const sub2 = cd.events.resume.subscribe((e) => {
 *         console.log('resume at ', e);
 *       });
 *
 *       const sub3 = cd.events.pause.subscribe((e) => {
 *         console.log('pause at ', e);
 *       });
 *       return () => {
 *         sub1.unsubscribe();
 *         sub2.unsubscribe();
 *         sub3.unsubscribe();
 *       };
 *     });
 *     return () => cd.destroy();
 *   }, []);
 *
 *   const cdState = useStateX(cd);
 *
 *   return (
 *     <div>
 *       <div>
 *         <button onClick={() => cd.start(10)}>start</button>
 *         <span style={{ display: 'inline-block', padding: 4 }}></span>
 *         <button onClick={() => cd.pause()}>pause</button>
 *         <span style={{ display: 'inline-block', padding: 4 }}></span>
 *         <button onClick={() => cd.continue()}>continue</button>
 *       </div>
 *       <div>counter {cdState.count}</div>
 *     </div>
 *   );
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function useStateX<T extends object = {}, R = T>(
  stateX?: StateX<T> | null,
  selector?: (v: T) => R,
  eqFn = shallowEqual
): R {
  const obs = useMemo(
    () =>
      stateX
        ? stateX.asyncFullState.pipe(map(selector || (identity as any)), distinctUntilChanged(eqFn))
        : of(null),

    [stateX]
  );

  return useObservableEagerState(obs) as R;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function useStateXMust<T extends object = {}, R = T>(
  stateX: StateX<T>,
  selector?: (v: T) => R,
  eqFn = shallowEqual
): R {
  const obs = useMemo(
    () => stateX.asyncFullState.pipe(map(selector || (identity as any)), distinctUntilChanged(eqFn)),
    [stateX]
  );

  return useObservableEagerState(obs) as R;
}
