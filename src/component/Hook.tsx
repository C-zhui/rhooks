import { ReactNode, isValidElement } from "react";

/** 内联状态 hook */
export function Hook({ fn }: { fn: () => ReactNode | void }) {
    const result = fn()
    return isValidElement(result) ? <>{result}</> : null;
}