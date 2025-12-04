const express = require('express')
const pyramidStrategyController = require('../controllers/pyramidStrategyController')

const router = express.Router()

// Health check
router.get('/health', pyramidStrategyController.healthCheck)

// Configuration endpoints
router.get('/config/levels', pyramidStrategyController.getLevelConfig)
router.get('/config/positions', pyramidStrategyController.getPositionConfig)

// Level endpoints
router.get('/levels', pyramidStrategyController.getAllLevels)

// Test mode endpoints
router.post('/test/enable', pyramidStrategyController.enableTestMode)
router.post('/test/disable', pyramidStrategyController.disableTestMode)

// Test endpoints
router.post('/test/reset', pyramidStrategyController.testReset)
router.post('/test/price-update', pyramidStrategyController.testPriceUpdate)
router.post('/test/scenario', pyramidStrategyController.testScenario)

// Strategy endpoints
router.get('/:symbol/status', pyramidStrategyController.getStrategyStatus)
router.get('/:symbol/positions', pyramidStrategyController.getPositions)
router.get('/:symbol/stats', pyramidStrategyController.getPositionStats)
router.post('/:symbol/reset', pyramidStrategyController.resetStrategy)

// Accumulation endpoints
router.get('/:symbol/accumulation', pyramidStrategyController.getAccumulatedUnits)
router.get('/:symbol/accumulation/:level', pyramidStrategyController.getAccumulatedUnitsForLevel)

// Webhook endpoints for notifications (placeholder for future implementation)
// router.get('/webhook/notifications', pyramidStrategyController.getNotifications)
// router.post('/webhook/notifications', pyramidStrategyController.getNotifications)

// Webhook endpoint for broker integration (placeholder for future implementation)
// router.post('/webhook/broker', pyramidStrategyController.triggerBrokerWebhook)

module.exports = router


