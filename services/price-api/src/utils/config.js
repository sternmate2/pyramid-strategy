/**
 * Configuration management for the Stock Price API
 */

require('dotenv').config()

const config = {
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Server Configuration
  API_HOST: process.env.API_HOST || '0.0.0.0',
  API_PORT: parseInt(process.env.API_PORT) || 3000,
  
  // CORS Configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:80',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS || 'true',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  RATE_LIMIT_MESSAGE: process.env.RATE_LIMIT_MESSAGE || 'Too many requests, please try again later',
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://stockuser:securepassword123@postgres:5432/stock_anomaly',
  
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://redis:6379',
  REDIS_HOST: process.env.REDIS_HOST || 'redis',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || 'redis_secure_password',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FORMAT: process.env.LOG_FORMAT || 'text',
  
  // Security
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || 'internal-api-key-123',
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
  
  // Metrics
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true' || true,
  
  // API Keys (for external services)
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY || '',
  ALPHAVANTAGE_API_KEY: process.env.ALPHAVANTAGE_API_KEY || ''
}

module.exports = config
