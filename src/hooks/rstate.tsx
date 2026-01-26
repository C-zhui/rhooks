/**
 * objectHook.tsx
 * 
 * 状态管理库的核心实现，基于 React、RxJS 和 observable-hooks
 * 提供了模型实例的创建、管理和响应式状态订阅功能
 * 
 * 主要功能：
 * 1. 基于类的模型实例实现
 * 2. 响应式状态管理
 * 3. 模型实例的层级管理
 * 4. 计算属性支持
 * 5. 状态持久化和变更通知
 * 6. 异步初始化支持
 */

// 导入必要的依赖
import { createRoot, Root } from "react-dom/client"; // React 18+ 的根节点创建API
import { BehaviorSubject, firstValueFrom, map, skip, Subject, tap } from "rxjs"; // 响应式编程库
import {
  useObservable, // 创建 Observable 的 Hook
  useObservableEagerState, // 立即获取 Observable 状态的 Hook
  useObservableState, // 订阅 Observable 状态的 Hook
  useSubscription, // 管理 Observable 订阅的 Hook
} from "observable-hooks"; // React 与 RxJS 的桥梁
import { createContext, Fragment, memo, useMemo, useState } from "react"; // React 核心API
import { identity } from "es-toolkit"; // 恒等函数，用于默认选择器
import { shallowEqual } from "../utils/equal"; // 浅比较函数，用于性能优化
import { inlineHook } from "./inlineHook";

// 创建 Symbol 常量，用于内部属性名，避免外部误用
const STATE = Symbol('state'); // 存储原始状态的 BehaviorSubject
const MERGE_STATE = Symbol('mergeState'); // 存储合并状态（原始状态 + 计算属性）的 BehaviorSubject
const ALIVE = Symbol('alive'); // 标识模型实例是否存活
const CHILDREN = Symbol('children'); // 存储子实例的映射
const CHILDREN_CHANGE = Symbol('childrenChange'); // 子实例变更通知器
const HOOK = Symbol('hook'); // 计算属性钩子函数
const SYNC = Symbol('sync'); // 同步计算属性钩子函数
const SET_STATE = Symbol('setState'); // 同步计算属性钩子函数

/**
 * 钩子函数 API 接口
 * 
 * 提供给模型钩子函数的参数，包含状态、状态更新方法、实例ID和实例引用
 * 
 * @template T - 状态类型
 */
export interface IHookApi<T extends object> {
  /**
   * 当前模型实例的状态
   */
  state: T;
  /**
   * 更新状态的方法
   * 
   * @param state - 部分状态对象或状态更新函数
   */
  setState: (state: Partial<T> | ((prevState: T) => Partial<T>)) => Promise<void>;
  /**
   * 模型实例的唯一标识符
   */
  id: string;
  /**
   * 当前模型实例的引用
   */
  thisInstance: ModelInstance<T, T>;
}

/**
 * 模型选项接口
 * 
 * 定义创建模型时的配置选项，包括初始化状态函数、钩子函数和可选名称
 * 
 * @template T - 状态类型
 * @template P - 初始化参数类型
 * @template R - 计算属性类型，默认为 T
 */
export interface IModelOption<
  T extends object,
  P extends object,
  R extends object = T
> {
  /**
   * 模型名称（可选）
   */
  name?: string;
  /**
   * 初始化状态函数
   * 
   * @param id - 实例ID
   * @param param - 初始化参数
   * @returns 初始状态
   */
  initState: (id: string, param: P) => T;
  /**
   * 计算属性钩子函数（可选）
   * 
   * @param params - 钩子函数 API
   * @returns 计算属性对象
   */
  hook?: (params: IHookApi<T>) => R;
}

/**
 * 模型接口
 * 
 * 定义模型的核心属性和方法，包括创建实例、获取实例和上下文提供者
 * 
 * @template T - 状态类型
 * @template P - 初始化参数类型
 * @template R - 计算属性类型，默认为 T
 */
export interface IModel<T extends object, P extends object, R extends object = T> {
  /**
   * 模型的唯一标识符
   */
  _id: string;
  /**
   * 模型名称（可选）
   */
  name?: string;
  /**
   * 创建模型实例
   * 
   * @param id - 实例ID
   * @param param - 初始化参数
   * @param parent - 父实例（可选）
   * @returns 模型实例
   */
  create(
    id: string,
    param: P,
    parent?: ModelInstance<any>
  ): ModelInstance<T, R>;
  /**
   * 模型实例的上下文提供者
   */
  Context: React.Context<ModelInstance<T, R>>;
  /**
   * 获取模型实例
   * 
   * @param id - 实例ID
   * @param parent - 父实例（可选）
   * @returns 模型实例或 undefined
   */
  get(
    id: string,
    parent?: ModelInstance<any>
  ): ModelInstance<T, R> | undefined;
}

