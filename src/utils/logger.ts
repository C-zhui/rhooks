// 保存下来，防止 error 和 warn 被线上构建清除
const error = console.error.bind(console);
const warn = console.warn.bind(console);

/** @ignore */
export class Logger {
  prefix: string;
  isEnabled: boolean = true;
  forceEnableLogLevel = false;
  constructor(prefix: string) {
    this.prefix = prefix;
  }

  enable() {
    this.isEnabled = true;
  }
  disable() {
    this.isEnabled = false;
  }

  log(...args: any[]) {
    if (process.env.NODE_ENV === 'development' || this.forceEnableLogLevel) {
      this.isEnabled && console.log(`[${this.prefix}]:`, ...args);
    }
  }

  error(...args: any[]) {
    if (this.isEnabled) {
      error(`[${this.prefix}]: `, ...args);
    }
  }

  warn(...args: any[]) {
    if (this.isEnabled) {
      warn(`[${this.prefix}]: `, ...args);
    }
  }
}
