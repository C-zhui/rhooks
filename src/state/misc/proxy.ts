// eslint-disable-next-line @typescript-eslint/ban-types
export const shallowReadonly = <T extends object>(obj: T): T =>
  new Proxy(obj, {
    set() {
      return true;
    },
    defineProperty() {
      return true;
    }
  });

export const deepReadOnly = <T extends object>(obj: T): T => {
  const proxy = new Proxy(obj, {
    set() {
      return true;
    },
    defineProperty() {
      return true;
    }
  });
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === "object" && value !== null) {
        proxy[key] = deepReadOnly(value);
      }
    }
  }
  return proxy;
};
