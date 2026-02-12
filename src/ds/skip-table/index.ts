export interface SkipListNode<K, V> {
  key: K;
  value: V;
  forward: SkipListNode<K, V>[];
}

export interface SkipListOptions<K> {
  maxLevel?: number;
  probability?: number;
  comparator?: (a: K, b: K) => number;
}

export interface SkipListInstance<K, V> {
  insert: (key: K, value: V) => void;
  delete: (key: K) => boolean;
  find: (key: K) => V | undefined;
  update: (key: K, value: V) => boolean;
  contains: (key: K) => boolean;
  getMin: () => { key: K; value: V } | null;
  getMax: () => { key: K; value: V } | null;
  range: (min: K, max: K) => Array<{ key: K; value: V }>;
  forEach: (callback: (key: K, value: V) => void) => void;
  toArray: () => Array<{ key: K; value: V }>;
  size: () => number;
  isEmpty: () => boolean;
  clear: () => void;
  getLevel: () => number;
}

class SkipListNodeImpl<K, V> implements SkipListNode<K, V> {
  key: K;
  value: V;
  forward: SkipListNode<K, V>[];

  constructor(key: K, value: V, level: number) {
    this.key = key;
    this.value = value;
    this.forward = new Array(level).fill(null);
  }
}

export class SkipList<K, V> implements SkipListInstance<K, V> {
  private maxLevel: number;
  private probability: number;
  private comparator: (a: K, b: K) => number;
  private head: SkipListNode<K, V>;
  private tail: SkipListNode<K, V>;
  private level: number = 0;
  private length: number = 0;

  private readonly MAX_KEY: K;
  private readonly MIN_KEY: K;

  constructor(options: SkipListOptions<K> = {}) {
    this.maxLevel = options.maxLevel || 16;
    this.probability = options.probability || 0.5;
    this.comparator = options.comparator || ((a: any, b: any) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    this.MAX_KEY = Symbol('MAX') as any;
    this.MIN_KEY = Symbol('MIN') as any;

    this.head = new SkipListNodeImpl<K, V>(this.MIN_KEY, null as any, this.maxLevel);
    this.tail = new SkipListNodeImpl<K, V>(this.MAX_KEY, null as any, this.maxLevel);

    for (let i = 0; i < this.maxLevel; i++) {
      this.head.forward[i] = this.tail;
    }
  }

  private randomLevel(): number {
    let level = 1;
    while (Math.random() < this.probability && level < this.maxLevel) {
      level++;
    }
    return level;
  }

  private createNode(key: K, value: V, level: number): SkipListNode<K, V> {
    return new SkipListNodeImpl<K, V>(key, value, level);
  }

  private findPredecessors(key: K): SkipListNode<K, V>[] {
    const update: SkipListNode<K, V>[] = new Array(this.maxLevel).fill(null);
    let current = this.head;

    for (let i = this.level - 1; i >= 0; i--) {
      while (
        current.forward[i] !== this.tail &&
        this.comparator(current.forward[i].key, key) < 0
      ) {
        current = current.forward[i];
      }
      update[i] = current;
    }

    return update;
  }

  insert(key: K, value: V): void {
    const update = this.findPredecessors(key);
    const next = update[0].forward[0];

    if (next !== this.tail && this.comparator(next.key, key) === 0) {
      next.value = value;
      return;
    }

    const newLevel = this.randomLevel();

    if (newLevel > this.level) {
      for (let i = this.level; i < newLevel; i++) {
        update[i] = this.head;
      }
      this.level = newLevel;
    }

    const newNode = this.createNode(key, value, newLevel);

    for (let i = 0; i < newLevel; i++) {
      newNode.forward[i] = update[i].forward[i];
      update[i].forward[i] = newNode;
    }

    this.length++;
  }

  delete(key: K): boolean {
    const update = this.findPredecessors(key);
    const node = update[0].forward[0];

    if (node === this.tail || this.comparator(node.key, key) !== 0) {
      return false;
    }

    for (let i = 0; i < this.level; i++) {
      if (update[i].forward[i] !== node) {
        break;
      }
      update[i].forward[i] = node.forward[i];
    }

    while (this.level > 1 && this.head.forward[this.level - 1] === this.tail) {
      this.level--;
    }

    this.length--;
    return true;
  }

  find(key: K): V | undefined {
    let current = this.head;

    for (let i = this.level - 1; i >= 0; i--) {
      while (
        current.forward[i] !== this.tail &&
        this.comparator(current.forward[i].key, key) <= 0
      ) {
        current = current.forward[i];
      }
    }

    if (current !== this.head && this.comparator(current.key, key) === 0) {
      return current.value;
    }

    return undefined;
  }

  update(key: K, value: V): boolean {
    let current = this.head;

    for (let i = this.level - 1; i >= 0; i--) {
      while (
        current.forward[i] !== this.tail &&
        this.comparator(current.forward[i].key, key) <= 0
      ) {
        current = current.forward[i];
      }
    }

    if (current !== this.head && this.comparator(current.key, key) === 0) {
      current.value = value;
      return true;
    }

    return false;
  }

  contains(key: K): boolean {
    return this.find(key) !== undefined;
  }

  getMin(): { key: K; value: V } | null {
    const first = this.head.forward[0];
    if (first === this.tail) {
      return null;
    }
    return { key: first.key, value: first.value };
  }

  getMax(): { key: K; value: V } | null {
    let current = this.head;

    for (let i = this.level - 1; i >= 0; i--) {
      while (current.forward[i] !== this.tail) {
        current = current.forward[i];
      }
    }

    if (current === this.head) {
      return null;
    }

    return { key: current.key, value: current.value };
  }

  range(min: K, max: K): Array<{ key: K; value: V }> {
    const result: Array<{ key: K; value: V }> = [];
    let current = this.head;

    for (let i = this.level - 1; i >= 0; i--) {
      while (
        current.forward[i] !== this.tail &&
        this.comparator(current.forward[i].key, min) < 0
      ) {
        current = current.forward[i];
      }
    }

    current = current.forward[0];

    while (
      current !== this.tail &&
      this.comparator(current.key, max) <= 0
    ) {
      result.push({ key: current.key, value: current.value });
      current = current.forward[0];
    }

    return result;
  }

  forEach(callback: (key: K, value: V) => void): void {
    let current = this.head.forward[0];

    while (current !== this.tail) {
      callback(current.key, current.value);
      current = current.forward[0];
    }
  }

  toArray(): Array<{ key: K; value: V }> {
    const result: Array<{ key: K; value: V }> = [];
    this.forEach((key, value) => {
      result.push({ key, value });
    });
    return result;
  }

  size(): number {
    return this.length;
  }

  isEmpty(): boolean {
    return this.length === 0;
  }

  clear(): void {
    this.level = 0;
    this.length = 0;

    for (let i = 0; i < this.maxLevel; i++) {
      this.head.forward[i] = this.tail;
    }
  }

  getLevel(): number {
    return this.level;
  }

  print(): void {
    console.log(`SkipList (level: ${this.level}, size: ${this.length})`);
    
    for (let i = this.level - 1; i >= 0; i--) {
      let current = this.head.forward[i];
      const level: string[] = [];
      
      while (current !== this.tail) {
        level.push(`${current.key}`);
        current = current.forward[i];
      }
      
      console.log(`Level ${i}: ${level.join(' -> ')}`);
    }
  }
}