import { every, isArray, isObject, keys, uniq } from "lodash-es";

export function shallowEqual(obj1: any, obj2: any) {
    // 是否直接相等
    if (Object.is(obj1, obj2)) {
      return true
    }
  
    // 如果非对象直接比较
    if (!isObject(obj1) && !isObject(obj2)) {
      return obj1 === obj2;
    }
  
    // 处理都是 array 的情况
    if (isArray(obj1) && isArray(obj2)) {
      return obj1.length == obj2.length && every(obj1, (a, i) => { return obj1[i] === obj2[i] })
    }
  
    // 遍历对象的自身属性（不包括继承的属性）
    const allKeys = uniq(keys(obj1).concat(keys(obj2)))
    for (const key of allKeys) {
      if ((obj1.hasOwnProperty(key) || obj2.hasOwnProperty(key)) && !Object.is(obj1[key], obj2[key])) {
        return false;
      }
    }
  
    // 如果所有自身属性都相等，则返回 true
    return true;
  }
  