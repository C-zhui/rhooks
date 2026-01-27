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
