import { useLayoutEffect, useMemo, useRef } from "react";
import { EMPTY, Observable, Subscription, map } from "rxjs";

export function $map<T>(observable: Observable<T>, toStr: (a: T) => string) {
    return observable.pipe(map(toStr));
}

const queue = [] as CallableFunction[];
let rafTask: null | number = null;
let timer: null | number = null;

function runTask() {
    if (rafTask) {
        return
    }
    rafTask = requestAnimationFrame(() => {
        rafTask = null;
        timer && clearTimeout(timer);
        timer = null;
        const cloneQueue = [...queue];
        queue.length = 0;
        cloneQueue.forEach(e => {
            try {
                e()
            } catch (e) { console.error(e) }
        });
    });

    timer = setTimeout(() => {
        timer = null;
        const cloneQueue = [...queue];
        queue.length = 0;
        cloneQueue.forEach(e => {
            try {
                e()
            } catch (e) { console.error(e) }
        });
    }, 500) as any;
}

function pushTask(cb: CallableFunction) {
    queue.push(cb);
    runTask()
}

const $textStyle = {
    display: 'contents',
}

export function ObservableText(props: { content$: Observable<number | string> }) {
    const refContent = useRef('');
    const ref = useRef<HTMLDivElement | null>(null);
    const sub = useRef<Subscription | null>(null);

    const firstText = useMemo(() => {
        sub.current?.unsubscribe();
        let text = '';

        sub.current = (props.content$ || EMPTY).subscribe((t) => {
            text = `${t}`;
            pushTask(() => {
                if (ref.current && text !== refContent.current) {
                    ref.current.textContent = text;
                    refContent.current = text;
                }
            })
        });
        return text;
    }, [props.content$]);


    useLayoutEffect(() => {
        refContent.current = firstText;
        return () => {
            sub.current?.unsubscribe();
        }
    }, [
        firstText
    ])

    return <span ref={ref} style={$textStyle}>
        {firstText}
    </span>
}

export function $text(observable: Observable<string | number>) {
    return <ObservableText content$={observable} />
}