import { useRef, useState } from "react";
import { $map, $text } from "../component/Observable/jsxHelper";
import { BehaviorSubject } from "rxjs";

export function Test() {
    const [cnt$] = useState(() => new BehaviorSubject(0));

    const [c, setC] = useState(0)
    const renderCnt = useRef(0)
    renderCnt.current++;

    return <div>
        <div>
            <div style={{ display: 'flex', gap: 4, width: '80vw', flexWrap: 'wrap', overflow: 'hidden' }}>
                {Array(100).fill(0).map((_e, i) =>
                    <div key={i} style={{ width: 100 }}>
                        {$text($map(cnt$, (s) => `${s}`))}
                    </div>
                )}
            </div>

            <div>{c}</div>
        </div>

        <button>
            {renderCnt.current}
        </button>
        <br />
        <div>
            <button onClick={() => cnt$.next(cnt$.value + 1)}>inc</button>
            <button onClick={() => cnt$.next(0)}>reset</button>
        </div>
        <div>
            <button onClick={() => setC(c => c + 1)}>inc</button>
            <button onClick={() => setC(0)}>reset</button>
        </div>
    </div>
}

export function Test2() {
    const [cnt$] = useState(() => new BehaviorSubject(0));

    const [c, setC] = useState(0)
    const renderCnt = useRef(0)
    renderCnt.current++;

    return <div>
        <div>
            <div style={{ display: 'flex', gap: 4, width: '80vw', flexWrap: 'wrap', overflow: 'hidden' }}>
                {Array(100).fill(0).map((_e, i) =>
                    <div key={i} style={{ width: 100 }}>
                        {c}
                    </div>
                )}
            </div>

            <div>{c}</div>
        </div>

        <button>
            {renderCnt.current}
        </button>
        <br />
        <div>
            <button onClick={() => cnt$.next(cnt$.value + 1)}>inc</button>
            <button onClick={() => cnt$.next(0)}>reset</button>
        </div>
        <div>
            <button onClick={() => setC(c => c + 1)}>inc</button>
            <button onClick={() => setC(0)}>reset</button>
        </div>
    </div>
}

export default Test2;