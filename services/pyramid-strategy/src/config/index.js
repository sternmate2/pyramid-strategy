const config = {
    PORT: process.env.PORT || 3003,

    DATABASE: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'stock_anomaly',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password'
    },

    REDIS: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || 'redis_password'
    },

    STRATEGY: {
        // Level configuration
        levelsBelow: 10,  // 10 levels below highest price
        levelsAbove: 10,  // 10 levels above highest price
        levelIncrement: 0.03, // 3% increment per level

        // Buy/Sell configuration
        baseDollarAmount: 3000, // Base dollar amount for first buy
        dollarIncrement: 3000,  // Dollar increment for subsequent buys
        sellThresholdCents: 14, // 14 cents below level above

        // Cooldown
        cooldownMinutes: 30
    },

    CIRCUIT_BREAKER: {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
    },

    CORS: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
    }
}

module.exports = config




