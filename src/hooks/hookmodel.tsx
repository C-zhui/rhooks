import {
    ComponentType,
    FC,
    ReactNode,
    Suspense,
    createContext,
    memo,
    useContext,
    useEffect,
    useLayoutEffect,
    useState,
} from "react";
import {
    BehaviorSubject,
    distinctUntilChanged,
    finalize,
    firstValueFrom,
    map,
    share,
    skip,
    tap,
    throwError,
    timeout,
} from "rxjs";
import {
    useObservable,
    useObservableEagerState,
    useObservableState,
    useRenderThrow,
} from "observable-hooks";
import { clamp, identity, isEqual } from "lodash-es";
import { ErrorBoundary } from "react-error-boundary";

export type InstanceHook = (instId: string) => any;

export enum ModelStage {
    created = 0, // 刚创建，未执行
    active = 1, // 有外部引用
    inactive = 2, // 无外部引用
    dead = 3, // 卡 suspense
}

function uuid() {
    return Math.random().toString(36).slice(2);
}

function useChangeLog(...values: any[]) {
    useEffect(() => {
        console.log(...values);
    }, [...values]);
}

const RunHook = memo(({ fn }: { fn: CallableFunction }) => {
    fn();
    return null;
});

const nextTick = queueMicrotask || setTimeout;

export class Controller {
    modelMap: Map<string, Model> = new Map();
    instanceIdMap = new Map<string, ModelInstance>();

    callingHookId = "";
    $modelPoolUpdate = new BehaviorSubject(0);

    getModels() {
        return [...this.modelMap.values()];
    }

    getModel(
        modelId: string,
        params: {
            hook: InstanceHook;
            options: HookModelCreateOptions;
        }
    ) {
        const model = this.modelMap.get(modelId);
        if (model) {
            return model;
        }
        if (params.hook) {
            return this.registerHook(modelId, params.hook, params.options);
        }
        return null;
    }

    private registerHook(
        modelId: string,
        hook: InstanceHook,
        options: HookModelCreateOptions
    ): Model {
        const model = new Model(modelId, hook, options, this);
        this.modelMap.set(modelId, model);

        // 加入了新的 model 需要刷新 model 池
        nextTick(() => {
            this.$modelPoolUpdate.next(Math.random());
        });

        return model;
    }
}

export class Model {
    instances: Map<string, ModelInstance> = new Map();
    $instancePoolUpdate = new BehaviorSubject(0);

    constructor(
        public modelId: string,
        public hook: InstanceHook,
        public options: HookModelCreateOptions,
        public controller: Controller
    ) { }

    getInsts() {
        return [...this.instances.values()];
    }

    getInst(instId: string) {
        let instance: ModelInstance;

        if ((instance = this.instances.get(instId)!)) {
            return instance;
        }

        instance = new ModelInstance(this, instId);

        // 刷新对象池，挂载新 model 实例
        nextTick(() => {
            this.$instancePoolUpdate.next(Math.random());
        });

        this.instances.set(instId, instance);
        return instance;
    }
}

export class ModelInstance {
    $value = new BehaviorSubject<any>(null);
    depFrom = new Set<string>();
    depTo = new Set<string>();
    stage = ModelStage.created;
    id: string;

    constructor(public model: Model, public instId: string) {
        this.id = model.modelId + "@" + instId;
        model.controller.instanceIdMap.set(this.id, this);
        setTimeout(() => {
            if (this.stage === ModelStage.created) {
                this.stage = ModelStage.inactive;
                this.check();
            }
        }, 500);
    }

    dead(error: Error) {
        this.stage = ModelStage.dead;
        this.$value.error(error);
    }

    linkDep(id: string) {
        const runningInst = this.model.controller.instanceIdMap.get(id);
        if (runningInst) {
            this.depFrom.add(runningInst.id);
            runningInst.depTo.add(this.id);
        }
    }

