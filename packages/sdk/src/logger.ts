export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void
  warn(message: string, fields?: Record<string, unknown>): void
  error(message: string, fields?: Record<string, unknown>): void
}

export function createLogger(scope = 'omniquant-agent'): Logger {
  const write = (level: string, message: string, fields?: Record<string, unknown>) => {
    const suffix = fields ? ` ${JSON.stringify(fields)}` : ''
    console.error(`[${scope}] ${level} ${message}${suffix}`)
  }
  return {
    info: (message, fields) => write('INFO', message, fields),
    warn: (message, fields) => write('WARN', message, fields),
    error: (message, fields) => write('ERROR', message, fields),
  }
}
