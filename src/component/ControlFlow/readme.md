# ControlFlow 组件库文档

## 概述

`ControlFlow` 是一个轻量级的 React 控制流组件库，提供了简洁的声明式语法来处理常见的条件渲染和列表渲染场景。该库位于 `/src/component/ControlFlow/index.tsx` 文件中，包含三个核心组件：`IfThen`、`SwitchCase` 和 `ForList`。

## 组件列表

| 组件名 | 描述 | 适用场景 |
|-------|------|---------|
| `IfThen` | 条件渲染组件 | 基于单一条件的渲染逻辑 |
| `SwitchCase` | 多条件分支组件 | 基于多个条件的分支渲染 |
| `ForList` | 列表渲染组件 | 遍历数组并渲染列表项 |

## 组件详情

### 1. IfThen 组件

**功能**：根据条件渲染不同的内容。

**API**：
```tsx
interface IfThenProps {
  condition?: boolean;
  then: ReactElement | (() => ReactElement);
  else?: ReactElement | (() => ReactElement);
}

export const IfThen: FC<IfThenProps> = (props) => {
  // 实现逻辑
};
```

**参数说明**：
- `condition`：布尔值，决定是否渲染 `then` 内容
- `then`：当条件为真时渲染的内容，可以是 React 元素或返回 React 元素的函数
- `else`：当条件为假时渲染的内容，可选，同样可以是 React 元素或函数

**使用示例**：
```tsx
// 基本用法
<IfThen 
  condition={isLoggedIn} 
  then={<WelcomeMessage />} 
  else={<LoginPrompt />} 
/>

// 使用函数形式（延迟渲染）
<IfThen 
  condition={isLoading} 
  then={() => <LoadingSpinner />} 
  else={() => <Content />} 
/>
```

### 2. SwitchCase 组件

**功能**：根据多个条件分支渲染不同的内容。

**API**：
```tsx
interface SwitchCaseProps {
  conditions: [
    boolean | (() => boolean),
    ReactElement | (() => ReactElement),
  ][];
}

export const SwitchCase: FC<SwitchCaseProps> = (props) => {
  // 实现逻辑
};
```

**参数说明**：
- `conditions`：二维数组，每个元素是一个包含条件和对应渲染内容的元组
  - 第一个元素：条件，可以是布尔值或返回布尔值的函数
  - 第二个元素：当条件为真时渲染的内容，可以是 React 元素或返回 React 元素的函数

**使用示例**：
```tsx
<SwitchCase 
  conditions={[
    [status === 'loading', <LoadingSpinner />],
    [status === 'error', <ErrorMessage />],
    [status === 'success', () => <SuccessMessage data={data} />],
    [() => data.length === 0, <EmptyState />],
  ]} 
/>
```

### 3. ForList 组件

**功能**：遍历数组并渲染列表项，自动处理 key 属性。

**API**：
```tsx
interface ForListProps<T> {
  list: T[];
  getKey?: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactElement;
}

export const ForList = <T,>(props: ForListProps<T>) => {
  // 实现逻辑
};
```

**参数说明**：
- `list`：要遍历的数组
- `getKey`：可选，生成 key 的函数，接收当前项和索引作为参数
- `renderItem`：渲染单个列表项的函数，接收当前项和索引作为参数，返回 React 元素

**使用示例**：
```tsx
// 基本用法
<ForList 
  list={todos} 
  renderItem={(todo) => (
    <TodoItem key={todo.id} todo={todo} />
  )} 
/>

// 自定义 key 生成
<ForList 
  list={users} 
  getKey={(user) => user.id}
  renderItem={(user, index) => (
    <UserCard user={user} index={index} />
  )} 
/>
```

## 技术实现细节

### 1. 延迟渲染优化

所有组件都支持函数形式的渲染内容，这允许在条件不满足时避免不必要的组件实例化和渲染：

```tsx
// 优化前：无论条件如何，都会创建 HeavyComponent 实例
<IfThen 
  condition={showHeavyComponent} 
  then={<HeavyComponent />} 
/>

// 优化后：只有当条件为真时，才会创建 HeavyComponent 实例
<IfThen 
  condition={showHeavyComponent} 
  then={() => <HeavyComponent />} 
/>
```

### 2. 类型安全

组件使用 TypeScript 泛型和接口定义，确保类型安全：

- `IfThen` 和 `SwitchCase` 组件接受 React 元素或返回 React 元素的函数
- `ForList` 组件使用泛型 `<T>` 来表示列表项的类型，提供更好的类型推断

### 3. 性能考虑

- **避免不必要的渲染**：使用函数形式的渲染内容可以延迟组件的创建
- **key 属性处理**：`ForList` 组件自动处理 key 属性，确保列表渲染的性能和稳定性
- **简洁的实现**：组件实现简洁高效，没有引入额外的性能开销

## 代码结构

```typescript
import { isFunction } from "lodash-es";
import React, { FC, ReactElement } from "react";

// IfThen 组件
export const IfThen = (props: {
  condition?: boolean;
  then: ReactElement | (() => ReactElement);
  else?: ReactElement | (() => ReactElement);
}) => {
  if (props.condition) {
    return isFunction(props.then) ? props.then() : props.then;
  }
  return isFunction(props.else) ? props.else() : (props.else ?? null);
};

// SwitchCase 组件
export const SwitchCase = (props: {
  conditions: [
    boolean | (() => boolean),
    ReactElement | (() => ReactElement),
  ][];
}) => {
  const { conditions } = props;
  for (const item of conditions) {
    const [condition, then] = item;
    if (isFunction(condition) ? condition() : condition) {
      return isFunction(then) ? then() : then;
    }
  }
  return null;
};

// ForList 组件
export const ForList = <T,>(props: {
  list: T[];
  getKey?: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactElement;
}) => {
  const { list, getKey, renderItem } = props;

  return (
    <>
      {list.map((item, index) =>
        React.cloneElement(renderItem(item, index), {
          key: getKey ? getKey(item, index) : index,
        }),
      )}
    </>
  );
};
```

## 最佳实践

1. **使用函数形式的渲染内容**：对于复杂或重型组件，使用函数形式可以避免不必要的渲染
2. **为 ForList 提供 getKey 函数**：使用唯一 ID 作为 key 可以提高列表渲染的性能和稳定性
3. **合理组织条件**：在 SwitchCase 中，将最可能匹配的条件放在前面，提高执行效率
4. **保持渲染逻辑简洁**：控制流组件内部的渲染逻辑应该简洁明了，复杂逻辑应该提取到组件外部

## 总结

`ControlFlow` 组件库提供了一套简洁、高效的控制流组件，使 React 中的条件渲染和列表渲染更加声明式和易读。这些组件：

- 简化了复杂的条件逻辑
- 提供了类型安全的 API
- 支持延迟渲染优化
- 保持了代码的可读性和可维护性

通过使用这些组件，您可以编写更加清晰、简洁的 React 代码，减少模板代码的冗余，提高开发效率。