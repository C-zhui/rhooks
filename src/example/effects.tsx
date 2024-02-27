import { useState } from 'react';
import { useRendersCount } from 'react-use';
import { useEffects } from '../hooks/effects';

function App() {
  const [cnt, setCount] = useState(0);
  const renderCount = useRendersCount();

  useEffects({
    hello1: useEffects.effect(() => {
      console.log('hello1', cnt);
    }, [cnt]),
    hello2: useEffects.effect(() => {
      console.log('hello2', Math.floor(cnt / 3), cnt);
    }, [Math.floor(cnt / 3)]),
    hello3: cnt % 10 === 0 ? useEffects.effect(() => {
      console.log('hello3', cnt);
      return () => {
        console.log('hello3 clean')
      }
    }, [cnt], 1) : null,
  });

  return (
    <>
      <div>
        app count: {cnt} renderCount {renderCount}
        <button onClick={() => setCount((c) => c + 1)}>inc</button>
      </div>
    </>
  );
}

export default App;
