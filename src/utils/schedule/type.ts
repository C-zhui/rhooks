export type Task = {
  id: number;
  p: number;
  priority: number;
  name?: string;
  cnt: number;
  startTime: number;
  endTime: number;
  duration: number;
  resolver: Function;
  rejecter: Function;
  fn: GeneratorFunction | Function | AsyncGeneratorFunction;
  val?: any;
  error?: any;
  resolved?: boolean;
  rejected?: boolean;
  canceled?: boolean;
  g?: AsyncGenerator | Generator;

  onSchedule?: (task: Task) => void;
  onResolved?: (task: Task) => void;
  onRejected?: (task: Task) => void;
};

export function isGenerator(fn: Function) {
  return fn.constructor.name === "GeneratorFunction";
}

export function isAsyncGenerator(fn: Function) {
  return fn.constructor.name === "AsyncGeneratorFunction";
}
