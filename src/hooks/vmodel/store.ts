import {
  DeepReadonly,
  UnwrapNestedRefs,
  getCurrentScope,
} from "@vue/reactivity";
import { reactiveApi, vrType } from "./reactive-api";
import { error, uuid, PromiseSetable, nextTick, warn } from "./utils";
import { BehaviorSubject, finalize, share, tap } from "rxjs";

export enum ModelStage {
  created = 0,
  setup = 1,
  active = 2,
  inactive = 3,
}

interface CreateStoreOption { }

export interface SetupFunc<S extends object = any> {
  (id: string, hook: Hook, vr: vrType): S;
}

export type ModelWithId<S extends object = any> = {
  modelDef: ModelDef<S>;
  id: string;
};

function genInstanceId(m: ModelWithId) {
  return m.modelDef.id + "|" + m.id;
}

export class Store {
  instancesMap: Map<string, ModelInstance> = new Map();
  modelMap: Map<string, ModelDef> = new Map();
  instanceInitStack: string[] = [];
  constructor(public option: CreateStoreOption) { }

  public getModelInstance(modelWithId: ModelWithId): ModelInstance {
    const { modelDef: model, id: instId } = modelWithId;
    this.modelMap.set(model.id, model);
    let instance: ModelInstance;

    if ((instance = this.instancesMap.get(genInstanceId(modelWithId))!)) {
      return instance;
    }

    instance = new ModelInstance(this, model, instId);

    return instance;
  }
}

interface CreateModelOption {
  name?: string;
  gcTime?: number;
  single?: boolean;
}

class ModelDef<T extends object = any> {
  name: string;
  id: string;

  constructor(
    public setup: SetupFunc<T>,
    public option: CreateModelOption = {}
  ) {
    this.name = option.name || "anonymous";
    this.id = `${this.name}:${uuid()}`;
  }

  singleton() {
    return {
      modelDef: this,
      id: "@default",
    };
  }

  withId(instId: string = "@default") {
    if (this.option.single) {
      return {
        modelDef: this,
        id: "@default",
      };
    }
    return {
      modelDef: this,
      id: instId,
    };
  }
}

export class Hook {
  constructor(private instance: ModelInstance) { }

  use<S extends object>(modelWithId: ModelWithId<S>): ModelInstance<S>["api"] {
    const instanceId = genInstanceId(modelWithId);
    const exist = this.instance.store.instanceInitStack.includes(instanceId);
    if (exist) {
      error(
        "encounter model cycle reference " +
        instanceId +
        ", an empty object will be return"
      );
      return {} as any;
    }
    const thatInstance = this.instance.store.getModelInstance(modelWithId);
    thatInstance.depFrom.add(this.instance.id);
    this.instance.depTo.add(thatInstance.id);
    return thatInstance.api;
  }

  get effectScope() {
    return this.instance.efScope;
  }

  lifeCycle<T>(mount: () => T, unmount: (mountRes: T) => void) {
    if (getCurrentScope()) {
      const p = PromiseSetable<T>();
      nextTick(() => {
        p.set(mount());
      });
      reactiveApi.onScopeDispose(() => {
        p.then(unmount);
      });
    } else {
      warn("lifeCycle not in model scope");
    }
  }
}

export class ModelInstance<S extends object = any> {
  id: string;
  depFrom: Set<string> = new Set();
  depTo: Set<string> = new Set();
  efScope = reactiveApi.effectScope();
  stage = ModelStage.created;

  $outRef = new BehaviorSubject(0).pipe(
    tap(() => {
      this.stage = ModelStage.active;
    }),
    finalize(() => {
      this.stage = ModelStage.inactive;
      this.check();
    }),
    share()
  );

  api: DeepReadonly<UnwrapNestedRefs<S>> = reactiveApi.readonly({}) as any;
  hook: Hook;
  constructor(
    public store: Store,
    public model: ModelDef<S>,
    public instId: string
  ) {
    this.id = genInstanceId({
      modelDef: model,
      id: instId,
    });

    this.hook = new Hook(this);
    if (this.stage !== ModelStage.created) {
      return;
    }

    this.efScope.run(() => {
      try {
        store.instanceInitStack.push(this.id);
        this.api = reactiveApi.readonly(
          this.model.setup(this.instId, this.hook, reactiveApi)
        ) as any;
      } catch (e) {
        error("setup run fail", e);
      } finally {
        store.instanceInitStack.pop();
      }
    });

    this.stage = ModelStage.setup;
    setTimeout(() => {
      if (this.stage === ModelStage.setup) {
        this.stage = ModelStage.inactive;
        this.check();
      }
    }, 100);

    store.instancesMap.set(this.id, this);
  }

  private check() {
    const checkedNodes = new Set<string>();
    let shouldBreak = false;
    const controller = this.store;
    const dfsCheck = (id: string) => {
      if (checkedNodes.has(id) || shouldBreak) {
        return;
      }
      checkedNodes.add(id);
      const inst = controller.instancesMap.get(id);
      if (!inst) return;
      if ([ModelStage.active, ModelStage.setup].includes(inst.stage)) {
        console.log("[vstore]: stop", this, "because", inst);
        shouldBreak = true;
        return;
      }
      inst.depFrom.forEach((id2) => {
        dfsCheck(id2);
      });
    };

    dfsCheck(this.id);
    if (shouldBreak) {
      console.log("[vstore]: stop clean");
      // 还有被依赖，终止
      return;
    } else {
      console.log("[vstore]: should clear", checkedNodes);
      checkedNodes.forEach((id) => {
        const inst = controller.instancesMap.get(id);
        inst?.destroy();
      });
    }
  }

  private clearDep() {
    const selfId = this.id;
    const depTo = this.depTo;
    this.depTo = new Set();

    depTo.forEach((id) => {
      const inst = this.store.instancesMap.get(id);
      if (inst) {
        inst.depFrom.delete(selfId);
        nextTick(() => {
          inst.check();
        });
      }
    });
  }

  destroy() {
    this.efScope.stop();
    this.clearDep();
    this.store.instancesMap.delete(this.id);
  }
}

export function createModel<S extends object = any>(
  setup: SetupFunc<S>,
  option: CreateModelOption = {}
) {
  return new ModelDef(setup, option);
}

export function createStore(option: CreateStoreOption) {
  return new Store(option);
}
