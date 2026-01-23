import { isEqual, every, isArray, keys, uniq, pick, isPlainObject } from 'lodash-es';

/** 相当于 Object.is
 * @ignore
 */
export const strictEqual = Object.is;

/** 深比较
 * @ignore
 */
export const deepEqual = isEqual;

const { hasOwnProperty } = Object.prototype;

/** 浅比较
 * @ignore
 */
export function shallowEqual(obj1: any, obj2: any) {
  // 是否直接相等
  if (Object.is(obj1, obj2)) {
    return true;
  }

  // 处理都是 array 的情况
  if (isArray(obj1) && isArray(obj2)) {
    return obj1.length === obj2.length && every(obj1, (_a, i) => Object.is(obj1[i], obj2[i]));
  }

  // 如果非对象直接比较
  if (!isPlainObject(obj1) || !isPlainObject(obj2)) {
    return obj1 === obj2;
  }

  // 遍历对象的自身属性（不包括继承的属性）
  const allKeys = uniq(keys(obj1).concat(keys(obj2)));
  for (const key of allKeys) {
    if (
      (hasOwnProperty.call(obj1, key) || hasOwnProperty.call(obj2, key)) &&
      !Object.is(obj1[key], obj2[key])
    ) {
      return false;
    }
  }

  // 如果所有自身属性都相等，则返回 true
  return true;
}

/** 仅比较某些 key
 * @ignore
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export const keysEqual = (keysIn: string[]) => (a: object, b: object) => {
  return shallowEqual(pick(a, keysIn), pick(b, keysIn));
};
