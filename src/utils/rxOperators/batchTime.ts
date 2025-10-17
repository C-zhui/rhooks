import { Observable, Subject, UnaryFunction, auditTime, map, pipe, scan } from 'rxjs';
import { map as _map } from 'lodash';

interface CreateBatchReqParam<P, P2, R, R2> {
  duration?: number;
  mergeParams: (params: P[]) => P2;
  fetcher: (params: P2) => Promise<R>;
  resolver: (res: R, param: P, resolve: (res: R2) => void, reject: (err: any) => void) => void;
}

type AynArgFun = (arg: any) => void;

export const batchTime = <T>(duration: number): UnaryFunction<Observable<T>, Observable<T[]>> =>
  pipe(
    scan((acc, x) => (acc.push(x), acc), [] as T[]),
    auditTime(duration),
    map((arr) => {
      const r = [...arr];
      arr.length = 0;
      return r;
    })
  );

// 创建批量请求，对外单独调用，按一定时间将参数合并请求，将返回结果分流
export const createBatchReq = <P, P2, R, R2>({
  duration = 50,
  mergeParams,
  fetcher,
  resolver
}: CreateBatchReqParam<P, P2, R, R2>): ((param: P) => Promise<R2>) => {
  const in$ = new Subject<{
    param: P;
    resolve: AynArgFun;
    reject: AynArgFun;
  }>();

  in$.pipe(batchTime(duration)).subscribe(async (arr) => {
    try {
      const res = await fetcher(mergeParams(_map(arr, (e) => e.param)));
      arr.forEach((e) => {
        resolver(res, e.param, e.resolve, e.reject);
      });
    } catch (err) {
      _map(arr, (item) => item.reject(err));
    }
  });

  return (param: P) =>
    new Promise<R2>((resolve, reject) => {
      in$.next({ param, resolve, reject });
    });
};
