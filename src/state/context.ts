export function create<T>(init: () => T) {
  let obj = init();
  return {
    get() {
      return obj;
    },
    assign(newObj: Partial<T>) {
      obj = { ...obj, ...newObj };
    },
    extend<A>(newObj: A) {
      return create(() => ({ ...obj, ...newObj }));
    },
  };
}
