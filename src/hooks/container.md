# Container 容器 Hook 文档

## 概述

`container.tsx` 是一个轻量级的 React 状态容器实现，基于 React Context 和 RxJS BehaviorSubject，提供了一种在组件树中共享和订阅状态的优雅方式。

**核心功能**：
- 创建可共享状态的容器
- 提供 Provider 组件用于状态注入
- 提供 useContainer Hook 用于状态订阅
- 支持状态选择器和自定义比较函数
- 性能优化：使用 memo 和批量更新

## API 文档

### createContainer 函数

**功能**：创建一个状态容器，返回 Provider 组件和 useContainer Hook。

**签名**：
```typescript
export function createContainer<Value, State = void>(
  useHook: (initialState?: State) => Value,
): Container<Value, State>
```

**参数**：
- `useHook`：一个自定义 Hook，用于初始化和管理状态，接收可选的 `initialState` 参数并返回状态值。

**返回值**：
- `Container<Value, State>` 对象，包含：
  - `Provider`：用于注入状态的 React 组件
  - `useContainer`：用于订阅状态的 Hook

### Container 接口

```typescript
export interface Container<Value, State = void> {
  Provider: React.ComponentType<ContainerProviderProps<State>>;
  useContainer: <R = Value>(
    selector?: (s: Value) => R,
    eqFn?: (a: R, b: R) => boolean
  ) => [R, MutableRefObject<Value>];
}
```

### Provider 组件

**功能**：将状态注入到组件树中，使子组件可以通过 useContainer Hook 访问状态。

**Props**：
```typescript
export interface ContainerProviderProps<State = void> {
  initialState?: State;
  memoChildren?: boolean;
  children: React.ReactNode;
}
```

**参数**：
- `initialState`：传递给 useHook 的初始状态参数（可选）
- `memoChildren`：是否对 children 进行记忆化优化（可选）
- `children`：子组件

### useContainer Hook

**功能**：在组件中订阅容器状态，返回选择后的状态和最新状态的 ref。

**签名**：
```typescript
function useContainer<R = Value>(
  selector: (s: Value) => R = identity,
  eqFn: (a: R, b: R) => boolean = shallowEqual
): [R, MutableRefObject<Value>]
```

**参数**：
- `selector`：状态选择器函数，用于从完整状态中提取需要的部分（默认返回完整状态）
- `eqFn`：比较函数，用于判断状态是否变化（默认使用浅比较）

**返回值**：
- 一个数组，包含：
  - 选择后的状态值
  - 指向最新完整状态的 MutableRefObject

## 实现原理

### 核心实现

1. **状态管理**：使用 RxJS BehaviorSubject 存储和发布状态变化
2. **Context 注入**：使用 React Context 将 BehaviorSubject 注入到组件树
3. **性能优化**：
   - 使用 `React.memo` 优化 Provider 组件
   - 使用 `useLayoutEffect` 和 `unstable_batchedUpdates` 批量更新状态
   - 使用 `useMemo` 优化 children 渲染
4. **状态订阅**：在 useContainer Hook 中订阅 BehaviorSubject，实现响应式状态更新

### 关键代码解析

#### 1. 创建容器

```typescript
export function createContainer<Value, State = void>(
  useHook: (initialState?: State) => Value,
): Container<Value, State> {
  let Context = createContext<BehaviorSubject<Value>>(EMPTY as any);
  
  // 创建 Provider 组件
  const Provider = memo((props: ContainerProviderProps<State>) => {
    let value = useHook(props.initialState);
    const [valueSubject] = useState(() => new BehaviorSubject(value));
    
    // 状态更新时批量发布
    useLayoutEffect(() => {
      if (valueSubject.value !== value) {
        unstable_batchedUpdates(() => {
          valueSubject.next(value);
        })
      }
    }, [value]);
    
    // 优化 children 渲染
    const children = useMemo(() => {
      return props.children;
    }, [props.memoChildren]);
    
    return <Context.Provider value={valueSubject}>{props.memoChildren ? children : props.children}</Context.Provider>;
  })
  
  // 创建 useContainer Hook
  function useContainer<R = Value>(
    selector: (s: Value) => R = identity,
    eqFn: (a: R, b: R) => boolean = shallowEqual
  ): [R, MutableRefObject<Value>] {
    // ... 实现细节
  }
  
  return { Provider, useContainer };
}
```

#### 2. 状态订阅实现

```typescript
function useContainer<R = Value>(
  selector: (s: Value) => R = identity,
  eqFn: (a: R, b: R) => boolean = shallowEqual
): [R, MutableRefObject<Value>] {
  let valueSubject = useContext(Context);
  
  // 检查是否在 Provider 内部
  if (valueSubject === EMPTY) {
    throw new Error('Component must be wrapped with <Container.Provider>');
  }
  
  // 存储最新状态和选择后状态的 ref
  const latestAll = useRef<Value>(valueSubject.value);
  const [selected, setSelected] = useState(() => selector(valueSubject.value));
  const latestSelected = useRef(selected);
  latestSelected.current = selected;
  
  // 订阅状态变化
  useEffect(() => {
    const subp = valueSubject.subscribe(e => {
      const newSelected = selector(e);
      if (e === latestAll.current) {
        return;
      }
      latestAll.current = e;
      if (!eqFn(latestSelected.current, newSelected)) {
        setSelected(newSelected);
      }
    });
    return () => subp.unsubscribe()
  }, [valueSubject])
  
  return [selected, latestAll];
}
```

## 使用示例

### 基本用法

#### 1. 创建容器

