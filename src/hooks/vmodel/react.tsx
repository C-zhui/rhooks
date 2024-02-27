import {
    FC,
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
  } from "react";
  import { ModelInstance, ModelWithId, Store, createStore } from "./store";
  import { clamp, noop } from "lodash-es";
  import { reactiveApi } from "./reactive-api";
  
  const defaultStore = createStore({});
  export const VStoreContext = createContext<Store>(defaultStore);
  
  export const VStoreRoot: FC<{ children: ReactNode; store?: Store }> = (
    props
  ) => {
    const [autoStore] = useState(() => createStore({}));
    useEffect(() => {
      [...autoStore.instancesMap.values()].forEach((inst) => {
        inst.destroy();
      });
    }, []);
    return (
      <VStoreContext.Provider value={props.store || autoStore}>
        {props.children}
      </VStoreContext.Provider>
    );
  };
  
  export function useVModelInstance<S extends object = any>(
    modelWithId: ModelWithId<S>
  ): ModelInstance<S> {
    const store = useContext(VStoreContext);
    const modelInstance = store.getModelInstance(modelWithId);
  
    useEffect(() => {
      const sub = modelInstance.$outRef.subscribe();
      return () => {
        setTimeout(() => {
          sub.unsubscribe();
        }, clamp(modelInstance.model.option.gcTime || 0, 16, Infinity));
      };
    }, [modelInstance]);
  
    return modelInstance;
  }
  
  export function useVModelSelector<S extends object = any, R = void>(
    modelWithId: ModelWithId<S>,
    selector: (s: ModelInstance<S>["api"]) => R = noop as any
  ): [R, ModelInstance<S>["api"]] {
    const modelInstance = useVModelInstance(modelWithId);
    const [, update] = useState({});
  
    const selectedValue = useMemo(
      () =>
        reactiveApi.computed(() => selector(modelInstance.api), {
          onTrigger: () => {
            update({});
          },
        }),
      [modelInstance]
    );
  
    useEffect(() => {
      return () => {
        // 清除副作用
        selectedValue.effect.stop();
      };
    }, [selectedValue]);
    return [selectedValue.value, modelInstance.api];
  }
  