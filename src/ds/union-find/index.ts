export interface UnionFindNode<T> {
  value: T;
  parent: UnionFindNode<T>;
  rank: number;
}

export interface UnionFindInstance<T> {
  find: (value: T) => T | null;
  union: (value1: T, value2: T) => void;
  connected: (value1: T, value2: T) => boolean;
  addNode: (value: T) => void;
  getSets: () => Map<T, T[]>;
  getSize: () => number;
  getSetCount: () => number;
  reset: () => void;
}

export class UnionFind<T> implements UnionFindInstance<T> {
  private nodes: Map<T, UnionFindNode<T>> = new Map();

  constructor(initialValues?: T[]) {
    if (initialValues) {
      initialValues.forEach(value => this.addSingleNode(value));
    }
  }

  private addSingleNode(value: T): void {
    if (this.nodes.has(value)) {
      return;
    }

    const node: UnionFindNode<T> = {
      value,
      parent: null as any,
      rank: 0,
    };
    node.parent = node;
    this.nodes.set(value, node);
  }

  addNode(value: T): void {
    this.addSingleNode(value);
  }

  private findNode(value: T): UnionFindNode<T> | null {
    const node = this.nodes.get(value);
    if (!node) {
      return null;
    }
    return this.findRoot(node);
  }

  private findRoot(node: UnionFindNode<T>): UnionFindNode<T> {
    if (node.parent !== node) {
      node.parent = this.findRoot(node.parent);
    }
    return node.parent;
  }

  find(value: T): T | null {
    const root = this.findNode(value);
    return root ? root.value : null;
  }

  union(value1: T, value2: T): void {
    const root1 = this.findNode(value1);
    const root2 = this.findNode(value2);

    if (!root1 || !root2) {
      console.warn(`Cannot union: one or both values not found in the union-find structure`);
      return;
    }

    if (root1 === root2) {
      return;
    }

    if (root1.rank < root2.rank) {
      root1.parent = root2;
    } else if (root1.rank > root2.rank) {
      root2.parent = root1;
    } else {
      root2.parent = root1;
      root1.rank++;
    }
  }

  connected(value1: T, value2: T): boolean {
    const root1 = this.findNode(value1);
    const root2 = this.findNode(value2);

    if (!root1 || !root2) {
      return false;
    }

    return root1 === root2;
  }

  getSets(): Map<T, T[]> {
    const sets = new Map<T, T[]>();

    this.nodes.forEach((node) => {
      const root = this.findRoot(node);
      const rootValue = root.value;

      if (!sets.has(rootValue)) {
        sets.set(rootValue, []);
      }
      sets.get(rootValue)!.push(node.value);
    });

    return sets;
  }

  getSize(): number {
    return this.nodes.size;
  }

  getSetCount(): number {
    const roots = new Set<T>();
    this.nodes.forEach((node) => {
      const root = this.findRoot(node);
      roots.add(root.value);
    });
    return roots.size;
  }

  reset(): void {
    this.nodes.forEach((node) => {
      node.parent = node;
      node.rank = 0;
    });
  }
}
