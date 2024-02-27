import * as r from "@vue/reactivity";

const api = {
  ...r,
};

export type vrType = typeof api;

export { api as reactiveApi };
