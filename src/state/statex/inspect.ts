import { StateX } from './statex';
import { Logger } from '../misc/logger';
import { EffectX } from '../effectx';

const inspectLogger = new Logger('Inspect StateX');
export function InspectLogger() {
  const subp = new EffectX();

  subp.attachEffect(
    // Model 注册事件
    StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.register].subscribe(
      ({ data: Cls }: { data: typeof StateX<any, any, any> }) => {
        inspectLogger.log('register model', Cls.stateName, Cls);

        subp.attachEffect(
          Cls.getAggregateEvent(Cls)[StateX.LIFE_CYCLE_EVENT.afterCreate].subscribe(({ id, data }) => {
            inspectLogger.log(`${Cls.stateName}'s instance (${id}) [created]`, data);
          })
        );
        subp.attachEffect(
          Cls.getAggregateEvent(Cls)[StateX.LIFE_CYCLE_EVENT.afterDestroy].subscribe(({ id, data }) => {
            inspectLogger.log(`${Cls.stateName}'s instance (${id}) [destroyed]`, data);
          })
        );
        subp.attachEffect(
          Cls.getAggregateEvent(Cls)[StateX.LIFE_CYCLE_EVENT.instanceUpdate].subscribe(
            ({ id, data: keys }) => {
              inspectLogger.log(
                `${Cls.stateName}'s instance (${id}) [updated], keys`,
                `[${keys.join(',')}]`,
                '|',
                Cls.getInstanceOf(Cls, id)?.state
              );
            }
          )
        );
      }
    )
  );

  subp.attachEffect(
    StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.addAggragateAction].subscribe(
      ({ id: stateName, data: { actionName } }) => {
        const Cls = StateX.SubClassMap.get(stateName);
        if (!Cls) {
          return;
        }
        subp.attachEffect(
          Cls.getAggregateAction(Cls)[actionName].subscribe(({ id: instanceId, data: actionData }) => {
            inspectLogger.log(
              `${Cls.stateName}'s instance (${instanceId}) receive [action] (${actionName}), payload `,
              actionData
            );
          })
        );
      }
    )
  );

  subp.attachEffect(
    StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.addAggragateEvent].subscribe(
      ({ id: stateName, data: { eventName } }) => {
        const Cls = StateX.SubClassMap.get(stateName);
        if (!Cls) {
          return;
        }
        subp.attachEffect(
          Cls.getAggregateEvent(Cls)[eventName].subscribe(({ id: instanceId, data: eventData }) => {
            inspectLogger.log(
              `${Cls.stateName}'s instance (${instanceId}) emit [event] (${eventName}), event `,
              eventData
            );
          })
        );
      }
    )
  );

  return () => {
    subp.clean();
  };
}

type InspectCallbackTypes = {
  onModelRegister: (d: { Model: typeof StateX }) => void;
  onInstanceCreated: (d: { Model: typeof StateX; instanceId: string; object: StateX }) => void;
  onInstanceUpdate: (d: {
    Model: typeof StateX;
    instanceId: string;
    object: StateX;
    data: any;
    keys: string[];
  }) => void;
  onInstanceDestroyed: (d: { Model: typeof StateX; instanceId: string; object: StateX }) => void;
  onAction: (d: {
    Model: typeof StateX;
    instanceId: string;
    object: StateX;
    actionName: string;
    actionData: any;
  }) => void;
  onEvent: (d: {
    Model: typeof StateX;
    instanceId: string;
    object: StateX;
    eventName: string;
    eventData: any;
  }) => void;
};

export function InspectCallback({
  onModelRegister,
  onInstanceCreated,
  onInstanceUpdate,
  onInstanceDestroyed,
  onAction,
  onEvent
}: InspectCallbackTypes) {
  const subp = new EffectX();

  subp.attachEffect(
    // Model 注册事件
    StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.register].subscribe(
      ({ data: Cls }: { data: typeof StateX<any, any, any> }) => {
        onModelRegister({ Model: Cls });

        subp.attachEffect(
          Cls.getAggregateEvent(Cls)[StateX.LIFE_CYCLE_EVENT.afterCreate].subscribe(({ id, data }) => {
            onInstanceCreated({ Model: Cls, instanceId: id, object: data });
          })
        );
        subp.attachEffect(
          Cls.getAggregateEvent(Cls)[StateX.LIFE_CYCLE_EVENT.afterDestroy].subscribe(({ id, data }) => {
            onInstanceDestroyed({ Model: Cls, instanceId: id, object: data });
          })
        );
        subp.attachEffect(
          Cls.getAggregateEvent(Cls)[StateX.LIFE_CYCLE_EVENT.instanceUpdate].subscribe(
            ({ id, data: keys }) => {
              const obj = Cls.getInstanceOf(Cls, id);
              if (!obj) {
                return;
              }
              onInstanceUpdate({
                Model: Cls,
                instanceId: id,
                object: obj,
                keys,
                data: obj.state
              });
            }
          )
        );
      }
    )
  );

  subp.attachEffect(
    StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.addAggragateAction].subscribe(
      ({ id: stateName, data: { actionName } }) => {
        const Cls = StateX.SubClassMap.get(stateName);
        if (!Cls) {
          return;
        }
        subp.attachEffect(
          Cls.getAggregateAction(Cls)[actionName].subscribe(({ id: instanceId, data: actionData }) => {
            const obj = Cls.getInstanceOf(Cls, instanceId);
            if (!obj) {
              return;
            }
            onAction({
              Model: Cls,
              instanceId,
              actionName,
              actionData,
              object: obj
            });
          })
        );
      }
    )
  );

  subp.attachEffect(
    StateX.getAggregateEvent(StateX)[StateX.LIFE_CYCLE_EVENT.addAggragateEvent].subscribe(
      ({ id: stateName, data: { eventName } }) => {
        const Cls = StateX.SubClassMap.get(stateName);
        if (!Cls) {
          return;
        }
        subp.attachEffect(
          Cls.getAggregateEvent(Cls)[eventName].subscribe(({ id: instanceId, data: eventData }) => {
            const obj = Cls.getInstanceOf(Cls, instanceId);
            if (!obj) {
              return;
            }
            onEvent({
              Model: Cls,
              instanceId,
              eventName,
              eventData,
              object: obj
            });
          })
        );
      }
    )
  );

  return () => {
    subp.clean();
  };
}
