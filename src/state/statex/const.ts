/**
 * @description 更新模式
 */
export enum EventEmitMode {
  async = 'async',
  sync = 'sync'
}

/**
 * @description 生命周期
 */
export const LIFE_CYCLE_EVENT = {
  // Model 注册，在 StateX 上
  register: Symbol(),

  // Model 聚合事件注册，在 StateX 上
  addAggragateEvent: Symbol(),
  addAggragateAction: Symbol(),

  // 各 Model 的实例事件，在 Model 上
  instanceUpdate: Symbol(),
  afterCreate: Symbol(),
  afterDestroy: Symbol()
};
