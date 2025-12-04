/**
 * Logging utility using Winston
 */

const winston = require('winston')
const config = require('./config')

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(colors)

// Create logger format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    if (info.stack) {
      return `${info.timestamp} ${info.level}: ${info.message}\n${info.stack}`
    }
    return `${info.timestamp} ${info.level}: ${info.message}`
  }),
)

// JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Create transports array
const transports = []

// Console transport
if (config.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: format
    })
  )
} else {
  transports.push(
    new winston.transports.Console({
      format: jsonFormat
    })
  )
}

// File transport for errors
transports.push(
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: jsonFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  })
)

// File transport for all logs
transports.push(
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: jsonFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  })
)

// Create logger instance
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels,
  transports,
  exitOnError: false
})

// Stream for morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim())
  }
}

module.exports = logger