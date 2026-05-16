export class Logger {
  private static secrets: Set<string> = new Set();

  static addSecret(secret: string) {
    if (secret && secret.length > 3) {
      this.secrets.add(secret);
    }
  }

  static mask(text: string): string {
    let masked = text;
    for (const secret of this.secrets) {
      masked = masked.split(secret).join('***');
    }
    return masked;
  }

  static log(message: string, ...args: any[]) {
    const maskedArgs = args.map(arg => 
      typeof arg === 'string' ? this.mask(arg) : arg
    );
    console.log(this.mask(message), ...maskedArgs);
  }

  static error(message: string, ...args: any[]) {
    const maskedArgs = args.map(arg => 
      typeof arg === 'string' ? this.mask(arg) : arg
    );
    console.error(this.mask(message), ...maskedArgs);
  }

  static debug(message: string, ...args: any[]) {
    if (process.env.DEBUG === 'true') {
      this.log(`[DEBUG] ${message}`, ...args);
    }
  }
}
