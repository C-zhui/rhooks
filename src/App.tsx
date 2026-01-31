import React, { Suspense, ComponentType } from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";

// 导入所有 example 组件
const ComponentObservableDiv = React.lazy(() => import("./example/component_obversablediv"));
const Container = React.lazy(() => import("./example/container"));
const Effects = React.lazy(() => import("./example/effects"));
const EmotionObservable = React.lazy(() => import("./example/emotion_observable"));
const RState = React.lazy(() => import("./example/rstate"));
const RState2 = React.lazy(() => import("./example/rstate2"));
const Signal = React.lazy(() => import("./example/signal"));
const StateModel = React.lazy(() => import("./example/statex2"));
const Test = React.lazy(() => import("./example/test"));

// 路由配置
const routes = [
  { path: "/component-obversablediv", element: <ComponentObservableDiv />, label: "Component ObservableDiv" },
  { path: "/container", element: <Container />, label: "Container" },
  { path: "/effects", element: <Effects />, label: "Effects" },
  { path: "/emotion-observable", element: <EmotionObservable />, label: "Emotion Observable" },
  { path: "/rstate", element: <RState />, label: "RState" },
  { path: "/rstate2", element: <RState2 />, label: "RState 2 (Todo List)" },
  { path: "/signal", element: <Signal />, label: "Signal" },
  { path: "/state-model", element: <StateModel />, label: "State Model" },
  { path: "/test", element: <Test />, label: "Test" },
];

export default function App() {
  return (
    <Router>
      <div className="app">
        {/* 导航栏 */}
        <nav className="nav">
          <h1>Rooks Examples</h1>
          <ul className="nav-list">
            {routes.map((route) => (
              <li key={route.path}>
                <NavLink to={route.path} className={({ isActive }) => isActive ? "active" : ""}>
                  {route.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* 路由内容 */}
        <main className="content">
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              {/* 默认路由重定向到 rstate2 */}
              <Route path="/" element={<RState2 />} />
              {/* 其他路由 */}
              {routes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
}
