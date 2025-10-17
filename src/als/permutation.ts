function* permutation(nums: number[]): Generator<number[]> {
  if (nums.length <= 1) {
    yield nums;
    return;
  }

  for (let i of nums) {
    for (let arr of permutation(nums.filter((e) => e !== i))) {
      yield [i, ...arr];
    }
  }
}

function permutation2(nums: number[]): number[][] {
  function dfs(ns: number[]): number[][] {
    if (ns.length === 1) {
      return [ns];
    }
    const result: number[][] = [];

    for (let i of ns) {
      const pus = dfs(ns.filter((e) => e !== i));

      pus.forEach((e) => {
        result.push([i, ...e]);
      });
    }

    return result;
  }

  return dfs(nums);
}

function swap(arr: number[], i: number, j: number) {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

// 可以得到组合，但是顺序不对
function permutation3(nums: number[]): number[][] {
  const result = [] as number[][];
  function dfs(ns: number[], i: number) {
    if (i === ns.length - 1) {
      result.push([...ns]);
      return;
    }

    for (let j = i; j < ns.length; j++) {
      swap(ns, i, j);
      dfs(ns, i + 1);
      swap(ns, i, j);
    }
  }

  dfs(nums, 0);

  return result;
}

function rotate(arr: number[], i: number, j: number) {
  const p = arr[i];
  for (let k = i; k < j; k++) {
    arr[k] = arr[k + 1];
  }
  arr[j] = p;
}

function permutation4(nums: number[]): number[][] {
  const result = [] as number[][];

  function dfs(ns: number[], i: number) {
    for (let j = i; j < ns.length; j++) {
      rotate(ns, i, j);
      dfs(ns, i + 1);
      swap(ns, i, j);
    }
  }

  dfs(nums, 0);

  return result;
}

// console.log(permutation2([1, 2, 3, 4, 5]));
console.log(permutation4([1, 2, 3, 4, 5]));
console.log([...permutation([1, 2, 3, 4, 5])]);
