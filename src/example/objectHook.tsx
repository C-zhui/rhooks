import createModel from "../hooks/objectHook";

const ModelA = createModel({
  initState(id, param: { count: number }) {
    return {
      id,
      count: param.count,
    };
  },
  hook({ state, setState, id }) {
    return {
      inc: () =>
        setState({
          count: state.count + 1,
        }),
    };
  },
});

const a = ModelA.create("default", { count: 1 });

export default function App() {
  const { count, inc } = a.useState();

  return (
    <div>
      <button
        onClick={() => {
          inc();
        }}
      >
        count: {count}
      </button>
    </div>
  );
}
