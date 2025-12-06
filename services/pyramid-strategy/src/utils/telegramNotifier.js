const logger = require('./logger')

class TelegramNotifier {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN
        this.chatId = process.env.TELEGRAM_CHAT_ID
        this.enabled = !!(this.botToken && this.chatId)
        this.lastSent = 0
        this.minInterval = 1000 // 1 second between messages (rate limit protection)

        if (!this.enabled) {
            logger.warning('Telegram notifications disabled - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID')
        } else {
            logger.info('✅ Telegram notifications enabled')
        }
    }

    /**
     * Send a message to Telegram with timeout and throttling
     * @param {string} message - Message text (supports Markdown)
     */
    async send(message) {
        if (!this.enabled) return

        try {
            // Simple throttle to avoid rate limits
            const now = Date.now()
            if (now - this.lastSent < this.minInterval) {
                await new Promise(r => setTimeout(r, this.minInterval - (now - this.lastSent)))
            }
            this.lastSent = Date.now()

            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`

            // Add timeout to prevent hanging
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000) // 5 second timeout

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: message,
                    parse_mode: 'Markdown'
                }),
                signal: controller.signal
            })

            clearTimeout(timeout)

            if (!response.ok) {
                const error = await response.text()
                logger.error('Telegram notification failed', { error, status: response.status })
            } else {
                logger.debug('Telegram notification sent successfully')
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.error('Telegram notification timed out')
            } else {
                logger.error('Error sending Telegram notification', { error: error.message })
            }
        }
    }

    /**
     * Send BUY notification
     */
    async notifyBuy({ symbol, level, price, units, dollarAmount, sellTriggerPrice, isRebuy, isAnchor }) {
        const action = isRebuy ? '🔄 REBUY' : '🟢 BUY'
        const anchorText = isAnchor ? '\n⚓ *ANCHOR POSITION* - Never sold' : ''
        const sellText = sellTriggerPrice ? `\n🎯 Sell trigger: *$${sellTriggerPrice.toFixed(2)}*` : ''

        const message = `${action} *${symbol}*

📊 Level ${level} triggered
💵 Price: *$${price.toFixed(2)}*
📦 Units: ${units}
💰 Amount: ~$${dollarAmount.toFixed(0)}${sellText}${anchorText}`

        await this.send(message)
    }

    /**
     * Send SELL notification
     */
    async notifySell({ symbol, level, buyPrice, sellPrice, unitsSold, unitsKept, profit }) {
        const profitEmoji = profit >= 0 ? '📈' : '📉'
        const keptText = unitsKept > 0 ? `\n🎯 Kept: ${unitsKept} units` : ''

        const message = `🔴 SELL *${symbol}*

📊 Level ${level} sold
💵 Sell price: *$${sellPrice.toFixed(2)}*
📦 Units sold: ${unitsSold}
💰 Buy price: $${buyPrice.toFixed(2)}
${profitEmoji} Profit: *$${profit.toFixed(2)}*${keptText}`

        await this.send(message)
    }

    /**
     * Send NEW HIGH notification
     */
    async notifyHigherPrice({ symbol, price, previousHighest, percentageIncrease }) {
        const message = `🚀 NEW HIGH *${symbol}*

💵 Price: *$${price.toFixed(2)}*
📊 Previous high: $${previousHighest.toFixed(2)}
📈 Increase: +${percentageIncrease.toFixed(2)}%`

        await this.send(message)
    }
}

// Export singleton instance
module.exports = new TelegramNotifier()

