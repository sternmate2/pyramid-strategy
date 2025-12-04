const { Pool } = require('pg')
const config = require('../config')

const pool = new Pool({
    host: config.DATABASE.host,
    port: config.DATABASE.port,
    database: config.DATABASE.database,
    user: config.DATABASE.user,
    password: config.DATABASE.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
})

const query = async (text, params) => {
    const start = Date.now()
    try {
        const res = await pool.query(text, params)
        const duration = Date.now() - start
        console.log('Executed query', { text, duration, rows: res.rowCount })
        return res
    } catch (error) {
        console.error('Database query error', { text, error: error.message })
        throw error
    }
}

module.exports = { query, pool }




