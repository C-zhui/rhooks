import React, { createElement, isValidElement, ReactNode } from 'react';

/**
 * 挂载 hook，当你不想为它写一个组件或者不知挂哪个组件上的时候
 * @param fn 传入一个 hook 函数
 * @returns
 */
function Hook({ fn }: { fn: () => any }) {
    const res = fn();

    return isValidElement(res) ? res : null;
}

const NullComponent = () => null;
/**
 * 挂载 hook，当你不想为它写一个组件或者不知挂哪个组件上的时候
 * @param fn 传入一个 hook 函数
 * @returns
 */
export function inlineHook(fn: () => any): React.ReactElement;
export function inlineHook(key: string, fn: () => any): React.ReactElement;
export function inlineHook(...args: any[]) {
    const [a, b] = args;
    if (typeof a === 'function') {
        return createElement(Hook, {
            fn: a,
        });
    } else if (typeof a === 'string') {
        return createElement(Hook, {
            key: a,
            fn: b,
        });
    } else {
        return createElement(NullComponent, {});
    }
}
