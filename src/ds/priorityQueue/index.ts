const swap = <T>(arr: T[], i: number, j: number) => {
  const t = arr[j];
  arr[j] = arr[i];
  arr[i] = t;
};

export default function PriorityQueue<T>(fstTop: (a: T, b: T) => boolean, initArr: T[] = []) {
  const arr = [null as any as T].concat(initArr);

  const up = (i: number) => {
    const p = i >> 1;
    if (p === 0) return;
    if (fstTop(arr[p], arr[i])) {
      return;
    }
    swap(arr, p, i);
    up(p);
  };

  const down = (i: number) => {
    if (i === 0) return;
    const left = 2 * i;
    const right = left + 1;
    let max = i;
    if (left < arr.length && fstTop(arr[left], arr[max])) max = left;
    if (right < arr.length && fstTop(arr[right], arr[max])) max = right;
    if (max === i) {
      return;
    }
    swap(arr, i, max);
    down(max); // tail recursive call
  };

  let i = arr.length >> 1;
  while (i) {
    down(i--);
  } // 造堆

  return {
    current() {
      return arr;
    },
    len() {
      return arr.length - 1;
    },
    push(item: T) {
      arr.push(item);
      up(this.len());
    },
    peek() {
      return arr[1];
    },
    pop() {
      if (this.len() > 0) {
        const out = this.peek();
        const last = arr.pop();
        if (this.len()) {
          arr[1] = last!;
          down(1);
        }
        return out;
      } else return null;
    },
  };
}
