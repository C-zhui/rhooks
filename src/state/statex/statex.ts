/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable max-lines-per-function */
/* eslint-disable @typescript-eslint/member-ordering */
import { BehaviorSubject, Observable, Subject, Subscription, first, firstValueFrom, map, of } from 'rxjs';
import { EffectX } from '../effectx';
import { nextTick as defaultNextTick } from '../misc/schedule';
import { Logger } from '../misc/logger';
import { EventEmitMode, LIFE_CYCLE_EVENT } from './const';
import { timeRandomId } from '../misc/id';
import { shallowReadonly } from '../misc/proxy';
import { isNil } from '../misc/helper';

type ConstructorLike = new (...args: any[]) => any;

/** @ignore */
export const stateXLogger = new Logger('StateX');

// destroy 之后，需要把 subject 的几个方法重写并 warn 提示
const SYMBOL_SEAL = Symbol();
function sealSubject(subject: Subject<any> & { [SYMBOL_SEAL]?: boolean }, state: StateX<any, any, any>) {
  if (subject[SYMBOL_SEAL]) {
    return;
  }
  subject[SYMBOL_SEAL] = true;

  const cls = state.constructor as typeof StateX;
  const warn = (words: string) => {
    stateXLogger.warn(
      // eslint-disable-next-line max-len
      `${cls.stateName}'s instance (${state.instanceId}) already destroyed, but you use its subject's ${words}, it doesn't work because rewriten.`
    );
  };

  subject.next = () => {
    warn('next method');
  };
  subject.subscribe = (observer) => {
    // @ts-expect-error
    if (!isNil(subject.value)) {
      // @ts-expect-error
      return of(subject.value).subscribe(observer);
    }
    warn('subscribe method');
    return new Subscription();
  };
  subject.unsubscribe = () => {
    warn('unsubscribe method');
  };
}

// 所有异步的逻辑统一触发
const nextTickTaskQueue = [] as CallableFunction[];

