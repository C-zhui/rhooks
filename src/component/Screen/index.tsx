import React, { CSSProperties, FC, ReactNode, useState } from 'react';
import { useDebounce, useWindowSize } from 'react-use';

export const SCREEN_WIDTH = 1920;
export const SCREEN_HEIGHT = 1080;

const ScreenAdapter: FC<{ style?: CSSProperties, children?: ReactNode }> = ({ style, children }) => {
  const { width, height } = useWindowSize();
  const getScale = () => {
    const w = window.innerWidth / SCREEN_WIDTH;
    const h = window.innerHeight / SCREEN_HEIGHT;
    const scale = w < h ? w : h;
    return scale;
  };
  const [scale, setScale] = useState(getScale);

  useDebounce(
    () => {
      setScale(getScale());
    },
    200,
    [width, height],
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        minHeight: '100%',
        maxHeight: '100vh',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          transition: 'transform .3s linear',
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: '50%',
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          transform: `scale(${scale}) translate(-50%, 0)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScreenAdapter;
