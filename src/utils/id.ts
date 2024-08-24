export function randomId() {
  return Math.random().toString(16).slice(2);
}

export function timeRandomId() {
  return `${Date.now()}-${randomId()}`;
}
