import { HTMLProps, useRef } from "react";
import { Observable, map } from "rxjs";
import { useSubscription } from 'observable-hooks';

interface ObservableDivProps extends HTMLProps<HTMLDivElement> {
    content$: Observable<string>;
}

export function mapObservable<T>(observable: Observable<T>, toStr: (a: T) => string) {
    return observable.pipe(map(toStr));
}

export function ObservableDiv(props: ObservableDivProps) {
    const { content$, ...rest } = props;
    const refContent = useRef('');
    const ref = useRef<HTMLDivElement | null>(null);

    useSubscription(props.content$, (text) => {
        requestAnimationFrame(() => {
            if (ref.current && text !== refContent.current) {
                ref.current.textContent = text;
                refContent.current = text;
            }
        })
    });

    return <div ref={ref} {...rest} />
}