import { inlineHook } from "../hooks/inlineHook";
import createModel from "../hooks/rstate";
import { useContext, useState } from "react";

// 任务状态类型
type TaskStatus = "todo" | "inProgress" | "completed";

// 任务优先级类型
type TaskPriority = "low" | "medium" | "high";

// 任务模型
const TaskModel = createModel({
  initState(id, param: { title: string; description: string; priority: TaskPriority; parentId?: string }) {
    return {
      id,
      title: param.title,
      description: param.description,
      status: "todo" as TaskStatus,
      priority: param.priority,
      createdAt: new Date().toISOString(),
      completedAt: null as string | null,
      parentId: param.parentId,
      subtaskIds: [] as string[],
    };
  },
  hook({ state, setState, id }) {

    const projectIns = useContext(ProjectModel.Context);

    return {
      // 更新任务状态
      setStatus: async (status: TaskStatus) => {
        await setState({
          status,
          completedAt: status === "completed" ? new Date().toISOString() : null
        });

        projectIns.getHookState().forceUpdate()
      },

      // 更新任务标题
      updateTitle: (title: string) => {
        setState({ title });
      },

      // 更新任务描述
      updateDescription: (description: string) => {
        setState({ description });
      },

      // 计算属性：任务是否已完成
      isCompleted: state.status === "completed",

      // 计算属性：任务创建时间（格式化）
      formattedCreatedAt: new Date(state.createdAt).toLocaleString(),
    };
  },
});

// 项目模型
const ProjectModel = createModel({
  initState(id, param: { name: string; description: string }) {
    return {
      id,
      name: param.name,
      description: param.description,
      taskIds: [] as string[],
      createdAt: new Date().toISOString(),
      refresh: 1
    };
  },
  hook({ state, setState, id, thisInstance }) {
    // 获取项目下的所有任务实例
    const tasks = thisInstance.useChildren(TaskModel);

    // 计算项目完成率
    const completionRate = tasks.length > 0
      ? tasks.filter(task => task.getHookState().isCompleted).length / tasks.length
      : 0;

    // 计算项目统计信息
    const stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(task => task.getHookState().isCompleted).length,
      inProgressTasks: tasks.filter(task => task.getHookState().status === "inProgress").length,
      todoTasks: tasks.filter(task => task.getHookState().status === "todo").length,
      highPriorityTasks: tasks.filter(task => task.getState().priority === "high").length,
    };

    return {
      forceUpdate() {
        setState(s => ({
          refresh: s.refresh + 1
        }))
      },
      // 添加任务
      addTask: async (title: string, description: string, priority: TaskPriority) => {
        // 模拟异步操作
        await new Promise(resolve => setTimeout(resolve, 300));

        const taskId = `task-${Date.now()}`;
        const task = TaskModel.create(taskId, {
          title,
          description,
          priority,
        }, thisInstance);

        setState({ taskIds: [...state.taskIds, taskId] });
        return task;
      },

      // 移除任务
      removeTask: (taskId: string) => {
        setState({ taskIds: state.taskIds.filter(id => id !== taskId) });
        const task = TaskModel.get(taskId, thisInstance);
        if (task) {
          // 递归删除子任务
          task.getState().subtaskIds.forEach(subtaskId => {
            const subtask = TaskModel.get(subtaskId);
            if (subtask) subtask.destroy();
          });
          task.destroy();
        }
      },

      // 更新项目信息
      updateProject: (name: string, description: string) => {
        setState({ name, description });
      },

      // 计算属性：项目完成率
      completionRate,

      // 计算属性：项目统计信息
      stats,

      // 计算属性：项目创建时间（格式化）
      formattedCreatedAt: new Date(state.createdAt).toLocaleString(),
    };
  },
});

// 创建默认项目
const defaultProject = ProjectModel.create("project-1", {
  name: "示例项目",
  description: "这是一个任务管理系统的示例项目",
});

// 初始添加一些任务
const initTasks = async () => {
  await defaultProject.inited;
  await defaultProject.getHookState().addTask(
    "完成项目规划",
    "制定项目的详细计划和时间表",
    "high"
  );

  await defaultProject.getHookState().addTask(
    "设计用户界面",
    "创建项目的用户界面设计",
    "medium"
  );

  await defaultProject.getHookState().addTask(
    "实现核心功能",
    "开发项目的核心功能模块",
    "high"
  );
};

