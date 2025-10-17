import PriorityQueue from './index';

test('int queue', () => {
  const q = PriorityQueue((a, b) => a > b, [5, 1, 2, 3, 4, 6]);

  expect(q.pop()).toBe(6);
  expect(q.pop()).toBe(5);
  expect(q.pop()).toBe(4);
  expect(q.pop()).toBe(3);
  expect(q.pop()).toBe(2);
  expect(q.pop()).toBe(1);
  expect(q.pop()).toBe(null);
});