/**
 * 模型实例构造参数接口
 * 
 * 定义创建模型实例时的构造参数，包括ID、初始状态、钩子函数、父实例和所属模型
 * 
 * @template T - 状态类型
 * @template R - 计算属性类型，默认为 T
 */
interface ModelInstanceOptions<T extends object, R extends object = T> {
  /**
   * 实例唯一标识符
   */
  id: string;
  /**
   * 初始状态
   */
  initialState: T;
  /**
   * 计算属性钩子函数（可选）
   */
  hook?: (params: IHookApi<T>) => R;
  /**
   * 父模型实例（可选）
   */
  parent?: ModelInstance<any>;
  /**
   * 所属模型定义（可选）
   */
  model?: IModel<T, any, R>;
}

/**
 * 模型实例类
 * 
 * 模型实例的核心实现，管理状态和子实例
 * 提供了状态管理、响应式订阅和生命周期管理功能
 * 
 * @template T - 状态类型
 * @template R - 计算属性类型，默认为 T
 */
class ModelInstance<T extends object, R extends object = T> {
  /**
   * 模型实例的唯一标识符
   */
  readonly id: string;

  /**
   * 模型实例是否存活
   */
  [ALIVE]: boolean;

  /**
   * 子实例映射，按模型类型分组
   */
  [CHILDREN]: Map<IModel<any, any>, ModelInstance<any, any>[]>;

  /**
   * 子实例变更通知器
   */
  [CHILDREN_CHANGE]: Subject<void>;

  /**
   * 计算属性钩子函数
   */
  [HOOK]?: (params: IHookApi<T>) => R;

  /**
   * 状态流，存储原始状态
   */
  [STATE]: BehaviorSubject<T>;

  /**
   * 合并状态流，存储原始状态和计算属性的合并结果
   */
  [MERGE_STATE]: BehaviorSubject<T & R>;

  /**
   * 父模型实例
   */
  parent?: ModelInstance<any>;

  /**
   * 所属模型定义
   */
  readonly model?: IModel<T, any, R>;

  /**
   * 实例初始化完成的 Promise
   */
  inited: Promise<boolean> | boolean;

  /**
   * 完成初始化的回调函数
   */
  toInit: CallableFunction;

  [SYNC]: Subject<void>

  /**
   * 构造函数
   * 
   * @param options - 构造函数参数对象
   */
  constructor(options: ModelInstanceOptions<T, R>) {
    const { id, initialState, hook, parent, model } = options;

    this.id = id;
    this[ALIVE] = true;
    this[CHILDREN] = new Map();
    this[CHILDREN_CHANGE] = new Subject<void>();
    this[HOOK] = hook;
    this[STATE] = new BehaviorSubject<T>(initialState);
    this[MERGE_STATE] = new BehaviorSubject<T & R>(initialState as T & R);
    this.parent = parent;
    this.model = model;
    this[SYNC] = new Subject<void>();

    // 创建初始化 Promise
    const a = Promise.withResolvers<boolean>();
    this.inited = a.promise;
    this.toInit = () => {
      a.resolve(true);
      this.inited = true;
    };
  }

  /**
   * 获取当前状态
   * 
   * @returns 当前状态值
   */
  getState(): T {
    return this[STATE].value;
  }

  /**
   * 更新状态
   * 
   * @param s - 部分状态对象或状态更新函数
   */
  [SET_STATE] = (s: Partial<T> | ((prevState: T) => Partial<T>)): Promise<void> => {
    if (this[ALIVE] === false) {
      const err = new Error(`Model instance ${this.id} is not alive anymore`)
      console.error(err);
      return Promise.reject(err);
    }

    // 处理函数式更新
    let nextState = typeof s === "function" ? s(this[STATE].value) : s;
    // 合并状态
    nextState = { ...this[STATE].value, ...nextState };

    const shouldUpdate = !shallowEqual(nextState, this[STATE].value);

    if (shouldUpdate) {
      // 发送状态变更通知
      this[STATE].next(nextState as T);
      return firstValueFrom(this[MERGE_STATE].pipe(skip(1), map(() => void 0)))
    }

    return Promise.resolve();
  }

  /**
   * 获取合并后的状态（原始状态 + 计算属性）
   * 
   * @returns 合并后的状态值
   */
  getHookState(): T & R {
    return this[MERGE_STATE].value;
  }

