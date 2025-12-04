/**
 * Swagger/OpenAPI configuration
 */

const swaggerJsdoc = require('swagger-jsdoc')
const config = require('./config')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Stock Price API',
      version: '1.0.0',
      description: 'Real-time stock price data API for anomaly detection system',
      contact: {
        name: 'Stock Anomaly Detection Team',
        email: 'team@stockanomaly.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.API_PORT}`,
        description: 'Development server'
      },
      {
        url: 'https://api.stockanomaly.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints'
      },
      {
        name: 'Prices',
        description: 'Stock price data endpoints'
      },
      {
        name: 'Instruments',
        description: 'Stock instrument metadata endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js'
  ]
}

const specs = swaggerJsdoc(options)

module.exports = specs