    unlinkDep(id: string) {
        const runningInst = this.model.controller.instanceIdMap.get(id);
        if (runningInst) {
            this.depFrom.delete(runningInst.id);
            runningInst.depTo.delete(this.id);
        }
    }

    clearDep() {
        const selfId = this.id;
        const depTo = this.depTo;
        this.depTo = new Set();

        depTo.forEach((id) => {
            const inst = this.model.controller.instanceIdMap.get(id);
            if (inst) {
                inst.depFrom.delete(selfId);
                inst.check();
            }
        });
    }

    destroy() {
        this.clearDep();
        this.model.controller.instanceIdMap.delete(this.id);
        this.model.instances.delete(this.instId);
        // 删除 model 实例，需要刷新 实例池
        this.model.$instancePoolUpdate.next(
            this.model.$instancePoolUpdate.value + 1
        );
        console.log(`${this.model.modelId}|${this.instId}`, "unmount");
    }

    check() {
        // 解决 model 循环引用的释放
        const checkedNodes = new Set<string>();
        let shouldBreak = false;
        const controller = this.model.controller;
        const dfsCheck = (id: string) => {
            if (checkedNodes.has(id) || shouldBreak) {
                return;
            }
            checkedNodes.add(id);
            const inst = controller.instanceIdMap.get(id);
            if (!inst) return;
            if (inst.stage !== ModelStage.inactive) {
                shouldBreak = true;
                return;
            }
            inst.depFrom.forEach((id2) => {
                dfsCheck(id2);
            });
        };
        dfsCheck(this.id);
        if (shouldBreak) {
            console.log("[hook model]: stop clean");
            // 还有被依赖，终止
            return;
        } else {
            console.log("[hook model]: should clear", checkedNodes);
            checkedNodes.forEach((id) => {
                const inst = controller.instanceIdMap.get(id);
                inst?.destroy();
            });
        }
    }

    _destroyTimer: number = 0;
    $outRef = new BehaviorSubject(0).pipe(
        tap(() => {
            clearTimeout(this._destroyTimer);
            this._destroyTimer = 0;
            this.stage = ModelStage.active;
            console.log(`${this.model.modelId}|${this.instId}`, "mount");
        }),
        finalize(() => {
            this.stage = ModelStage.inactive;
            console.log(`${this.model.modelId}|${this.instId}`, "ref 0");
            this._destroyTimer = setTimeout(() => {
                this.check();
            }, clamp(this.model.options.gcTime || 0, 16, Infinity));
        }),
        share()
    );

    boundHook = () => {
        try {
            this.model.controller.callingHookId = this.id;
            const value = this.model.hook(this.instId);

            // 这里需要再 layout effect 里面触发更新
            useLayoutEffect(() => {
                if (!isEqual(value, this.$value.value)) {
                    this.$value.next(value);
                }

                // 这里在第一次渲染之后快速置为 active
                if (this.stage === ModelStage.created) {
                    this.stage = ModelStage.active;
                }
            });
        } catch (e: any) {
            // 要让消费者感知到这个 错误，考虑到 throw promise 是 suspense 的用法，需要跳过它
            if (e?.then) {
                // promise
            } else {
                console.error(e);
                this.$value.error(e);
            }
            throw e;
        } finally {
            this.model.controller.callingHookId = "";
        }
    };
}

const HookModelControllerContext = createContext<Controller>(new Controller());

const HiddenModelInstancePool: FC<{ model: Model }> = memo(({ model }) => {
    useObservableEagerState(model.$instancePoolUpdate);
    const instances = model.getInsts();

    return (
        <>
            {instances.map((inst) => (
                <ErrorBoundary key={inst.instId} fallback={null}>
                    <Suspense fallback={null}>
                        <RunHook fn={inst.boundHook} />
                    </Suspense>
                </ErrorBoundary>
            ))}
        </>
    );
});

