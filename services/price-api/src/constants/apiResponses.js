/**
 * Standardized API response formats
 */

const { StatusCodes } = require('http-status-codes')

class ApiResponse {
  /**
   * Success response
   */
  static success(data, message = 'Success') {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Error response
   */
  static error(message, details = null, code = null) {
    const response = {
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    }

    if (details) {
      response.details = details
    }

    if (code) {
      response.code = code
    }

    return response
  }

  /**
   * Validation error response
   */
  static validationError(errors) {
    return {
      success: false,
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Paginated response
   */
  static paginated(data, pagination) {
    return {
      success: true,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit)
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Not found response
   */
  static notFound(resource = 'Resource') {
    return ApiResponse.error(`${resource} not found`, null, 'NOT_FOUND')
  }

  /**
   * Unauthorized response
   */
  static unauthorized(message = 'Unauthorized access') {
    return ApiResponse.error(message, null, 'UNAUTHORIZED')
  }

  /**
   * Forbidden response
   */
  static forbidden(message = 'Access forbidden') {
    return ApiResponse.error(message, null, 'FORBIDDEN')
  }

  /**
   * Rate limit exceeded response
   */
  static rateLimitExceeded(retryAfter = null) {
    const response = ApiResponse.error(
      'Rate limit exceeded',
      'Too many requests. Please try again later.',
      'RATE_LIMIT_EXCEEDED'
    )

    if (retryAfter) {
      response.retryAfter = retryAfter
    }

    return response
  }

  /**
   * Service unavailable response
   */
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return ApiResponse.error(message, null, 'SERVICE_UNAVAILABLE')
  }
}

module.exports = { ApiResponse }