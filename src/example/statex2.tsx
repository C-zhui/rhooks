import { Subscription, interval, retry, switchMap, tap } from 'rxjs';
import { createModel, useModelState } from '../state/statex/statex2';
import { useEffect, useState } from 'react';

const CountdownModel = createModel<{
  count: number;
  running: boolean
}, {
  start: number;
  pause: void;
  resume: void;
}, {
  start: number;
  tick: number;
  paused: number;
  timeout: void;
},
  void |
  {
    init?: number;
  }
>({
  name: 'count',
  state: (params) => ({
    running: false,
    count: params?.init || 0,
  }),
  setup(api, _params) {
    api.actions.start.pipe(
      switchMap(n => {
        api.emit.start(n);
        api.setState({ count: n, running: true });
        return interval(1000);
      }),
      tap(() => {
        if (!api.state.running) {
          throw 'pause';
        }
        const cnt = api.state.count - 1;
        if (cnt >= 0) {
          api.setState({ count: cnt });
          api.emit.tick(cnt);
        }
        if (cnt <= 0) {
          api.emit.timeout();
          throw 'timeout';
        }
      }),
      retry()
    ).subscribe();

    api.actions.pause.subscribe(() => {
      api.setState({
        running: false
      });
      api.emit.paused(api.state.count);
    });

    api.actions.resume.subscribe(() => {
      api.dispatch.start(api.state.count);
    })
  },
})


export default function TestStateModel() {
  const [cdIns] = useState(() => CountdownModel({
    init: 10
  }));

  
  const [number, setNumber] = useState(cdIns.state.count)
  const state = useModelState(cdIns)
  useEffect(() => {
    const sub = new Subscription();

    sub.add(cdIns.events.start.subscribe((n) => {
      console.log('start at', n)
    }))

    sub.add(cdIns.events.paused.subscribe((n) => {
      console.log('pause at', n)
    }))

    sub.add(cdIns.events.tick.subscribe((n) => {
      console.log('tick at', n)
    }))

    sub.add(cdIns.events.timeout.subscribe((_n) => {
      console.log('timeout')
    }))

    return () => sub.unsubscribe();
  }, [])

  return <div>
    <input type="number" value={number} onChange={e => setNumber(Number(e.target.value))} />
    <button onClick={() => {
      cdIns.dispatch.start(number);
    }}>start</button>
    <button onClick={() => cdIns.dispatch.pause()}>pause</button>
    <button onClick={() => cdIns.dispatch.resume()}>resume</button>
    <button>{state.count}</button>
  </div>;
}