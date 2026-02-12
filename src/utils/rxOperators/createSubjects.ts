import { BehaviorSubject, Subject } from "rxjs";

/** 创建一个 BehaviorSubject 工厂函数
 *  参数是一个纯对象，以这个对象的初值，按 key 创建对应的 BehaviorSubject，返回一个对象，以 key 为属性名，以 BehaviorSubject 为属性值
 */
export const createBehaviorSubjects = <T extends Record<string, any>>(init: T) => {
    const subjects = {} as Record<keyof T, BehaviorSubject<T[keyof T]>>;
    for (const key in init) {
        subjects[key] = new BehaviorSubject<T[keyof T]>(init[key]);
    }
    return subjects;
};

/** 创建一个 Subject 工厂函数
 *  使用 Proxy 延迟生成 Subject，当访问某个属性时才创建对应的 Subject
 */
export const createSubjects = <T extends Record<string, any>>() => {
    const subjects = new Map<string, Subject<any>>();
    
    return new Proxy({} as Record<keyof T, Subject<T[keyof T]>>, {
        get(target, prop: string) {
            if (!subjects.has(prop)) {
                subjects.set(prop, new Subject<T[keyof T]>());
            }
            return subjects.get(prop);
        }
    });
};