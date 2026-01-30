import { useMount } from "react-use";
import createModel from "../hooks/rstate";
import { useState, memo, useContext } from "react";
import { useForceUpdate } from "observable-hooks";

// 定义 Todo 初始化参数类型
interface TodoParams {
  title: string;
  completed?: boolean;
  dueDate?: string;
}

// 创建 Todo 模型
const TodoModel = createModel({
  name: "Todo",
  // 初始化状态
  initState: (id, params: TodoParams) => {
    return {
      id,
      title: params.title,
      completed: params.completed || false,
      dueDate: params.dueDate,
    };
  },
  // 计算属性钩子
  hook: (api) => {
    const { state } = api;
    const todoListIns = useContext(TodoListModel.Context);

    // 计算截止时间状态
    const getDueDateStatus = () => {
      if (!state.dueDate) return "No Due Date";
      
      const now = new Date();
      const dueDate = new Date(state.dueDate);
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffTime < 0) return "Overdue";
      if (diffDays === 0) return "Due Today";
      if (diffDays === 1) return "Due Tomorrow";
      if (diffDays <= 3) return "Due Soon";
      return `Due in ${diffDays} days`;
    };

    return {
      toggleComplete: async () => {
        await api.setState((prev) => ({ completed: !prev.completed }));
        todoListIns.getHookState().refreshList();
      },
      status: state.completed ? "Completed" : "Pending",
      dueDateStatus: getDueDateStatus(),
    };
  },
});

// 定义 TodoList 初始化参数类型
interface TodoListParams {
  initialTodos?: { title: string; completed?: boolean }[];
}

// 创建 TodoList 模型
const TodoListModel = createModel({
  name: "TodoList",
  // 初始化状态
  initState: (id, params: TodoListParams) => {
    return {
      params: params || [],
    };
  },
  // 计算属性钩子
  hook: (api) => {
    const { state, thisInstance } = api;

    useMount(() => {
      state.params.initialTodos?.forEach((todo) => {
        const todoId = `todo-${Math.random().toString(36).substring(2)}`;
        console.log("init create todo", todoId);
        TodoModel.create(
          todoId,
          { title: todo.title, completed: todo.completed },
          thisInstance,
        );
      });
    });

    // 获取所有 todo 实例
    const todoInstances = thisInstance.getChildren(TodoModel);

    const update = useForceUpdate();

    return {
      refreshList: update,
      totalCount: todoInstances.length,
      completedCount: todoInstances.filter((todo) => todo.getState().completed)
        .length,
      pendingCount: todoInstances.filter((todo) => !todo.getState().completed)
        .length,
    };
  },
});

// Todo 项组件
const TodoItem = memo(function TodoItem({
  todoInstance,
}: {
  todoInstance: ReturnType<typeof TodoModel.create>;
}) {
  // 使用状态选择器获取需要的状态
  const title = todoInstance.useState((state) => state.title);
  const completed = todoInstance.useState((state) => state.completed);
  const status = todoInstance.useState((state) => state.status);
  const dueDate = todoInstance.useState((state) => state.dueDate);
  const dueDateStatus = todoInstance.useState((state) => state.dueDateStatus);
  // 切换完成状态
  const toggleComplete = todoInstance.useState((state) => state.toggleComplete);

  console.log({ toggleComplete, title, completed, status, dueDate, dueDateStatus });

  return (
    <li
      style={{
        margin: "8px 0",
        padding: "8px",
        border: "1px solid #ddd",
        borderRadius: "4px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={completed}
            onChange={() => toggleComplete()}
            style={{ marginRight: "8px" }}
          />
          <span
            style={{
              textDecoration: completed ? "line-through" : "none",
              opacity: completed ? 0.6 : 1,
            }}
          >
            {title}
          </span>
        </div>
        <span style={{ fontSize: "12px", color: "#666" }}>{status}</span>
      </div>
      {dueDate && (
        <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
          Due: {new Date(dueDate).toLocaleString()} | 
          <span style={{ color: dueDateStatus === "Overdue" ? "#ff0000" : "#999" }}>
            {dueDateStatus}
          </span>
        </div>
      )}
      {!dueDate && (
        <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
          No due date
        </div>
      )}
    </li>
  );
});

TodoItem.displayName = "TodoItem";

// Todo 列表组件
const TodoList = memo(function TodoList({
  listInstance,
}: {
  listInstance: ReturnType<typeof TodoListModel.create>;
}) {
  // 使用状态选择器获取计算属性
  const totalCount = listInstance.useState((state) => state.totalCount);
  const completedCount = listInstance.useState((state) => state.completedCount);
  const pendingCount = listInstance.useState((state) => state.pendingCount);

  // 响应式获取子实例
  const todoInstances = listInstance.useChildren(TodoModel);

  return (
    <div>
      <h2>Todo List</h2>
      <div style={{ marginBottom: "16px", fontSize: "14px", color: "#666" }}>
        Total: {totalCount} | Completed: {completedCount} | Pending:{" "}
        {pendingCount}
      </div>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {todoInstances.map((todo) => (
          <TodoItem key={todo.id} todoInstance={todo} />
        ))}
      </ul>
    </div>
  );
});

TodoList.displayName = "TodoList";

const todoListInstance = TodoListModel.create("todo-list-1", {
  initialTodos: [
    { title: "Learn React" },
    { title: "Build Todo App", completed: true },
    { title: "Explore RState" },
  ],
});

// 主应用组件
export default function App() {
  // 本地状态用于输入
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDueDate, setNewTodoDueDate] = useState("");

  // 添加新 Todo
  const addTodo = () => {
    if (newTodoTitle.trim()) {
      // 生成唯一 ID
      const todoId = `todo-${Date.now()}`;

      // 创建 Todo 实例（作为 TodoList 的子实例）
      TodoModel.create(todoId, { title: newTodoTitle, dueDate: newTodoDueDate }, todoListInstance);

      // 清空输入
      setNewTodoTitle("");
      setNewTodoDueDate("");
    }
  };

  // 清除所有已完成的 Todo
  const clearCompleted = () => {
    const todoInstances = todoListInstance.getChildren(TodoModel);
    todoInstances.forEach((todo) => {
      if (todo.getState().completed) {
        todo.destroy();
      }
    });
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h1>RState Todo List Example</h1>

      {/* 添加 Todo 表单 */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", marginBottom: "8px" }}>
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="Enter a new todo..."
            style={{ flex: 1, padding: "8px", fontSize: "16px" }}
          />
          <input
            type="datetime-local"
            value={newTodoDueDate}
            onChange={(e) => setNewTodoDueDate(e.target.value)}
            style={{ marginLeft: "8px", padding: "8px", fontSize: "16px" }}
          />
        </div>
        <button
          onClick={addTodo}
          style={{ padding: "8px 16px", fontSize: "16px" }}
        >
          Add Todo
        </button>
      </div>

      {/* Todo 列表 */}
      <TodoList listInstance={todoListInstance} />

      {/* 操作按钮 */}
      <div style={{ marginTop: "20px" }}>
        <button
          onClick={clearCompleted}
          style={{ padding: "8px 16px", fontSize: "16px" }}
        >
          Clear Completed
        </button>
      </div>
    </div>
  );
}
