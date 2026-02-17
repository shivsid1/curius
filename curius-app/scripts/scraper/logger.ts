type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'PROG';

function formatTime(): string {
  return new Date().toISOString().substring(11, 19);
}

function log(level: LogLevel, message: string, data?: object): void {
  const prefix = `[${formatTime()}] [${level}]`;
  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const Logger = {
  info(message: string, data?: object): void {
    log('INFO', message, data);
  },

  warn(message: string, data?: object): void {
    log('WARN', message, data);
  },

  error(message: string, error?: Error, data?: object): void {
    const errorData = error ? { error: error.message, ...data } : data;
    log('ERROR', message, errorData);
  },

  progress(current: number, total: number, message: string): void {
    const percent = ((current / total) * 100).toFixed(1);
    const bar = generateProgressBar(current, total);
    process.stdout.write(`\r[${formatTime()}] [PROG] ${bar} ${current}/${total} (${percent}%) ${message}`);
  },

  progressLine(current: number, total: number, message: string): void {
    const percent = ((current / total) * 100).toFixed(1);
    console.log(`[${formatTime()}] [PROG] ${current}/${total} (${percent}%) ${message}`);
  },

  newLine(): void {
    console.log('');
  }
};

function generateProgressBar(current: number, total: number, width: number = 20): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}
