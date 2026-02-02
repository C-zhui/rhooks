import { describe, it, expect, afterEach } from "vitest";
import createModel, { clearAll, SET_STATE } from "./rstate";

describe("rstate 状态管理库", () => {
  // 测试后清理所有模型实例
  afterEach(() => {
    clearAll();
  });

  describe("模型创建和销毁", () => {
    it("应该能够创建模型", async () => {
      const model = createModel({
        name: "TestModel",
        initState: () => ({ count: 0 }),
      });
      expect(model).toBeDefined();
      expect(model.name).toBe("TestModel");
      expect(model._id).toBeTypeOf("string");
    });
  });

  describe("模型实例创建", () => {
    const model = createModel({
      name: "TestModel",
      initState: () => ({ count: 0 }),
    });

    it("应该能够设置和获取模型状态", async () => {
      const instance = model.create("instance1", {});
      await instance.inited;
      expect(instance).toBeDefined();
      expect(instance.id).toBe("instance1");
      expect(instance.getState()).toEqual({ count: 0 });
      await instance[SET_STATE]({ count: 1 });
      expect(instance.getState()).toEqual({ count: 1 });
      await instance[SET_STATE]((s) => ({
        count: s.count + 1,
      }));
      expect(instance.getState()).toEqual({ count: 2 });
    });

    const model2 = createModel({
      name: "TestModel",
      initState: () => ({ count: 0 }),
      hook: (api) => {
        const { state } = api;
        return {
          double: state.count * 2,
        };
      },
    });

    it("应该能够设置和获取计算属性", async () => {
      const instance = model2.create("instance1", {});
      await instance.inited;
      expect(instance).toBeDefined();
      expect(instance.id).toBe("instance1");
      expect(instance.getHookState()).toEqual({ count: 0, double: 0 });
      await instance[SET_STATE]({ count: 1 });
      expect(instance.getHookState()).toEqual({ count: 1, double: 2 });
      await instance[SET_STATE]((s) => ({
        count: s.count + 1,
      }));
      expect(instance.getHookState()).toEqual({ count: 2, double: 4 });
    });

    it("应该能够获取子实例", async () => {
      const instance = model.create("instance1", {});
      await instance.inited;
      const child = model.create("child1", {}, instance);
      const child2 = model.create("child2", {}, instance);
      await child.inited;
      await child2.inited;

      expect(instance.getChildren(model)).toEqual([child, child2]);
    });

    it("应该能够移除子实例", async () => {
      const instance = model.create("instance1", {});
      await instance.inited;
      const child = model.create("child1", {}, instance);
      const child2 = model.create("child2", {}, instance);
      await child.inited;
      await child2.inited;

      instance.removeChildren(model, child.id);
      expect(instance.getChildren(model)).toEqual([child2]);
      instance.removeAllChildren();
      expect(instance.getChildren(model)).toEqual([]);
    });

    it("应该能够销毁子实例来实现移除子实例", async () => {
      const instance = model.create("instance1", {});
      await instance.inited;
      const child = model.create("child1", {}, instance);
      const child2 = model.create("child2", {}, instance);
      await child.inited;
      await child2.inited;

      child.destroy();
      expect(instance.getChildren(model)).toEqual([child2]);
      child2.destroy();
      expect(instance.getChildren(model)).toEqual([]);
    });

    it("应该能够销毁实例来实现移除子实例", async () => {
      const instance = model.create("instance1", {});
      await instance.inited;
      const child = model.create("child1", {}, instance);
      const child2 = model.create("child2", {}, instance);
      await child.inited;
      await child2.inited;

      instance.destroy();
      expect(instance.getChildren(model)).toEqual([]);
    });
  });
});
