export class Logger {
  private static secrets: Set<string> = new Set();

  static addSecret(secret: string) {
    if (secret && secret.length > 3) {
      this.secrets.add(secret);
    }
  }

  static mask(value: unknown): unknown {
    if (typeof value === 'string') {
      let masked = value;
      for (const secret of this.secrets) {
        masked = masked.split(secret).join('***');
      }
      return masked;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.mask(item));
    }

    if (typeof value === 'object' && value !== null) {
      const maskedObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        maskedObj[k] = this.mask(v);
      }
      return maskedObj;
    }

    return value;
  }

  static log(message: string, ...args: unknown[]) {
    const maskedArgs = args.map(arg => this.mask(arg));
    console.log(this.mask(message), ...maskedArgs);
  }

  static error(message: string, ...args: unknown[]) {
    const maskedArgs = args.map(arg => this.mask(arg));
    console.error(this.mask(message), ...maskedArgs);
  }

  static debug(message: string, ...args: unknown[]) {
    if (process.env.DEBUG === 'true') {
      const maskedArgs = args.map(arg => this.mask(arg));
      console.log(`[DEBUG] ${this.mask(message)}`, ...maskedArgs);
    }
  }

  static warn(message: string, ...args: unknown[]) {
    const maskedArgs = args.map(arg => this.mask(arg));
    console.warn(this.mask(message), ...maskedArgs);
  }

  static debugProvider(providerId: string, direction: 'REQUEST' | 'RESPONSE', data: unknown) {
    this.debug(`[${providerId}] ${direction}:`, data);
  }
}
