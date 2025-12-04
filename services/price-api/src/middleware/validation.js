/**
 * Request validation middleware
 */

const Joi = require('joi')
const { StatusCodes } = require('http-status-codes')
const { ApiResponse } = require('../constants/apiResponses')

/**
 * Symbol validation schema
 */
const symbolSchema = Joi.string()
  .alphanum()
  .min(1)
  .max(10)
  .uppercase()
  .required()

/**
 * Historical query validation schema
 */
const historyQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
  interval: Joi.string().valid('1d', '1w', '1m').default('1d')
})

/**
 * Bulk prices request validation schema
 */
const bulkPricesSchema = Joi.object({
  symbols: Joi.array()
    .items(Joi.string().alphanum().min(1).max(10).uppercase())
    .min(1)
    .max(50)
    .required()
})

/**
 * Validate stock symbol parameter
 */
const validateSymbol = (req, res, next) => {
  const { error, value } = symbolSchema.validate(req.params.symbol)
  
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST)
      .json(ApiResponse.error('Invalid symbol', error.details[0].message))
  }
  
  req.params.symbol = value
  next()
}

/**
 * Validate historical prices query parameters
 */
const validateHistoryQuery = (req, res, next) => {
  const { error, value } = historyQuerySchema.validate(req.query)
  
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST)
      .json(ApiResponse.error('Invalid query parameters', error.details[0].message))
  }
  
  req.query = { ...req.query, ...value }
  next()
}

/**
 * Validate bulk prices request body
 */
const validateBulkPricesRequest = (req, res, next) => {
  const { error, value } = bulkPricesSchema.validate(req.body)
  
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST)
      .json(ApiResponse.error('Invalid request body', error.details[0].message))
  }
  
  req.body = value
  next()
}

/**
 * Generic validation middleware factory
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property])
    
    if (error) {
      return res.status(StatusCodes.BAD_REQUEST)
        .json(ApiResponse.error('Validation error', error.details[0].message))
    }
    
    req[property] = value
    next()
  }
}

module.exports = {
  validateSymbol,
  validateHistoryQuery,
  validateBulkPricesRequest,
  validate,
  schemas: {
    symbol: symbolSchema,
    historyQuery: historyQuerySchema,
    bulkPrices: bulkPricesSchema
  }
}