/**
 * StateX 是一个状态管理工具类，作为基类使用
 *
 * 1. 创建子类
 * ```ts
 * // 继承 StateX 并声明 状态 和 事件
 * class CountDownModel extends StateX<{ count: number }, { resume: number; pause: number; timeout: void }> {
 *   static stateName = 'CountDown';
 *   timer: any = 0;
 *   constructor() {
 *     super(() => ({ count: 0 })); // 传递工厂函数，调用 super
 *
 *     // 直接监听状态，转为事件
 *     this.updates.count.subscribe((c) => {
 *       if (c === 0) {
 *         this.emit('timeout', void 0);
 *         this.pause();
 *       }
 *     });
 *   }
 *
 *   preEffect: string = '';
 *   start(count: number) {
 *     count = count | 0;
 *     if (count <= 0) {
 *       return;
 *     }
 *     this.cleanEffect(this.preEffect);
 *     this.preEffect = this.runEffect(() => {
 *       this.setState({ count });
 *       this.emit('resume', this.state.count);
 *       this.timer = setInterval(() => {
 *         this.setState({ count: this.state.count - 1 });
 *       }, 1000);
 *       return () => this.pause();
 *     });
 *   }
 *
 *   pause() {
 *     if (this.timer) {
 *       this.timer && clearInterval(this.timer);
 *       this.timer = 0;
 *       this.emit('pause', this.state.count);
 *     }
 *   }
 *
 *   continue() {
 *     this.start(this.state.count);
 *   }
 * }
 * ```
 *
 * 2. 创建对象实例
 * ```ts
 * const countdown = new CountDownModel();
 * // 模拟 ui 响应状态
 * countdown.states.count.subscribe((c) => console.log('tick', c));
 * // 类似的有以下形式用来满足不同场景的响应式需要
 * countdown.states // 分离字段的 BehaviorSubjects
 * countdown.fullState // 整体状态 BehaviorSubject
 * countdown.asyncStates // 分离字段异步更新的 BehaviorSubjects
 * countdown.asyncFullState // 整体异步更新的 BehaviorSubject
 * countdown.updates  // 分离字段的更新事件 Subject ，同步还是异步取决于 setState 的第二个参数
 * countdown.fullUpdate // 分离字段的更新事件 Subject ，同步还是异步取决于 setState 的第二个参数
 *
 * countdown.state // 可以直接访问到状态，但不具备响应式
 *
 * // 调用方法
 * countdown.start(10);
 * countdown.events.timeout.subscribe(()=>{ console.log('do something') }); // 监听事件
 * // ...
 * countdown.destroy(); // 销毁之后再 调用 start 是无用的，因为 runEffect 会检查 destroyed 状态
 *
 * ```
 * 3. 聚合事件
 *
 * 当需要从每个实例里面订阅事件时，有一个统一的切入点会方便很多
 * ```ts
 * StateX.getAggregateEvent(CountDownModel).timeout.subscribe(({id, data})=>{
 *   // 可以获取对应的实例
 *   const countdown = StateX.getInstanceOf(CountDownModel, id);
 * })
 * ```
 *
 * 4. 在 react 中使用
 *
 * 结合提供的 hook ，`useStateX` 可以响应 状态变化 并注入到组件中
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
export class StateX<T extends object = {}, E extends object = {}, A extends object = {}> extends EffectX {
  static EventEmitMode = EventEmitMode;
  static LIFE_CYCLE_EVENT = LIFE_CYCLE_EVENT;
  static nextTick = defaultNextTick;

  /** 子类应该给这个字段重写一个新的名字 */
  static stateName = '_StateX';

  /** 所有对象都在这，便于管理 */
  static ObjectHubs = new Map<ConstructorLike, Map<string, StateX<any, any, any>>>();

  /** 管理聚合事件 */
  static EventHubs = new Map<ConstructorLike, Record<string, Subject<any>>>();

  /** 管理输入事件 */
  static ActionHubs = new Map<ConstructorLike, Record<string, Subject<any>>>();

  static SubClassMap = new Map<string, typeof StateX>();

  /** @ignore */
  private static _warningMap = new Map<any, boolean>();

  /** 等待获取某个 Model，通过 stateName */
  static async forModel(name: string): Promise<typeof StateX> {
    const Cls = StateX.SubClassMap.get(name);
    if (Cls) {
      return Cls;
    }
    return await firstValueFrom(
      StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.register].pipe(
        first((e) => e.id === name),
        map((e) => e.data)
      )
    );
  }

  /** 获取该类的所有实例 */
  static getInstancesMap<T extends ConstructorLike>(cls: T): Map<string, InstanceType<T>> {
    if (Object.is(cls, StateX) && !StateX._warningMap.get(cls)) {
      stateXLogger.error(`don't use new StateX() directly, use a subclass`);
      StateX._warningMap.set(cls, true);
      return new Map();
    }

    if (!(cls.prototype instanceof StateX) && !StateX._warningMap.get(cls)) {
      stateXLogger.error('call getInstancesMap incorrectly ', cls, ' is not subclass of StateX');
      StateX._warningMap.set(cls, true);
      return new Map();
    }

    const subCls = cls as any as typeof StateX;

    if (subCls.stateName === StateX.stateName && !StateX._warningMap.get(subCls)) {
      stateXLogger.error('you should set a unique static stateName to this class : ', subCls.toString());
      StateX._warningMap.set(subCls, true);
    }

    // check stateName conflict
    const existCls = StateX.SubClassMap.get(subCls.stateName);
    if (existCls && existCls !== subCls && !StateX._warningMap.get(subCls)) {
      stateXLogger.error(
        'you should set a unique static stateName to this class : ',
        subCls,
        'conflict with',
        existCls
      );
      StateX._warningMap.set(subCls, true);
    }

    const stateHub =
      StateX.ObjectHubs.get(subCls) ||
      (() => {
        const hub = new Map();
        StateX.SubClassMap.set(subCls.stateName, subCls);
        StateX.ObjectHubs.set(subCls, hub);
        StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.register].next({
          id: subCls.stateName,
          data: subCls
        });
        return hub;
      })();
    return stateHub;
  }

  /** 获取该类的某个实例 */
  static getInstanceOf<T extends ConstructorLike>(cls: T, id: string): InstanceType<T> | undefined {
    const stateHub = StateX.getInstancesMap(cls);
    return stateHub.get(id);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static getAggregateEvent<T extends object = {}, E extends object = {}>(cls: typeof StateX<T, E>) {
    const eventHub: {
      [k in keyof E]: Subject<{ id: string; data: E[k] }>;
    } & {
      [k: string | symbol]: Subject<{ id: string; data: any }>;
    } =
      StateX.EventHubs.get(cls) ||
      new Proxy({} as any, {
        get(target, prop: string) {
          if (target[prop]) {
            return target[prop];
          }
          const event = new Subject();
          target[prop] = event;
          if (!(typeof prop === 'symbol')) {
            StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.addAggragateEvent].next({
              id: cls.stateName,
              data: { eventName: prop }
            });
          }
          return target[prop];
        }
      });
    StateX.EventHubs.set(cls, eventHub);
    return eventHub;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static getAggregateAction<T extends object = {}, E extends object = {}, A extends object = {}>(
    cls: typeof StateX<T, E, A>
  ) {
    const actionHub: {
      [k in keyof A]: Subject<{ id: string; data: A[k] }>;
    } & {
      [k: string | symbol]: Subject<{ id: string; data: any }>;
    } =
      StateX.ActionHubs.get(cls) ||
      new Proxy({} as any, {
        get(target, prop: string) {
          if (target[prop]) {
            return target[prop];
          }
          const action = new Subject();
          target[prop] = action;
          StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.addAggragateAction].next({
            id: cls.stateName,
            data: { actionName: prop }
          });
          return target[prop];
        }
      });
    StateX.ActionHubs.set(cls, actionHub);
    return actionHub;
  }

  /** 实例 id */
  readonly instanceId: string;

  /** 创建时间 */
  readonly createTime: Date;
  readonly createStack: Error;

  /** update 和 event 的默认触发模式，默认为 async */
  emitMode: EventEmitMode;

  /** 整个状态，放入 BehaviorSubject, 同步更新 */
  readonly fullState: BehaviorSubject<T>;

  /** 异步更新，同步多次 setState 只会推送一次 */
  readonly asyncFullState: BehaviorSubject<T>;

  readonly fullUpdate: Subject<T>;

  /** 将 state 每个属性都转化成 Observable，不受 emitMode 影响，直接同步推送 */
  readonly states: { [k in keyof T]: Observable<T[k]> };

  /** 将 state 每个属性都转化成 Observable，不受 emitMode 影响，直接异步推送 */
  readonly asyncStates: { [k in keyof T]: Observable<T[k]> };

  /** 将 state 每个属性的更新都转化成 Observable，受 emitMode 影响 */
  readonly updates: { [k in keyof T]: Observable<T[k]> };

  /** 将 event 每个属性的更新都转化成 Observable，受 emitMode 影响 */
  readonly events: { [k in keyof E]: Observable<E[k]> };

  /** 外部的输入事件 */
  protected readonly actions: { [k in keyof A]: Subject<A[k]> };
  private _dispatching = false;

  /** 触发事件，只能内部触发 */
  protected emit: { [k in keyof E]: E[k] extends void ? () => void : (data: E[k], emitMode?: EventEmitMode) => void };

  /** 发送输入事件 */
  dispatch: { [k in keyof A]: A[k] extends void ? () => void : (data: A[k]) => void };

  // 私有字段，外部不可直接修改到
  #state: T;

  /** 获得内部持有的对象，只读 */
  get state() {
    return this.#state;
  }

  /**
   * @param partialValue , 部分将要更新的状态
   * @param updateTriggerMode , 更新模式，EventEmitMode
   * @returns
   */
  protected setState: (partialValue: Partial<T>, updateTriggerMode?: EventEmitMode) => string[];

  /**
   *
   * @param init 初始状态的工厂函数，必须同步返回
   * @param option
   */
  constructor(
    init: () => T,
    {
      instanceId,
      emitMode = EventEmitMode.async
    }: {
      /** 实例id */
      instanceId?: string;
      /** 事件默认更新方式， 默认为 EventEmitMode.async */
      emitMode?: EventEmitMode;
    } = {}
  ) {
    super();

    // 分配 id
    this.instanceId = instanceId || timeRandomId();
    this.createTime = new Date();
    this.createStack = new Error();
    this.emitMode = emitMode;

    // 初始化状态
    this.#state = shallowReadonly(init());

    const cls = this.constructor as typeof StateX;
    // 加到状态仓库中
    const stateHub = StateX.getInstancesMap(cls);

    if (stateHub.get(this.instanceId)) {
      // 添加多次 视为 bug
      stateXLogger.error(`${cls.stateName}'s instance (${this.instanceId}) already created, maybe bug here`);
    }
    stateHub.set(this.instanceId, this as any);

    // 初始化 states, asyncStates, updates, events
    this.fullState = new BehaviorSubject(this.#state);
    this.asyncFullState = new BehaviorSubject(this.#state);

    this.states = new Proxy({} as any, {
      get: (target, prop) => {
        target[prop] = target[prop] || new BehaviorSubject((this.#state as any)?.[prop] || null);
        this.checkDestroy() && sealSubject(target[prop], this);
        return target[prop];
      },
      set() {
        return true;
      }
    });

    this.asyncStates = new Proxy({} as any, {
      get: (target, prop) => {
        target[prop] = target[prop] || new BehaviorSubject((this.#state as any)?.[prop] || null);
        this.checkDestroy() && sealSubject(target[prop], this);
        return target[prop];
      },
      set() {
        return true;
      }
    });

    this.updates = new Proxy({} as any, {
      get: (target, prop) => {
        target[prop] = target[prop] || new Subject();
        this.checkDestroy() && sealSubject(target[prop], this);
        return target[prop];
      },
      set() {
        return true;
      }
    }) as any;

    this.fullUpdate = new Subject();

    this.events = new Proxy({} as any, {
      get: (target, prop) => {
        target[prop] = target[prop] || new Subject();
        this.checkDestroy() && sealSubject(target[prop], this);
        return target[prop];
      },
      set() {
        return true;
      }
    }) as any;

    this.emit = new Proxy({} as any, {
      get: (target, prop) => {
        target[prop] =
          target[prop] ||
          ((data: any, em?: EventEmitMode) => {
            if (this.checkDestroy()) {
              return;
            }
            em = em || this.emitMode;
            const eventHub = StateX.getAggregateEvent(cls) as Record<string, Subject<any>>;

            if (em === EventEmitMode.sync) {
              (this.events as Record<string, Subject<any>>)[prop as string].next(data);
              eventHub[prop as string].next({ id: this.instanceId, data });
            } else {
              nextTickTaskQueue.push(() => {
                (this.events as Record<string, Subject<any>>)[prop as string].next(data);
                eventHub[prop as string].next({ id: this.instanceId, data });
              });
              this.flushNextTickTaskQueue();
            }
          });

        return target[prop];
      },
      set() {
        return true;
      }
    });

    this.actions = new Proxy({} as any, {
      get: (target, prop) => {
        target[prop] = target[prop] || new Subject();
        this.checkDestroy() && sealSubject(target[prop], this);
        return target[prop];
      },
      set() {
        return true;
      }
    }) as any;

    this.dispatch = new Proxy({} as any, {
      get: (target, prop) => {
        target[prop] =
          target[prop] ||
          ((data: any) => {
            if (this.checkDestroy()) {
              return;
            }
            let nested = false;
            if (this._dispatching) {
              stateXLogger.warn('nested dispatching action, not recommanded.');
              nested = true;
            }
            this._dispatching = true;

            StateX.getAggregateAction(cls)[prop as keyof A].next({
              id: this.instanceId,
              data
            });
            this.actions[prop as keyof A].next(data);
            if (!nested) {
              this._dispatching = false;
            }
          });

        return target[prop];
      },
      set() {
        return true;
      }
    });

    this.setState = (
      partialValue: Partial<T>,
      updateTriggerMode: EventEmitMode = this.emitMode
    ): string[] => {
      if (this.checkDestroy()) {
        return [];
      }

      const old: any = this.#state || {};
      this.#state = shallowReadonly(Object.assign({}, this.#state, partialValue));

      const changeKeys = [] as string[];

      Object.entries(partialValue).forEach(([k, v]) => {
        if (old[k] !== v) {
          changeKeys.push(k);
          (this.states as Record<string, Subject<any>>)[k].next(v);

          nextTickTaskQueue.push(() => {
            const propSubject = (this.asyncStates as Record<string, Subject<any>>)[k] as BehaviorSubject<any>;
            if (propSubject.value !== (this.#state as any)[k]) {
              propSubject.next((this.#state as any)[k]);
            }
          });

          if (updateTriggerMode === EventEmitMode.sync) {
            (this.updates as Record<string, Subject<any>>)[k].next(v);
          } else {
            nextTickTaskQueue.push(() => {
              (this.updates as Record<string, Subject<any>>)[k].next(v);
            });
          }
        }
      });

      if (changeKeys.length) {
        this.fullState.next(this.#state);

        nextTickTaskQueue.push(() => {
          if (this.asyncFullState.value !== this.#state) {
            this.asyncFullState.next(this.#state);
          }
        });

        if (updateTriggerMode === EventEmitMode.async) {
          const tempVal = this.#state;
          nextTickTaskQueue.push(() => {
            this.fullUpdate.next(tempVal);
          });
        } else {
          this.fullUpdate.next(this.#state);
        }

        StateX.getAggregateEvent(cls)[StateX.LIFE_CYCLE_EVENT.instanceUpdate].next({
          id: this.instanceId,
          data: changeKeys
        });

        this.flushNextTickTaskQueue();
      }

      return changeKeys;
    };

    StateX.nextTick(() => {
      StateX.getAggregateEvent(cls)[StateX.LIFE_CYCLE_EVENT.afterCreate].next({
        id: this.instanceId,
        data: this
      });
    });
  }

  /** 清空、执行异步任务队列 */
  protected flushNextTickTaskQueue = () => {
    StateX.nextTick(() => {
      const cloneQueue = nextTickTaskQueue.concat();
      nextTickTaskQueue.length = 0;
      cloneQueue.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          stateXLogger.error('flush async task error', e);
        }
      });
    });
  };

  /** @ignore */
  private _destroyedLogOnce = false;

  /**
   * 检查是否已经销毁，如是打 log
   * @returns 是否已销毁
   */
  checkDestroy(withoutWarn = false) {
    if (this.isDestroyed() && !this._destroyedLogOnce && !withoutWarn) {
      this._destroyedLogOnce = true;
      stateXLogger.warn(
        `still using ${(this.constructor as typeof StateX).stateName} instance (${this.instanceId
        }) after destroyed, there must be a logic bug.`
      );
    }
    return this.isDestroyed();
  }

  /**
   * 销毁，清除所持有的副作用，以及自主添加的副作用
   */
  destroy() {
    const cls = this.constructor as typeof StateX;

    StateX.nextTick(() => {
      StateX.getAggregateEvent(cls)[StateX.LIFE_CYCLE_EVENT.afterDestroy].next({
        id: this.instanceId,
        data: this
      });
    });

    // 先收集，调用 super.destroy 之后就拿不到这些了
    const all = [
      this.fullState,
      this.asyncFullState,
      Object.values(this.states),
      Object.values(this.asyncStates),
      Object.values(this.events),
      Object.values(this.actions),
      Object.values(this.updates)
    ];
    // 阻断新的副作用，销毁其他副作用
    super.destroy();
    // 销毁状态订阅
    all.flat().forEach((sub) => {
      (sub as Subject<string>).complete();
      sealSubject(sub as Subject<string>, this);
    });

    // 从状态仓库中移除
    const stateHub = StateX.getInstancesMap(cls);

    stateHub.delete(this.instanceId);
  }
}

