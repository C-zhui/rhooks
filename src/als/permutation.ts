/**
 * 生成数组的全排列
 */

// 基于生成器
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

// 基于递归
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

function flip(arr: number[], i: number, j: number) {
  while (i < j) {
    swap(arr, i++, j--);
  }
}

function rotateRight(arr: number[], i: number, j: number) {
  const p = arr[j];
  for (let k = j; k > i; k--) {
    arr[k] = arr[k - 1];
  }
  arr[i] = p;
}

function rotateLeft(arr: number[], i: number, j: number) {
  const p = arr[i];
  for (let k = i; k < j; k++) {
    arr[k] = arr[k + 1];
  }
  arr[j] = p;
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
      rotateRight(ns, i, j);
      dfs(ns, i + 1);
      rotateLeft(ns, i, j);
    }
  }

  dfs(nums, 0);

  return result;
}

function print(nums: number[][]) {
  nums.forEach(e => {
    console.log(`[${e.join(',')}]`);
  })
}


// print(permutation3([1, 2, 3, 4, 5]));
print([...permutation([1, 2, 3, 4, 5])]);