```typescript
// 创建一个计数器容器
import { createContainer } from './container';

function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  
  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);
  
  return { count, increment, decrement, reset };
}

export const CounterContainer = createContainer(useCounter);
```

#### 2. 使用 Provider

```tsx
// App.tsx
import { CounterContainer } from './counter-container';

function App() {
  return (
    <CounterContainer.Provider initialState={10}>
      <div>
        <h1>Counter App</h1>
        <CounterDisplay />
        <CounterControls />
      </div>
    </CounterContainer.Provider>
  );
}
```

#### 3. 使用 useContainer Hook

```tsx
// CounterDisplay.tsx
import { CounterContainer } from './counter-container';

function CounterDisplay() {
  const [count] = CounterContainer.useContainer(state => state.count);
  
  return <div>Current count: {count}</div>;
}

// CounterControls.tsx
import { CounterContainer } from './counter-container';

function CounterControls() {
  const [, counterRef] = CounterContainer.useContainer();
  
  const handleIncrement = () => {
    counterRef.current.increment();
  };
  
  const handleDecrement = () => {
    counterRef.current.decrement();
  };
  
  const handleReset = () => {
    counterRef.current.reset();
  };
  
  return (
    <div>
      <button onClick={handleIncrement}>Increment</button>
      <button onClick={handleDecrement}>Decrement</button>
      <button onClick={handleReset}>Reset</button>
    </div>
  );
}
```

### 高级用法

#### 1. 自定义比较函数

```tsx
import { CounterContainer } from './counter-container';

function CounterDisplay() {
  // 使用自定义比较函数，只在 count 为偶数时更新
  const [count] = CounterContainer.useContainer(
    state => state.count,
    (prev, next) => prev % 2 === next % 2
  );
  
  return <div>Current even count: {count}</div>;
}
```

#### 2. 复杂状态管理

```typescript
// 创建一个用户状态容器
function useUserState(initialUser = null) {
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const userData = await api.login(credentials);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const logout = () => {
    setUser(null);
  };
  
  return { user, loading, error, login, logout };
}

export const UserContainer = createContainer(useUserState);
```

## 性能优化

### 1. 状态选择器

使用状态选择器只订阅需要的状态部分，避免不必要的重新渲染：

```tsx
// 好的做法：只订阅需要的状态
const [user] = UserContainer.useContainer(state => state.user);

// 不好的做法：订阅完整状态
const [state] = UserContainer.useContainer();
const user = state.user;
```

### 2. 自定义比较函数

对于复杂对象，使用自定义比较函数可以更精确地控制更新时机：

```tsx
// 使用深比较
import { isEqual } from 'lodash-es';

const [user] = UserContainer.useContainer(
  state => state.user,
  isEqual
);
```

### 3. memoChildren 属性

在 Provider 组件中使用 `memoChildren` 属性可以优化 children 的渲染：

```tsx
<UserContainer.Provider initialState={null} memoChildren>
  {/* 子组件会被 useMemo 优化 */}
  <AppContent />
</UserContainer.Provider>
```

## 注意事项

1. **Provider 嵌套**：多个容器的 Provider 可以嵌套使用，互不影响
2. **状态隔离**：每个容器实例是独立的，拥有自己的状态
3. **内存泄漏**：useContainer Hook 会自动清理订阅，无需手动处理
4. **错误处理**：如果在 Provider 外部使用 useContainer，会抛出错误
5. **初始状态**：initialState 只在 Provider 首次渲染时使用

## 适用场景

- **跨组件状态共享**：替代 props  drilling
- **全局状态管理**：轻量级替代 Redux、Zustand 等
- **复杂状态逻辑**：将状态逻辑封装在自定义 Hook 中
- **响应式状态**：需要订阅状态变化的场景

## 与其他状态管理方案的对比

| 方案 | 优势 | 劣势 |
|------|------|------|
| Container Hook | 轻量、简单、基于 React 原生 API | 功能相对简单，不支持中间件 |
| Redux | 功能强大、生态丰富、支持中间件 | 配置复杂、样板代码多 |
| Zustand | 轻量、简单、支持中间件 | 依赖外部库 |
| Context API | 原生支持、简单 | 性能问题（频繁更新） |

## 代码优化建议

### 1. 类型安全增强

可以进一步增强 TypeScript 类型安全，例如：

```typescript
// 改进后的类型定义
interface Container<Value, State = void> {
  Provider: React.ComponentType<ContainerProviderProps<State>>;
  useContainer: <R = Value>(
    selector?: (s: Value) => R,
    eqFn?: (a: R, b: R) => boolean
  ) => [R, React.MutableRefObject<Value>];
}
```

### 2. 错误处理改进

可以添加更详细的错误信息：

```typescript
// @ts-ignore
if (valueSubject === EMPTY) {
  throw new Error(
    'Component must be wrapped with <Container.Provider>. ' +
    'Make sure your component is inside the provider hierarchy.'
  );
}
```

### 3. 测试覆盖

建议添加单元测试，测试以下场景：
- 基本状态更新
- 选择器功能
- 自定义比较函数
- 错误处理
- 性能优化（避免不必要的渲染）

## 总结

`container.tsx` 提供了一种轻量级、优雅的状态管理方案，结合了 React Context 的简单性和 RxJS 的响应式能力，适用于大多数中小型应用的状态管理需求。

**核心优势**：
- 简单易用：API 设计简洁明了
- 性能优化：内置多种性能优化措施
- 灵活性：支持自定义 Hook 和状态逻辑
- 类型安全：完整的 TypeScript 类型支持
- 轻量：无额外依赖（除了 React 和 RxJS）

通过合理使用 Container Hook，可以显著简化 React 应用的状态管理，提高代码可维护性和性能。