  /**
   * 响应式状态订阅 Hook
   * 
   * @template Ret - 选择器返回类型，默认为 T & R
   * @param selector - 状态选择器函数（可选）
   * @returns 选择后的状态值
   */
  useState<Ret = T & R>(selector?: (state: T & R) => Ret): Ret {

    if (this.inited !== true) {
      throw this.inited
    }

    // 使用恒等函数作为默认选择器
    const finalSelector = selector || identity as (state: T & R) => Ret;

    // 初始化状态
    const [v, set] = useState<Ret>(() => finalSelector(this[MERGE_STATE].value));

    // 订阅状态变更
    useSubscription(
      useObservable(() =>
        this[MERGE_STATE].pipe(
          skip(1), // 跳过初始值
          map(finalSelector), // 应用选择器
          tap((s) => {
            // 仅当状态变更时更新
            !shallowEqual(s, v) && set(s);
          })
        )
      )
    );

    return v;
  }

  /**
   * 获取指定模型的子实例
   * 
   * @template T1 - 子实例状态类型
   * @template P1 - 子实例参数类型
   * @template R1 - 子实例计算属性类型
   * @param model - 模型定义
   * @returns 子实例数组
   */
  getChildren<T1 extends object, P1 extends object, R1 extends object = T1>(
    model: IModel<T1, P1, R1>
  ): ModelInstance<T1, R1>[] {
    return this[CHILDREN].get(model) as ModelInstance<T1, R1>[] || [];
  }

  /**
   * 响应式获取指定模型的子实例
   * 
   * @template T1 - 子实例状态类型
   * @template P1 - 子实例参数类型
   * @template R1 - 子实例计算属性类型
   * @param model - 模型定义
   * @returns 子实例数组
   */
  useChildren<T1 extends object, P1 extends object, R1 extends object = T1>(
    model: IModel<T1, P1, R1>
  ): ModelInstance<T1, R1>[] {
    // 订阅子实例变更
    useObservableState(this[CHILDREN_CHANGE]);
    return this[CHILDREN].get(model) as ModelInstance<T1, R1>[] || [];
  }

  /**
   * 移除指定模型的指定子实例
   * 
   * @param model - 模型定义
   * @param id - 子实例ID
   */
  removeChildren(model: IModel<any, any, any>, id: string): void {
    const children = this[CHILDREN].get(model) || [];
    const childIndex = children.findIndex((child) => child.id === id);
    if (childIndex !== -1) {
      // 发送子实例变更通知
      children[childIndex].parent = undefined;
      children[childIndex].destroy();
      children.splice(childIndex, 1);
      this[CHILDREN_CHANGE].next();
    }
  }


  /**
   * 更新合并状态
   * 
   * @param newMergeState - 新的合并状态
   */
  updateMergeState(newMergeState: T & R): void {
    this[MERGE_STATE].next(newMergeState);
  }

  /**
   * 销毁模型实例
   * 
   * 递归销毁所有子实例，清理资源，并从父实例中移除
   */
  async destroy() {
    if (this[ALIVE] === false) {
      return;
    }
    // 递归销毁所有子实例
    this[CHILDREN].forEach((childrenType) => {
      childrenType.forEach((child) => child.destroy());
    });

    // 清理资源
    this[CHILDREN].clear();
    this[CHILDREN_CHANGE].next();
    this[CHILDREN_CHANGE].complete();
    this[STATE].complete();
    this[MERGE_STATE].complete();

    this[ALIVE] = false;

    // 从父实例中移除
    if (this.parent && this.model) {
      this.parent.removeChildren(this.model, this.id);
      this.parent = undefined;
    }
  }
}

/**
 * 根模型实例
 * 
 * 所有模型实例的根节点，用于管理整个模型树
 */
function createRootInstance() {
  const root = new ModelInstance<any, any>({
    id: "root", // 根实例ID
    initialState: {}, // 初始状态为空对象
    hook: undefined, // 无计算属性钩子
    parent: undefined, // 无父实例
    model: undefined // 无所属模型
  });

  // 覆盖默认的 alive 状态为 false，初始时未激活
  root[ALIVE] = false;
  return root;
}
let rootModelInstance = createRootInstance();

// 覆盖默认的 alive 状态为 false，初始时未激活
rootModelInstance[ALIVE] = false;

// 空上下文，用于没有模型上下文的情况
const emptyContext = createContext({} as any);

/**
 * LogicTree 组件
 * 
 * 递归渲染模型实例树，处理计算属性和子实例管理
 * 使用 memo 优化渲染性能
 */
