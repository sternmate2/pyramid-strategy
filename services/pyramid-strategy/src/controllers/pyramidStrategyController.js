const PyramidStrategyService = require('../services/pyramidStrategyService')
const logger = require('../utils/logger')

// Create service instance
const pyramidStrategyService = new PyramidStrategyService()

// Initialize the service
pyramidStrategyService.initialize().catch(error => {
    logger.error('Failed to initialize pyramid strategy service', { error: error.message })
})

class PyramidStrategyController {
    /**
     * Get strategy status for a symbol
     */
    async getStrategyStatus(req, res) {
        try {
            const { symbol } = req.params
            const status = await pyramidStrategyService.getStrategyStatus(symbol)

            res.json({
                success: true,
                data: status
            })
        } catch (error) {
            logger.error('Error getting strategy status', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to get strategy status'
            })
        }
    }

    /**
     * Get all levels
     */
    async getAllLevels(req, res) {
        try {
            const levels = pyramidStrategyService.levelService.getAllLevels()

            res.json({
                success: true,
                data: levels
            })
        } catch (error) {
            logger.error('Error getting all levels', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to get levels'
            })
        }
    }

    /**
     * Get level configuration
     */
    async getLevelConfig(req, res) {
        try {
            const config = pyramidStrategyService.getLevelConfig()

            res.json({
                success: true,
                data: config
            })
        } catch (error) {
            logger.error('Error getting level config', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to get level configuration'
            })
        }
    }

    /**
     * Get position configuration
     */
    async getPositionConfig(req, res) {
        try {
            const config = pyramidStrategyService.getPositionConfig()

            res.json({
                success: true,
                data: config
            })
        } catch (error) {
            logger.error('Error getting position config', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to get position configuration'
            })
        }
    }

    /**
     * Get positions for a symbol
     */
    async getPositions(req, res) {
        try {
            const { symbol } = req.params
            const positions = await pyramidStrategyService.positionService.getPositions(symbol)

            res.json({
                success: true,
                data: positions
            })
        } catch (error) {
            logger.error('Error getting positions', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to get positions'
            })
        }
    }

    /**
     * Get position statistics for a symbol
     */
    async getPositionStats(req, res) {
        try {
            const { symbol } = req.params
            const stats = await pyramidStrategyService.positionService.getPositionStats(symbol)

            res.json({
                success: true,
                data: stats
            })
        } catch (error) {
            logger.error('Error getting position stats', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to get position statistics'
            })
        }
    }

    /**
     * Reset strategy for a symbol
     */
    async resetStrategy(req, res) {
        try {
            const { symbol } = req.params
            await pyramidStrategyService.resetStrategy(symbol)

            res.json({
                success: true,
                message: `Strategy reset for ${symbol}`
            })
        } catch (error) {
            logger.error('Error resetting strategy', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to reset strategy'
            })
        }
    }

    /**
     * Enable test mode (prevents level recalculation)
     */
    async enableTestMode(req, res) {
        try {
            pyramidStrategyService.levelService.enableTestMode()
            res.json({
                success: true,
                message: 'Test mode enabled - levels will still recalculate on new highs'
            })
        } catch (error) {
            logger.error('Error enabling test mode', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to enable test mode'
            })
        }
    }

    /**
     * Disable test mode (allows level recalculation)
     */
    async disableTestMode(req, res) {
        try {
            pyramidStrategyService.levelService.disableTestMode()
            res.json({
                success: true,
                message: 'Test mode disabled - levels will be recalculated normally'
            })
        } catch (error) {
            logger.error('Error disabling test mode', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to disable test mode'
            })
        }
    }

    /**
     * Test single price update
     */
    async testPriceUpdate(req, res) {
        try {
            const { symbol, price } = req.body

            if (!symbol || !price) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol and price are required'
                })
            }

            await pyramidStrategyService.processPriceUpdate(symbol, price)

            res.json({
                success: true,
                message: `Price update processed for ${symbol} at $${price}`,
                data: {
                    symbol,
                    price,
                    timestamp: new Date().toISOString()
                }
            })
        } catch (error) {
            logger.error('Error in test price update', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to process price update'
            })
        }
    }

    /**
     * Test reset with custom highest price
     */
    async testReset(req, res) {
        try {
            const { highestPrice, symbol = 'SPXL' } = req.body

            if (!highestPrice) {
                return res.status(400).json({
                    success: false,
                    error: 'highestPrice is required'
                })
            }

            logger.info('Test reset called', { highestPrice, symbol })

            // Reset strategy state
            await pyramidStrategyService.resetStrategy(symbol)

            // Set custom highest price for test mode
            logger.info('Calling setHighestPriceForTest', { highestPrice })
            pyramidStrategyService.levelService.setHighestPriceForTest(highestPrice)

            // Verify it was set
            const currentHighest = pyramidStrategyService.levelService.highestPrice
            logger.info('Highest price after setting', { currentHighest })

            res.json({
                success: true,
                message: 'Strategy reset for test',
                data: {
                    symbol,
                    highestPrice,
                    currentHighest,
                    timestamp: new Date().toISOString()
                }
            })
        } catch (error) {
            logger.error('Error in test reset', { error: error.message, stack: error.stack })
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            })
        }
    }

    /**
     * Test complete scenario
     */
    async testScenario(req, res) {
        try {
            const { symbol, scenario } = req.body

            if (!symbol || !scenario || !Array.isArray(scenario)) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol and scenario array are required'
                })
            }

            const results = []

            for (const step of scenario) {
                const { price, description, delay = 0 } = step

                // Add delay if specified
                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay))
                }

                await pyramidStrategyService.processPriceUpdate(symbol, price)

                results.push({
                    price,
                    description,
                    timestamp: new Date().toISOString()
                })
            }

            res.json({
                success: true,
                message: `Scenario completed for ${symbol}`,
                data: {
                    symbol,
                    results,
                    finalStatus: await pyramidStrategyService.getStrategyStatus(symbol)
                }
            })
        } catch (error) {
            logger.error('Error in test scenario', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to process scenario'
            })
        }
    }

    /**
     * Get accumulated units for a symbol
     */
    async getAccumulatedUnits(req, res) {
        try {
            const { symbol } = req.params

            if (!symbol) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol is required'
                })
            }

            const accumulatedUnits = await pyramidStrategyService.positionService.getAccumulatedUnits(symbol)
            const summary = await pyramidStrategyService.positionService.getAccumulationSummary(symbol)

            res.json({
                success: true,
                data: {
                    symbol,
                    accumulatedUnits,
                    summary: {
                        totalRecords: parseInt(summary.total_records) || 0,
                        totalUnits: parseInt(summary.total_units) || 0,
                        totalValue: parseFloat(summary.total_value) || 0,
                        averageBuyPrice: parseFloat(summary.average_buy_price) || 0
                    }
                }
            })
        } catch (error) {
            logger.error('Error getting accumulated units', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to get accumulated units'
            })
        }
    }

    /**
     * Get accumulated units for a specific level
     */
    async getAccumulatedUnitsForLevel(req, res) {
        try {
            const { symbol, level } = req.params

            if (!symbol || !level) {
                return res.status(400).json({
                    success: false,
                    error: 'Symbol and level are required'
                })
            }

            const accumulatedUnits = await pyramidStrategyService.positionService.getAccumulatedUnitsForLevel(symbol, parseInt(level))

            res.json({
                success: true,
                data: {
                    symbol,
                    level: parseInt(level),
                    accumulatedUnits
                }
            })
        } catch (error) {
            logger.error('Error getting accumulated units for level', { error: error.message })
            res.status(500).json({
                success: false,
                error: 'Failed to get accumulated units for level'
            })
        }
    }

    /**
     * Health check
     */
    async healthCheck(req, res) {
        res.json({
            success: true,
            service: 'pyramid-strategy',
            status: 'healthy',
            timestamp: new Date().toISOString()
        })
    }
}

module.exports = new PyramidStrategyController()


