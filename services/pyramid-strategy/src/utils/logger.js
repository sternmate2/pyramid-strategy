const winston = require('winston')

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'pyramid-strategy' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
})

// Helper methods
logger.logNotification = (type, symbol, data) => {
    logger.info('Notification', {
        type,
        symbol,
        ...data,
        timestamp: new Date().toISOString()
    })
}

logger.logPosition = (action, symbol, data) => {
    logger.info('Position', {
        action,
        symbol,
        ...data,
        timestamp: new Date().toISOString()
    })
}

module.exports = logger