// 初始化任务
initTasks();

export default function App() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("medium");

  // 获取项目实例和状态
  const project = defaultProject;
  const {
    name,
    description,
    addTask,
    removeTask,
    completionRate,
    stats,
    formattedCreatedAt
  } = project.useState();

  // 获取项目下的所有任务
  const tasks = project.useChildren(TaskModel);

  // 处理添加任务
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    await addTask(newTaskTitle, newTaskDescription, newTaskPriority);

    // 重置表单
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPriority("medium");
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>{name}</h1>
      <p>{description}</p>
      <p style={{ fontSize: "14px", color: "#666" }}>创建时间：{formattedCreatedAt}</p>

      <div style={{ margin: "20px 0", padding: "15px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
        <h3>项目统计</h3>
        <div style={{ display: "flex", gap: "20px", margin: "10px 0" }}>
          <div>
            <strong>总任务数：</strong>{stats.totalTasks}
          </div>
          <div>
            <strong>已完成：</strong>{stats.completedTasks}
          </div>
          <div>
            <strong>进行中：</strong>{stats.inProgressTasks}
          </div>
          <div>
            <strong>待处理：</strong>{stats.todoTasks}
          </div>
          <div>
            <strong>高优先级：</strong>{stats.highPriorityTasks}
          </div>
        </div>
        <div style={{ marginTop: "10px" }}>
          <strong>完成率：</strong>{(completionRate * 100).toFixed(0)}%
          <div style={{
            height: "8px",
            backgroundColor: "#e0e0e0",
            borderRadius: "4px",
            marginTop: "5px",
            overflow: "hidden"
          }}>
            <div
              style={{
                height: "100%",
                width: `${completionRate * 100}%`,
                backgroundColor: completionRate === 1 ? "#4caf50" : completionRate > 0.5 ? "#2196f3" : "#ff9800",
                transition: "width 0.3s ease"
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ margin: "20px 0", padding: "15px", backgroundColor: "#f9f9f9", borderRadius: "8px" }}>
        <h3>添加新任务</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            type="text"
            placeholder="任务标题"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          />
          <textarea
            placeholder="任务描述"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd", minHeight: "80px" }}
          />
          <select
            value={newTaskPriority}
            onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
          >
            <option value="low">低优先级</option>
            <option value="medium">中优先级</option>
            <option value="high">高优先级</option>
          </select>
          <button
            onClick={handleAddTask}
            style={{
              padding: "10px 15px",
              backgroundColor: "#2196f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            添加任务
          </button>
        </div>
      </div>

      <div style={{ margin: "20px 0" }}>
        <h3>任务列表</h3>
        {tasks.length === 0 ? (
          <p>暂无任务</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {tasks.map((task) => inlineHook(task.id, () => {
              const taskState = task.useState();

              return (
                <div
                  style={{
                    padding: "15px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    backgroundColor: taskState.status === "completed" ? "#f1f8e9" : taskState.status === "inProgress" ? "#e3f2fd" : "white"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h4 style={{ margin: "0 0 5px 0" }}>{taskState.title}</h4>
                      <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#666" }}>{taskState.description}</p>
                      <div style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#888" }}>
                        <span>优先级：{taskState.priority === "high" ? "高" : taskState.priority === "medium" ? "中" : "低"}</span>
                        <span>创建时间：{taskState.formattedCreatedAt}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <select
                        value={taskState.status}
                        onChange={(e) => taskState.setStatus(e.target.value as TaskStatus)}
                        style={{ padding: "5px", borderRadius: "3px", border: "1px solid #ddd", fontSize: "12px" }}
                      >
                        <option value="todo">待处理</option>
                        <option value="inProgress">进行中</option>
                        <option value="completed">已完成</option>
                      </select>
                      <button
                        onClick={() => project.getHookState().removeTask(task.id)}
                        style={{
                          padding: "5px 10px",
                          backgroundColor: "#f44336",
                          color: "white",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          fontSize: "12px"
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            }))}
          </div>
        )}
      </div>
    </div>
  );
}
