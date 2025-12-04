/**
 * Authentication middleware
 */

const { StatusCodes } = require('http-status-codes')
const config = require('../utils/config')
const logger = require('../utils/logger')
const { ApiResponse } = require('../constants/apiResponses')

/**
 * API Key authentication middleware
 */
const apiKeyAuth = (req, res, next) => {
  // Skip authentication for health checks and public endpoints
  if (req.path === '/health' || req.path.startsWith('/health/')) {
    return next()
  }

  const apiKey = req.headers['x-api-key'] || req.query.api_key

  if (!apiKey) {
    return res.status(StatusCodes.UNAUTHORIZED)
      .json(ApiResponse.error('Authentication required', 'API key is required'))
  }

  // In a real implementation, you would validate the API key against a database
  // For now, we'll use a simple check against an environment variable
  if (config.INTERNAL_API_KEY && apiKey !== config.INTERNAL_API_KEY) {
    logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 8)}...`)
    return res.status(StatusCodes.UNAUTHORIZED)
      .json(ApiResponse.error('Invalid API key', 'The provided API key is invalid'))
  }

  // Add user context to request if needed
  req.user = {
    apiKey: apiKey,
    authenticated: true
  }

  next()
}

/**
 * Optional API key authentication - allows requests without API key but adds user context if present
 */
const optionalApiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key

  if (apiKey && config.INTERNAL_API_KEY && apiKey === config.INTERNAL_API_KEY) {
    req.user = {
      apiKey: apiKey,
      authenticated: true
    }
  } else {
    req.user = {
      authenticated: false
    }
  }

  next()
}

/**
 * JWT authentication middleware (for future use)
 */
const jwtAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(StatusCodes.UNAUTHORIZED)
      .json(ApiResponse.error('Authentication required', 'JWT token is required'))
  }

  try {
    // In a real implementation, you would verify the JWT token
    // const decoded = jwt.verify(token, config.JWT_SECRET)
    // req.user = decoded
    
    // For now, just pass through
    req.user = { authenticated: true }
    next()
  } catch (error) {
    logger.error('JWT authentication error:', error)
    return res.status(StatusCodes.UNAUTHORIZED)
      .json(ApiResponse.error('Invalid token', 'The provided JWT token is invalid'))
  }
}

/**
 * Role-based authorization middleware
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.authenticated) {
      return res.status(StatusCodes.UNAUTHORIZED)
        .json(ApiResponse.error('Authentication required', 'User must be authenticated'))
    }

    if (!req.user.roles || !roles.some(role => req.user.roles.includes(role))) {
      return res.status(StatusCodes.FORBIDDEN)
        .json(ApiResponse.error('Insufficient permissions', 'User does not have required role'))
    }

    next()
  }
}

module.exports = {
  apiKeyAuth,
  optionalApiKeyAuth,
  jwtAuth,
  requireRole
}