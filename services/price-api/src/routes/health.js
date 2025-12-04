/**
 * Health check routes
 */

const express = require('express')
const router = express.Router()
const healthController = require('../controllers/healthController')

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API and its dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 service:
 *                   type: string
 *                   example: stock-price-api
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 dependencies:
 *                   type: object
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', healthController.healthCheck)

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Returns detailed health information including database and cache status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health information
 */
router.get('/detailed', healthController.detailedHealthCheck)

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: Returns whether the service is ready to accept requests
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', healthController.readinessCheck)

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     description: Returns whether the service is alive
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', healthController.livenessCheck)

module.exports = router