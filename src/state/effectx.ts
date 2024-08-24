/* eslint-disable @typescript-eslint/member-ordering */
import { timeRandomId } from '../utils/id';
import { Logger } from '../utils/logger';
import { Subscription } from 'rxjs';

interface EffectClean {
    clean: () => void;
    destroy?: () => void;
}

type EffectTeardown = () => void;
type Effect = () => EffectTeardown | EffectClean | Subscription;

const effectLogger = new Logger('EffectX');

interface DestroyInfo {
    time: Date;
    stackInfo: Error;
}

/**
 * 副作用管理的一个工具类
 *
 * ```ts
 * const effectContainer = new EffectX();
 *
 * // 运行并管理 一个副作用
 * const effectId1 = effectContainer.runEffect(()=>{
 *    // 立即运行的代码
 *    const timer = setInterval(()=>{
 *      console.log(Date.now());
 *    }, 1000);
 *
 *    return () => clearInterval(timer); // 返回副作用 cleanup
 * });
 *
 * effectContainer.cleanEffect(effectId1); // 清理对应的副作用
 *
 * const effectId2 = effectContainer.runEffect(...); // 添加更多
 *
 * const cleanup = effectContainer.popEffect(effectId2); // 类似 cleanEffect ，弹出该 cleanup
 * cleanup(); // 需要手动执行清理，因此应优先使用 cleanEffect
 *
 * // cycleEffect 会先执行上一次的 cleanup，再执行下一次的
 * effectContainer.cycleEffect('effect1', ()=>{
 *   console.log(1);
 *   return () => console.log(2);
 * }); // -> log 1
 *
 * effectContainer.cycleEffect('effect1', ()=>{
 *   console.log(1);
 *   return () => console.log(2);
 * }); // -> log 2
 *     // -> log 1
 *
 * const other = new EffectX();
 * const effectId3 = other.runEffect(()=>()=>{});
 *
 * effectContainer.attachEffect(other); // 附加副作用，调用 clean 的时候会连带清除
 *
 * effectContainer.clean(); // 清理全部副作用
 *
 * effectContainer.destroy(); // 清理、销毁，不允许继续运行
 * ```
 */

export class EffectX implements EffectClean {
    #destroyInfo = null as DestroyInfo | null;

    isDestroyed() {
        return Boolean(this.#destroyInfo);
    }

    getDestroyInfo() {
        return this.#destroyInfo;
    }

    /** @ignore */
    #effects: Map<string, EffectTeardown | EffectClean | Subscription> = new Map();
    /** @ignore */
    #cleaning = false;
    /** @ignore */
    #parent: EffectX | null = null;

    /**
     * @description 立即执行并收集副作用
     * @param effect 立即执行的函数，返回清理副作用的函数
     * @returns id，用于 cleanEffect 调用
     */
    runEffect(effect: Effect): string {
        if (this.#cleaning) {
            effectLogger.error('Can not run effect between cleaning.');
            return '';
        }
        if (this.isDestroyed()) {
            effectLogger.error('Can not run effect after destroyed, skip run.');
            return '';
        }
        const id = timeRandomId();
        this.#effects.set(id, effect());
        return id;
    }

    /**
     *
     * @param name
     * @param effect
     * @returns
     */
    cycleEffect(name: string, effect: Effect): void {
        if (this.#cleaning) {
            effectLogger.error('Can not run effect between cleaning.');
            return;
        }
        if (this.isDestroyed()) {
            effectLogger.error('Can not run effect after destroyed, skip run.');
            return;
        }
        this.cleanEffect(name);
        this.#effects.set(name, effect());
    }

    /**
     * @description 绑定子Effect
     * @param sub 子Effect
     * @returns id，用于 cleanEffect 调用
     */
    attachEffect(sub: EffectClean | EffectTeardown | Subscription): string {
        if (sub instanceof EffectX) {
            if (sub.#parent) {
                effectLogger.error('the object has already attached to a parent, cannot attch again', {
                    object: sub,
                    parent: sub.#parent
                });
                return '';
            } else {
                const id = this.runEffect(() => sub);
                if (id) {
                    sub.#parent = this;
                }
                return id;
            }
        }
        return this.runEffect(() => sub);
    }

    /**
     * attachEffect，但类型上仅支持 EffectX
     */
    attach(sub: EffectX): string {
        return this.attachEffect(sub);
    }

    /**
     * @param sub ，被挂靠的 EffectX 实例
     */
    detach(sub: EffectX) {
        if (sub.#parent === this) {
            try {
                this.#effects.forEach((val, id) => {
                    if (val === sub) {
                        this.#effects.delete(id);
                        sub.#parent = null;
                        throw new Error('stop');
                    }
                });
            } catch { }
        }
    }

    /**
     * @description 通过副作用的 id 清理副作用
     * @param id 副作用的 id
     * @returns 是否存在该副作用id
     */
    cleanEffect(id: string): boolean {
        const teardown = this.#effects.get(id);
        if (teardown) {
            this.#effects.delete(id);
            if (typeof teardown === 'function') {
                teardown();
            } else if ('unsubscribe' in teardown) {
                teardown.unsubscribe();
            } else {
                if (teardown instanceof EffectX) {
                    teardown.#parent = null;
                }
                teardown.clean();
            }
        }
        return Boolean(teardown);
    }

    /**
     * @description 弹出 cleanup，需手动执行
     * @param id
     * @returns 销毁副作用的函数，可能为空
     */
    popEffect(id: string): EffectTeardown | null {
        const teardown = this.#effects.get(id);
        if (teardown) {
            this.#effects.delete(id);
            if (typeof teardown === 'function') {
                return () => teardown();
            } else if ('unsubscribe' in teardown) {
                return () => teardown.unsubscribe();
            } else {
                if (teardown instanceof EffectX) {
                    teardown.#parent = null;
                }
                return () => teardown.clean();
            }
        }
        return null;
    }

    /**
     * @description 执行全部 cleanup
     * @param [withSub=false] 是否执行挂靠的 EffectX 实例上的 clean
     */
    clean(withSub = false): void {
        this.#cleaning = true;
        [...this.#effects.entries()].forEach(([id, teardown]) => {
            if (typeof teardown === 'function') {
                this.#effects.delete(id);
                teardown();
            } else if ('unsubscribe' in teardown) {
                this.#effects.delete(id);
                teardown.unsubscribe();
            } else {
                if (teardown instanceof EffectX) {
                    if (withSub) {
                        this.#effects.delete(id);
                        teardown.#parent = null;
                        teardown.clean();
                    }
                } else {
                    this.#effects.delete(id);
                    teardown.clean();
                }
            }
        });
        this.#cleaning = false;
    }

    /**
     * @description 销毁全部的副作用，不允许继续运行/添加新的副作用
     */
    destroy() {
        if (this.#parent) {
            effectLogger.error('The instance has attached to a parent, cannot call its destroy directly', this);
            return;
        }

        if (this.isDestroyed()) {
            effectLogger.warn('The instance has already destroyed', this);
            return;
        }
        this.#destroyInfo = {
            time: new Date(),
            stackInfo: new Error('effectx destroy stack')
        };
        [...this.#effects.values()].forEach((teardown) => {
            if (typeof teardown === 'function') {
                teardown();
            } else if ('unsubscribe' in teardown) {
                teardown.unsubscribe();
            } else {
                if (teardown instanceof EffectX) {
                    teardown.#parent = null;
                    teardown.destroy?.(); // 连带销毁
                } else {
                    teardown.clean();
                }
            }
        });
        this.#effects.clear();
    }
}
