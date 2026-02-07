// 任务调度运行器

import PriorityQueue from "../../ds/priorityQueue";
import { isAsyncGenerator, isGenerator, Task } from "./type";

let frame: number | null = null;
let start = 0;

const tasks = PriorityQueue<Task>(
  (a, b) => a.p > b.p || (a.p === b.p && a.id < b.id)
);
const THRESHOLD = 14;

let order = 0;
function nextOrder() {
  order++;
  if (order === Number.MAX_SAFE_INTEGER) {
    order = 1;
  }
  return order;
}

function getTime() {
  return performance.now();
}

function isWithinBudget() {
  return getTime() - start < THRESHOLD;
}

function clear() {
  frame = null;
}

function tryRun() {
  if (!frame && tasks.len()) {
    frame = requestAnimationFrame(flush);
  }
}

function generatorResolve(item: Task, res: IteratorResult<any, any>) {
  item.val = res.value ?? item.val;
  if (res.done) {
    item.resolver(item.val);
    item.endTime = Date.now();
    item.duration = item.endTime - item.startTime;
  } else {
    item.id = nextOrder();
    tasks.push(item);
  }

  if (res.done) {
    item.onSchedule?.({ ...item });
    item.onResolved?.({ ...item });
    tryRun();
  } else {
    item.onSchedule?.({ ...item });
    tryRun();
  }
}

function generatorReject(item: Task, err: any) {
  item.rejecter(err);
  item.endTime = Date.now();
  item.duration = item.endTime - item.startTime;

  item.error = err;
  item.onRejected?.(item);
  tryRun();
}

async function flush(_t: number) {
  start = getTime();

  while (tasks.len() && isWithinBudget()) {
    const item = tasks.pop()!;
    item.p--;
    if (item.p < 0) {
      item.p += item.priority;
    }
    // item.cnt++;

    if (item.g || isGenerator(item.fn) || isAsyncGenerator(item.fn)) {
      if (item.canceled) {
        continue;
      }

      if (!item.g) {
        item.g = item.fn();
      }

      try {
        const res: any = item.g!.next(item.val);

        if (res?.then) {
          // async gen
          res
            .then((result) => {
              generatorResolve(item, result);
            })
            ?.catch((err) => {
              generatorReject(item, err);
            });
        } else if (res?.value?.then) {
          // gen return promise
          (res.value as Promise<any>)
            .then((result) => {
              generatorResolve(item, {
                ...res,
                value: result,
              });
            })
            ?.catch((err) => {
              generatorReject(item, err);
            });
        } else {
          // gen return value
          generatorResolve(item, res);
          item.onSchedule?.({ ...item });
        }
      } catch (err) {
        generatorReject(item, err);
      }
    } else {
      // 普通函数，直接 resolve
      try {
        const value = item.fn();
        generatorResolve(item, { done: true, value: value });
      } catch (err) {
        generatorReject(item, err);
      }
    }
  }

  clear();
  tryRun();
}

export interface RetType<T> extends PromiseLike<T> {
  cancel: () => void;
  task: Task;
}

export function scheduleTask<T = any>(
  callback: Task["fn"],
  {
    name,
    priority,
    signal,
    onSchedule,
    onResolved,
    onRejected,
  }: {
    name?: string;
    priority?: Task["p"];
    signal?: AbortController["signal"];
    onSchedule?: Task["onSchedule"];
    onResolved?: Task["onResolved"];
    onRejected?: Task["onRejected"];
  } = {}
): RetType<T> {
  let t: Task;

  const ret: RetType<T> = new Promise<T>((resolve, reject) => {
    tasks.push(
      (t = {
        name,
        cnt: 0,
        startTime: Date.now(),
        endTime: -1,
        duration: -1,
        onSchedule,
        onResolved,
        onRejected,
        p: priority || 0,
        priority: priority || 1,
        id: nextOrder(),
        fn: callback,
        resolver: resolve,
        rejecter: reject,
      })
    );
    tryRun();
  }) as any;

  ret.cancel = () => (t.canceled = true);
  // @ts-ignore
  ret.task = t;

  if (signal) {
    const abort = () => {
      ret.cancel();
      signal.removeEventListener("abort", abort);
    };
    signal.addEventListener("abort", abort);
  }

  return ret;
}
