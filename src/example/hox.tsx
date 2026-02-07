import { useCountDown, useSetState } from "ahooks";
import { createRoot } from "react-dom/client";
import { createGlobalStore, HoxRoot, createStore } from "hox";
import { useStableApis } from "../hooks/useStableCallback";

createRoot(document.createElement("div")).render(<HoxRoot />);

const [useStore, getStore] = createGlobalStore(() => {
  const [state, setState] = useSetState({
    targetDate: 0,
  });

  const [leftMs] = useCountDown({
    targetDate: state.targetDate,
    interval: 200,
  });

  return {
    leftMs,
    start(n: number) {
      setState({ targetDate: Date.now() + n });
    },
  };
});

export default function HoxExample() {
  const { leftMs, start } = useStore((s) => [s.leftMs]);

  return (
    <div>
      <button onClick={() => start(10000)}>start</button>
      <div>leftMs:{leftMs}</div>
    </div>
  );
}

// createRoot(document.getElementById('root')).render(<HoxExample />);

const [useMyStore, getMyStore] = createGlobalStore(() => {
  const [state, setState] = useSetState(() => ({
    count: 0,
    input: "",
  }));

  const api = useStableApis({
    inc: () => setState((s) => ({ count: s.count + 1 })),
    setInput: (input: string) => setState({ input }),
  });

  return {
    state,
    api,
  };
});

// const {state, api} =  useMyStore();

// state.count;

// api.
