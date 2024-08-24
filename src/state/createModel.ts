import { BehaviorSubject, Subject } from 'rxjs';
import { EffectX } from './effectx';
import { shallowReadonly } from '../utils/proxy';

function proxyKeyCreator(creator: (k: string) => any) {
    return new Proxy({} as any, {
        get(target, prop) {
            if (!target[prop]) {
                target[prop] = creator(prop as string);
            }
            return target[prop];
        },
        set() {
            return true
        }
    });
}

const SYMBOL_SEAL = Symbol();

function sealSubject(subject: Subject<any> & { [SYMBOL_SEAL]?: boolean }) {
    if (subject[SYMBOL_SEAL]) {
        return;
    }
    subject[SYMBOL_SEAL] = true;

    const warn = (words: string) => {
    };

    subject.next = () => {
        warn('next method');
    };
}

const nextTickTaskQueue = [] as CallableFunction[];

const flushNextTickTaskQueue = async () => {
    await Promise.resolve();
    const cloneQueue = nextTickTaskQueue.concat();
    nextTickTaskQueue.length = 0;
    cloneQueue.forEach((cb) => {
        try {
            cb();
        } catch (e) {
            console.error('flush async task error', e, 'callback is', cb);
        }
    });
};

interface InnerApi<S extends object, I extends object, E extends object> {
    state: S;
    setState: (ps: Partial<S>) => string[];
    dispatch: { [k in keyof I]: (arg: I[k]) => void };
    events: { [k in keyof E]: Subject<E[k]> };

    actions: { [k in keyof I]: Subject<I[k]> },
    emit: { [k in keyof E]: (arg: E[k]) => void },

    states: { [k in keyof S]: BehaviorSubject<S[k]> };
    asyncStates: { [k in keyof S]: BehaviorSubject<S[k]> };
    updates: { [k in keyof S]: Subject<S[k]> };
    fullUpdate: Subject<S>;
    fullState: BehaviorSubject<S>;
    asyncFullState: BehaviorSubject<S>;

    effectx: EffectX;
}

interface ModelOption<S extends object, I extends object, E extends object> {
    name: string;
    state(): S;
    setup: (api: InnerApi<S, I, E>) => (() => void) | void;
}

interface StateModel<S extends object, I extends object, E extends object> {
    state: S;
    dispatch: { [k in keyof I]: (arg: I[k]) => void };
    events: { [k in keyof E]: Subject<E[k]> };
    destroy(): void;

    states: { [k in keyof S]: BehaviorSubject<S[k]> };
    asyncStates: { [k in keyof S]: BehaviorSubject<S[k]> };
    updates: { [k in keyof S]: Subject<S[k]> };
    fullUpdate: Subject<S>;
    fullState: BehaviorSubject<S>;
    asyncFullState: BehaviorSubject<S>;
}

export function createModel<S extends object, I extends object, E extends object>(option: ModelOption<S, I, E>) {
    return function createInstance() {
        let state = shallowReadonly(option.state());

        const events = proxyKeyCreator(k => new Subject());
        const emit = proxyKeyCreator(k => (evtData: any) => events[k].next(evtData));;
        const actions = proxyKeyCreator(k => new Subject());
        const dispatch = proxyKeyCreator(k => (actData: any) => actions[k].next(actData))
        const states = proxyKeyCreator(k => new BehaviorSubject((state as any)[k]));
        const asyncStates = proxyKeyCreator(k => new BehaviorSubject((state as any)[k]));
        const updates = proxyKeyCreator(k => new Subject());

        const asyncFullState = new BehaviorSubject(state);
        const fullState = new BehaviorSubject(state);
        const fullUpdate = new Subject<S>();

        const innerApi: InnerApi<S, I, E> = {
            get state() {
                return state;
            },
            actions,
            emit,
            events,
            states,
            dispatch,
            asyncStates,
            asyncFullState,
            fullState,
            updates,
            fullUpdate,

            setState: (
                partialValue: Partial<S>,
            ): string[] => {
                const old: any = state || {};
                state = shallowReadonly(Object.assign({}, old, partialValue));

                const changeKeys = [] as string[];

                Object.entries(partialValue).forEach(([k, v]) => {
                    if (old[k] !== v) {
                        changeKeys.push(k);
                        (states as Record<string, Subject<any>>)[k].next(v);

                        nextTickTaskQueue.push(() => {
                            const propSubject = (asyncStates as Record<string, Subject<any>>)[k] as BehaviorSubject<any>;
                            if (propSubject.value !== (state as any)[k]) {
                                propSubject.next((state as any)[k]);
                            }
                        });

                        nextTickTaskQueue.push(() => {
                            (updates as Record<string, Subject<any>>)[k].next(v);
                        });
                    }
                });

                if (changeKeys.length) {
                    fullState.next(state);

                    nextTickTaskQueue.push(() => {
                        if (asyncFullState.value !== state) {
                            asyncFullState.next(state);
                        }
                    });

                    const tempVal = state;
                    nextTickTaskQueue.push(() => {
                        fullUpdate.next(tempVal);
                    });

                    flushNextTickTaskQueue();
                }

                return changeKeys;
            },
            effectx: new EffectX(),
        }

        let cleanup: CallableFunction | void;
        const destroy = () => {
            const all = [
                fullState,
                asyncFullState,
                Object.values(states),
                Object.values(asyncStates),
                Object.values(events),
                Object.values(actions),
                Object.values(updates)
            ];

            // 销毁状态订阅
            all.flat().forEach((sub) => {
                (sub as Subject<string>).complete();
                sealSubject(sub as Subject<string>);
            });
            cleanup?.();
            innerApi.effectx.destroy();
        }

        const model: StateModel<S, I, E> = {
            get state() {
                return state;
            },
            dispatch,
            events,
            destroy,
            states,
            asyncStates,
            updates,
            fullUpdate,
            fullState,
            asyncFullState
        }

         cleanup = option.setup(innerApi);

        return model;
    }
}
