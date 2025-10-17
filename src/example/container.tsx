import { memo, useState } from 'react';
import { useRendersCount } from 'react-use';
import { createContainer } from '../hooks/container';

const CountContainer = createContainer((init: number = 0) => {
  const [cnt, setCount] = useState(init);
  const cntd10 = Math.floor(cnt / 10);
  return { cnt, setCount, cntd10 }
});

const Demo = memo(() => {
  const [c, ref] = CountContainer.useContainer((s) => s.cntd10);
  const [_a, setA] = useState(1);
  const cnt = useRendersCount();
  console.log('render demo', ref);
  return (
    <div>
      count/10: {c} renderCount {cnt}
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
        <Demo2 />
      </CountContainer.Provider>
    </>
  );
}

export default App;
