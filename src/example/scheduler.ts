import { scheduleTask } from "../utils/schedule";

let cnt = 0;

function* fib(n: number): Generator<void, BigInt, void> {
  if (n === 0) {
    return 0n;
  } else if (n === 1) {
    return 1n;
  } else {
    const a = yield* fib(n - 1);
    const b = yield* fib(n - 2);
    const num = a + b;
    cnt++;
    if (cnt === 1000) {
      cnt = 0;
      yield;
    }
    return num;
  }
}

function* b() {
  yield "b1";
  yield "b2";
  return "b3";
}

function* a() {
  yield "a1";
  const bv = yield* b();
  console.log({ bv });
  return "a2";
}

scheduleTask(fib.bind(null, 35), {
  name: "a",
  priority: 2,
  onSchedule(task) {
    // console.log(task.name);
  },
  onResolved(task) {
    console.log(task);
  },
});

scheduleTask(fib.bind(null, 35), {
  name: "b",
  priority: 1,
  onSchedule(task) {
    // console.log(task.name);
  },
  onResolved(task) {
    console.log(task);
  },
});

scheduleTask(fib.bind(null, 35), {
  name: "c",
  priority: 3,
  onSchedule(task) {
    // console.log(task.name);
  },
  onResolved(task) {
    console.log(task);
  },
});

scheduleTask(fib.bind(null, 35), {
  name: "d",
  priority: 1,
  onSchedule(task) {
    // console.log(task.name);
  },
  onResolved(task) {
    console.log(task);
  },
});
