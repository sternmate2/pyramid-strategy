/**
 * Request logging middleware
 */

const morgan = require('morgan')
const logger = require('../utils/logger')

// Define custom token for response time in different formats
morgan.token('response-time-ms', (req, res) => {
  const responseTime = res.get('X-Response-Time')
  return responseTime ? `${responseTime}ms` : '-'
})

// Custom format for structured logging
morgan.token('user-id', (req, res) => {
  return req.user ? req.user.id : 'anonymous'
})

morgan.token('request-id', (req, res) => {
  return req.id || '-'
})

// Custom format string
const logFormat = process.env.NODE_ENV === 'production'
  ? JSON.stringify({
      method: ':method',
      url: ':url',
      status: ':status',
      contentLength: ':res[content-length]',
      responseTime: ':response-time',
      userAgent: ':user-agent',
      remoteAddr: ':remote-addr',
      userId: ':user-id',
      requestId: ':request-id'
    })
  : ':method :url :status :res[content-length] - :response-time ms'

// Create morgan middleware
const requestLogger = morgan(logFormat, {
  stream: logger.stream,
  skip: (req, res) => {
    // Skip logging for health checks in production
    if (process.env.NODE_ENV === 'production') {
      return req.path === '/health' || req.path.startsWith('/health/')
    }
    return false
  }
})

module.exports = requestLogger