const HiddenModelPool = memo(() => {
    const ctx = useContext(HookModelControllerContext);
    const state = useObservableEagerState(ctx.$modelPoolUpdate);

    const models = ctx.getModels();
    console.log({ number: state, models });

    return (
        <>
            {models.map((model) => (
                <HiddenModelInstancePool key={model.modelId} model={model} />
            ))}
        </>
    );
});

export function withSuspense<T extends object>(Comp: ComponentType<T>) {
    return memo((props: T) => (
        <Suspense>
            <Comp {...props} />
        </Suspense>
    ));
}

export const HookModelRoot: FC<{ children?: ReactNode }> = memo((props) => {
    const [contextVal] = useState(() => new Controller());

    useChangeLog("HookModelRoot", contextVal);
    return (
        <HookModelControllerContext.Provider value={contextVal}>
            <HiddenModelPool />
            <Suspense fallback={<>global fallback</>}>{props.children}</Suspense>
        </HookModelControllerContext.Provider>
    );
});

interface HookModelCreateOptions {
    name?: string;
    gcTime?: number;
}

export function hookModel<T>(
    hook: (instId: string) => T,
    options?: HookModelCreateOptions
) {
    const name = `${options?.name || "anonymous"}`;
    const modelId = `${name}:${uuid()}`;

    const modelHooks = {
        name,
        modelId,
        /** 获取 model 实例，外部不直接使用 */
        useModelInstCtr(instId = "@default") {
            const modelController = useContext(HookModelControllerContext);
            const model = modelController.getModel(modelId, {
                hook,
                options: options || {},
            });
            if (!model) {
                throw new Error("[hook model]: model don't exist");
            }
            const modelInstance = model.getInst(instId);

            // 必须在这里取，useEffect 的时候就已经重置了
            const callingHookInstId = modelController.callingHookId;

            // 这里不能使用 layoutEffect，因为发生 suspense 的时候副作用会被清理 导致 model 卸载
            useEffect(() => {
                if (callingHookInstId) {
                    // 被其他模块引用
                    modelInstance.linkDep(callingHookInstId);
                    return () => modelInstance.unlinkDep(callingHookInstId);
                } else {
                    // 组件消费者，直接引用
                    const subp = modelInstance.$outRef.subscribe();
                    return () => {
                        subp.unsubscribe();
                    };
                }
            }, [instId]);
            useRenderThrow(modelInstance.$value);
            return { modelController, modelInstance };
        },
        /** 正常使用，首次 render 可能返回 null */
        useModel<R = T>(instId = "@default", selector: (a: T) => R = identity) {
            const { modelInstance } = modelHooks.useModelInstCtr(instId);
            return useObservableState(
                useObservable(() =>
                    modelInstance.$value.pipe(
                        map(selector),
                        distinctUntilChanged(isEqual)
                        // observeOn(asapScheduler)
                    )
                ),
                modelInstance.$value.value
            ) as R | null;
        },
        /** suspense 下使用，可以确保首次成功渲染的时候不为 null */
        useModelSuspense<R = T>(
            instId = "@default",
            selector: (a: T) => R = identity
        ) {
            const { modelInstance } = modelHooks.useModelInstCtr(instId);

            if (modelInstance.stage === ModelStage.created) {
                throw firstValueFrom(
                    modelInstance.$value.pipe(
                        skip(1),
                        timeout({
                            each: 200,
                            with: () =>
                                throwError(() => {
                                    const error = new Error(
                                        "load model timeout, check cycle suspense"
                                    );
                                    modelInstance.dead(error);
                                    return error;
                                }),
                        })
                    )
                );
            }

            const [mapedSubject] = useState(
                () => new BehaviorSubject(selector(modelInstance.$value.value))
            );

            useEffect(() => {
                const sub = modelInstance.$value
                    .pipe(
                        map(selector),
                        distinctUntilChanged(isEqual)
                        // observeOn(asapScheduler)
                    )
                    .subscribe(mapedSubject);
                return () => sub.unsubscribe();
            }, [modelInstance]);

            return useObservableEagerState(mapedSubject) as R;
        },
    };
    return modelHooks;
}