const LogicTree = memo(({ node }: { node: ModelInstance<any> }) => {
  // 订阅子实例变更
  useObservableState(node[CHILDREN_CHANGE]);
  // 获取当前状态
  const state = useObservableEagerState(node[STATE]);

  // 执行计算属性钩子
  const ret = node[HOOK]?.({ state, setState: node[SET_STATE], id: node.id, thisInstance: node });

  // 合并状态和计算属性，仅当变更时更新
  useMemo(() => {
    const nextMergeState = { ...node.getState(), ...ret };
    if (!shallowEqual(nextMergeState, node.getHookState())) {
      node.updateMergeState(nextMergeState);
    }

    // 标记实例初始化完成
    node.toInit(true);
    node[SYNC].next();
  }, [node, state, ret]); // 依赖项：node, state, ret

  // 获取所有子实例
  const items = [...node[CHILDREN].entries()];

  const Context = node.model?.Context || emptyContext;

  // 递归渲染子实例
  return (
    <Context.Provider value={node}>
      {items.map(([model, children]) =>
        inlineHook(model._id, () => {

          const childrenNodes = useMemo(() =>
            <>
              {children.map((child) => (
                <LogicTree key={child.id} node={child} />
              ))}
            </>
            , [children.length]);

          return childrenNodes;
        })
      )}
    </Context.Provider>
  );
});

/**
 * 根容器引用
 * 
 * 用于挂载和卸载 LogicTree 组件
 */
let rootContainer: Root | null = null;

/**
 * 确保 LogicTree 组件已挂载
 * 
 * 首次调用时创建根容器并渲染 LogicTree
 */
function ensureLogicTreeMounted() {
  // 如果根实例已经激活，直接返回
  if (rootModelInstance[ALIVE]) {
    return;
  }

  // 激活根实例
  rootModelInstance[ALIVE] = true;

  // 卸载旧容器（如果存在）
  rootContainer?.unmount();
  // 创建新的根容器并渲染 LogicTree
  rootContainer = createRoot(document.createElement("div"));
  rootContainer.render(<LogicTree node={rootModelInstance} />);
}

/**
 * 销毁所有模型实例
 * 
 * 用于清理所有模型实例和资源
 */
export function destroyAll() {
  // 销毁根实例（会递归销毁所有子实例）
  rootModelInstance.destroy();
  // 卸载根容器
  rootContainer?.unmount();
  // 重新创建根实例
  rootModelInstance = createRootInstance();
}

/**
 * 创建模型定义
 * 
 * @template T - 状态类型
 * @template P - 初始化参数类型
 * @template R - 计算属性类型
 * @param option - 模型选项
 * @returns 模型定义对象
 */
export default function createModel<
  T extends object,
  P extends object,
  R extends object
>(option: IModelOption<T, P, R>): IModel<T, P, R> {
  // 确保 LogicTree 已挂载
  ensureLogicTreeMounted();

  // 解构模型选项
  const { initState, hook, name } = option;

  // 创建模型上下文
  const Context = createContext<ModelInstance<T, R>>(null as unknown as ModelInstance<T, R>);

  // 生成唯一模型ID
  const id = Math.random().toString(36).substring(2);

  // 创建模型定义
  const model: IModel<T, P, R> = {
    // 模型唯一标识符
    _id: id,
    // 模型名称（可选）
    name,
    // 模型上下文
    Context: Context,

    /**
     * 创建模型实例
     * 
     * @param id - 实例ID
     * @param param - 初始化参数
     * @param parent - 父实例（可选）
     * @returns 模型实例
     */
    create(id: string, param: P, parent?: ModelInstance<any>) {
      // 默认使用根实例作为父实例
      if (!parent) {
        parent = rootModelInstance;
      }

      if (!parent[ALIVE]) {
        throw new Error(`create fail, Parent model instance with id ${parent.id} is not alive anymore`);
      }
      // 检查是否已存在相同ID的实例
      const exist = parent.getChildren(model).find((child: ModelInstance<any>) => child.id === id);
      if (exist) {
        console.warn(`Model instance with id ${id} already exists`);
        return exist as ModelInstance<T, R>;
      }

      try {
        // 初始化状态
        const initialState = initState(id, param);

        // 创建模型实例
        const instance = new ModelInstance<T, R>({
          id,
          initialState,
          hook,
          parent,
          model
        });

        // 将实例添加到父实例的子列表中
        const children = parent[CHILDREN].get(model) || [];
        children.push(instance);
        parent[CHILDREN].set(model, children);
        parent[CHILDREN_CHANGE].next();

        return instance;
      } catch (error) {
        // 错误处理
        console.error(`Failed to create model instance for id ${id}:`, error);
        throw error;
      }
    },

    /**
     * 获取模型实例
     * 
     * @param id - 实例ID
     * @param parent - 父实例（可选）
     * @returns 模型实例或 undefined
     */
    get(id: string, parent?: ModelInstance<any>) {
      // 默认使用根实例作为父实例
      parent = parent || rootModelInstance;

      // 获取指定模型的所有子实例
      const children = parent.getChildren(model);

      // 查找指定ID的实例
      return children.find((child: ModelInstance<any>) => child.id === id);
    },
  };

  // 冻结模型定义，防止修改
  Object.freeze(model);

  return model;
}
