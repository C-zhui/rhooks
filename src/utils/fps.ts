export const createIdleMonitor = () => {
  let timer = null as any;
  let count = 0;
  let lastTime = performance.now();
  let tickCnt = 0;
  let status = "stop";

  return {
    onTick: (info: { tickCnt: number; status: string; score: number }) => {},
    fpsLoop() {
      timer = setTimeout(() => {
        count++;
        const now = performance.now();
        const delta = now - lastTime;
        if (delta >= 1000) {
          tickCnt = tickCnt / 3 + ((count * 1000) / delta / 3) * 2;
          count = 0;
          lastTime = now;
          if (this.onTick) {
            const info = {
              tickCnt,
              status,
              score: Math.min((tickCnt / 180) * 100, 100),
            };
            this.onTick(info);
          }
        }
        this.fpsLoop();
      }, 5);
    },
    getFps() {
      return { tickCnt, status, score: Math.min((tickCnt / 180) * 100, 100) };
    },
    start() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      status = "running";
      lastTime = performance.now();
      this.fpsLoop();
    },
    stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      status = "stop";
    },
  };
};

export const idleMonitor = createIdleMonitor();
