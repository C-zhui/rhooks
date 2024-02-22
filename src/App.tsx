import { memo, useMemo, useReducer, useState } from 'react';
import './App.css';
import { useRendersCount } from 'react-use';
import { createContainer, deepEqual } from './hooks/container';

const CountContainer = createContainer((init: number = 0) => {
  const [cnt, setCount] = useState(init);
  const cntd10 = Math.floor(cnt / 10);
  return { cnt, setCount, cntd10 }
});

const Demo = memo(() => {
  const [c, ref] = CountContainer.useContainer((s) => s.cntd10);
  const [a, setA] = useState(1);
  const cnt = useRendersCount();
  console.log('render demo', ref);
  return (
    <div>
      count: {c} renderCount {cnt}
      <button onClick={() => ref.current.setCount((c) => c + 3)}>inc</button>
      <button onClick={() => setA(Math.random())}>setA</button>
    </div>
  );
});

const Demo2 = memo(() => {
  const [c] = CountContainer.useContainer();
  const cnt = useRendersCount();

  console.log('render demo2');
  return (
    <div>
      count: {c.cnt} renderCount {cnt}
      <button onClick={() => c.setCount((c) => c + 3)}>inc</button>
    </div>
  );
});

function Demo3() {
  const [state, dispatch] = useReducer(
    (state, action) => {
      if (action.type === 'unchange') {
        return state;
      } else {
        return { ...state, a: state.a + 1 };
      }
    },
    { a: 1 }
  );

  const rendercount = useRendersCount();

  return (
    <div>
      count: {state.a} rendercount: {rendercount}
      <button
        onClick={() =>
          dispatch({
            type: 'unchange',
          })
        }
      >
        unchange
      </button>
      <button onClick={() => dispatch({})}>inc</button>
    </div>
  );
}


function App() {
  const [cnt, setCount] = useState(0);
  const renderCount = useRendersCount();

  return (
    <>
      <div>
        app count: {cnt} renderCount {renderCount}
        <button onClick={() => setCount((c) => c + 3)}>inc</button>
      </div>
      <CountContainer.Provider>
        <Demo />
        {/* <Demo2 /> */}
        {/* <Demo3 /> */}
      </CountContainer.Provider>
    </>
  );
}

export default App;
