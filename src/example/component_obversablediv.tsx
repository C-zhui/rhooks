import { useRef, useState } from "react";
import { ObservableDiv, mapObservable } from "../component/ObservableDiv";
import { BehaviorSubject, map } from "rxjs";

export default function Test() {
    const [cnt$] = useState(() => new BehaviorSubject(0));

    const renderCnt = useRef(0)
    renderCnt.current++;
    return <div>
        <ObservableDiv content$={(mapObservable(cnt$, (s: number) => `${s}`))} />

        <button onClick={() => cnt$.next(cnt$.value + 1)}>inc</button>
        <button>
            {renderCnt.current}
        </button>
        <button onClick={() => cnt$.next(0)}>reset</button>
    </div>
}