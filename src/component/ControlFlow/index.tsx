import { isFunction } from "lodash-es";
import React, { FC, ReactElement } from "react";

export const IfThen = (props: {
  condition?: boolean;
  then: ReactElement | (() => ReactElement);
  else?: ReactElement | (() => ReactElement);
}) => {
  if (props.condition) {
    return isFunction(props.then) ? props.then() : props.then;
  }
  return isFunction(props.else) ? props.else() : (props.else ?? null);
};

export const SwitchCase = (props: {
  conditions: [
    boolean | (() => boolean),
    ReactElement | (() => ReactElement),
  ][];
}) => {
  const { conditions } = props;
  for (const item of conditions) {
    const [condition, then] = item;
    if (isFunction(condition) ? condition() : condition) {
      return isFunction(then) ? then() : then;
    }
  }
  return null;
};

export const ForList = <T,>(props: {
  list: T[];
  getKey?: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactElement;
}) => {
  const { list, getKey, renderItem } = props;

  return (
    <>
      {list.map((item, index) =>
        React.cloneElement(renderItem(item, index), {
          key: getKey ? getKey(item, index) : index,
        }),
      )}
    </>
  );
};
