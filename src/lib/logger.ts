/**
 * Strukturiertes Logging-System für Development
 * Gibt formatierte Logs mit Zeitstempel, Level und Kontext aus
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  component?: string
  action?: string
  data?: unknown
}

class Logger {
  private isDevelopment = import.meta.env.DEV

  private formatTimestamp(): string {
    const now = new Date()
    return now.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp()
    const levelEmoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }

    let formatted = `[${timestamp}] ${levelEmoji[level]} ${level.toUpperCase()}`

    if (context?.component) {
      formatted += ` [${context.component}]`
    }

    if (context?.action) {
      formatted += ` ${context.action}:`
    }

    formatted += ` ${message}`

    return formatted
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.isDevelopment) return

    const formatted = this.formatMessage(level, message, context)

    switch (level) {
      case 'debug':
        console.log(formatted, context?.data || '')
        break
      case 'info':
        console.info(formatted, context?.data || '')
        break
      case 'warn':
        console.warn(formatted, context?.data || '')
        break
      case 'error':
        console.error(formatted, context?.data || '')
        break
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context)
  }

  // Spezielle Methoden für häufige Use Cases
  apiCall(endpoint: string, method: string, data?: unknown): void {
    this.info(`API Call: ${method} ${endpoint}`, {
      component: 'API',
      data
    })
  }

  apiResponse(endpoint: string, status: number, data?: unknown): void {
    const level = status >= 400 ? 'error' : 'info'
    this.log(level, `API Response: ${endpoint} (${status})`, {
      component: 'API',
      data
    })
  }

  stateChange(component: string, state: string, value: unknown): void {
    this.debug(`State Change: ${state}`, {
      component,
      data: value
    })
  }

  userAction(component: string, action: string, details?: unknown): void {
    this.info(`User Action: ${action}`, {
      component,
      data: details
    })
  }

  storageOperation(operation: string, key: string, data?: unknown): void {
    this.debug(`Storage ${operation}: ${key}`, {
      component: 'LocalStorage',
      data
    })
  }
}

export const logger = new Logger()
