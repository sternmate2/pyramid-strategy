/**
 * Global error handling middleware
 */

const { StatusCodes } = require('http-status-codes')
const logger = require('../utils/logger')
const { ApiResponse } = require('../constants/apiResponses')

/**
 * Global error handler middleware
 */
const errorHandler = (error, req, res, next) => {
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  // Default error response
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR
  let message = 'Internal server error'
  let details = null

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST
    message = 'Validation error'
    details = error.message
  } else if (error.name === 'CastError') {
    statusCode = StatusCodes.BAD_REQUEST
    message = 'Invalid data format'
    details = error.message
  } else if (error.code === '23505') { // PostgreSQL unique violation
    statusCode = StatusCodes.CONFLICT
    message = 'Resource already exists'
  } else if (error.code === '23503') { // PostgreSQL foreign key violation
    statusCode = StatusCodes.BAD_REQUEST
    message = 'Referenced resource not found'
  } else if (error.code === '23502') { // PostgreSQL not null violation
    statusCode = StatusCodes.BAD_REQUEST
    message = 'Required field missing'
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = StatusCodes.SERVICE_UNAVAILABLE
    message = 'External service unavailable'
  } else if (error.code === 'ETIMEDOUT') {
    statusCode = StatusCodes.REQUEST_TIMEOUT
    message = 'Request timeout'
  } else if (error.statusCode || error.status) {
    statusCode = error.statusCode || error.status
    message = error.message
  }

  // Send error response
  const response = ApiResponse.error(message, details)

  // Add additional error details in development
  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      stack: error.stack,
      name: error.name,
      code: error.code
    }
  }

  res.status(statusCode).json(response)
}

/**
 * Handle 404 errors for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`)
  error.statusCode = StatusCodes.NOT_FOUND
  next(error)
}

/**
 * Async error wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
}