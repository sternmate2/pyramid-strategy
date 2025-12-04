// Professional Stock Trading Platform with Full Functionality
class StockTradingPlatform {
    constructor() {
        // Use the price-api subdomain for API calls
        this.apiBaseUrl = 'https://price-api.sads.ai';
        this.chart = null;
        this.currentData = null;
        this.currentSymbol = 'SPY';
        this.currentTimeframe = '1y';
        this.currentInterval = '1d';
        this.availableInstruments = [];
        this.init();
    }

    async init() {
        this.bindEvents();
        this.setupChart();
        this.setupVolumeAnalysis();
        await this.loadAvailableInstruments();
        await this.loadDefaultSymbol();
        this.setupPanelToggle();
        this.setupInstrumentSearch();
    }

    bindEvents() {
        // Fetch button
        document.getElementById('fetch-btn').addEventListener('click', () => {
            this.fetchStockData();
        });

        // Enter key on input
        document.getElementById('symbol-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.fetchStockData();
            }
        });

        // Timeframe buttons
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setActiveTimeframe(e.target.dataset.timeframe);
            });
        });

        // Timeframe and interval changes
        document.getElementById('timeframe').addEventListener('change', () => {
            if (this.currentData) {
                this.fetchStockData();
            }
        });

        document.getElementById('interval').addEventListener('change', () => {
            if (this.currentData) {
                this.fetchStockData();
            }
        });

        // Chart type selection
        document.getElementById('chart-type').addEventListener('change', (e) => {
            this.changeChartType(e.target.value);
        });

        // Export button
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });

        // Error close button
        document.getElementById('error-close').addEventListener('click', () => {
            this.hideError();
        });

        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettings();
        });
    }

    setupPanelToggle() {
        const panelHeader = document.querySelector('.panel-header');
        const panelContent = document.getElementById('panel-content');
        const panelToggle = document.getElementById('panel-toggle');
        
        panelHeader.addEventListener('click', () => {
            const isVisible = !panelContent.classList.contains('hidden');
            if (isVisible) {
                panelContent.classList.add('hidden');
                panelToggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
            } else {
                panelContent.classList.remove('hidden');
                panelToggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
            }
        });
    }

    setupInstrumentSearch() {
        const symbolInput = document.getElementById('symbol-input');
        const searchResults = document.getElementById('search-results');
        
        // Create search results container if it doesn't exist
        if (!searchResults) {
            const searchContainer = document.createElement('div');
            searchContainer.id = 'search-results';
            searchContainer.className = 'search-results hidden';
            symbolInput.parentNode.appendChild(searchContainer);
        }
        
        symbolInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toUpperCase();
            if (query.length >= 1) {
                this.showInstrumentSuggestions(query);
            } else {
                this.hideInstrumentSuggestions();
            }
        });
        
        symbolInput.addEventListener('focus', () => {
            if (symbolInput.value.trim().length >= 1) {
                this.showInstrumentSuggestions(symbolInput.value.trim().toUpperCase());
            }
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.input-group')) {
                this.hideInstrumentSuggestions();
            }
        });
    }

    showInstrumentSuggestions(query) {
        const searchResults = document.getElementById('search-results');
        const suggestions = this.availableInstruments.filter(instrument => 
            instrument.symbol.includes(query) || 
            instrument.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 10);
        
        if (suggestions.length > 0) {
            searchResults.innerHTML = suggestions.map(instrument => `
                <div class="search-suggestion" data-symbol="${instrument.symbol}">
                    <span class="suggestion-symbol">${instrument.symbol}</span>
                    <span class="suggestion-name">${instrument.name}</span>
                </div>
            `).join('');
            
            searchResults.classList.remove('hidden');
            
            // Add click handlers
            searchResults.querySelectorAll('.search-suggestion').forEach(suggestion => {
                suggestion.addEventListener('click', () => {
                    const symbol = suggestion.dataset.symbol;
                    document.getElementById('symbol-input').value = symbol;
                    this.hideInstrumentSuggestions();
                    this.selectSymbol(symbol);
                });
            });
        } else {
            this.hideInstrumentSuggestions();
        }
    }

    hideInstrumentSuggestions() {
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            searchResults.classList.add('hidden');
        }
    }

    setActiveTimeframe(timeframe) {
        // Remove active class from all buttons
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        document.querySelector(`[data-timeframe="${timeframe}"]`).classList.add('active');
        
        // Update current timeframe
        this.currentTimeframe = timeframe;
        
        // Update the select dropdown to match
        document.getElementById('timeframe').value = timeframe;
        
        // Fetch new data if we have current data
        if (this.currentData) {
            this.fetchStockData();
        }
    }

    changeChartType(chartType) {
        if (!this.chart) return;
        
        // Update chart type based on selection
        switch (chartType) {
            case 'mountain':
                this.chart.config.type = 'line';
                this.chart.config.data.datasets[0].fill = true;
                this.chart.config.data.datasets[0].backgroundColor = 'rgba(0, 200, 83, 0.1)';
                break;
            case 'line':
                this.chart.config.type = 'line';
                this.chart.config.data.datasets[0].fill = false;
                this.chart.config.data.datasets[0].backgroundColor = 'transparent';
                break;
            case 'candlestick':
                // For candlestick, we'd need a different chart library
                // For now, show as line chart
                this.chart.config.type = 'line';
                this.chart.config.data.datasets[0].fill = false;
                break;
            case 'bar':
                this.chart.config.type = 'bar';
                this.chart.config.data.datasets[0].fill = false;
                this.chart.config.data.datasets[0].backgroundColor = 'rgba(0, 200, 83, 0.8)';
                break;
        }
        
        this.chart.update();
    }

    setupChart() {
        const ctx = document.getElementById('price-chart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: '#00c853',
                    backgroundColor: 'rgba(0, 200, 83, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#00c853',
                    pointHoverBorderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 31, 46, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#00c853',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                // Show full timestamp in tooltip title
                                const dataIndex = context[0].dataIndex;
                                const chart = context[0].chart;
                                const originalData = chart.data.originalData;
                                
                                if (originalData && originalData.prices && originalData.prices[dataIndex]) {
                                    const timestamp = new Date(originalData.prices[dataIndex].timestamp);
                                    return timestamp.toLocaleString('en-US', {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: true
                                    });
                                }
                                return context[0].label;
                            },
                            label: function(context) {
                                const dataIndex = context.dataIndex;
                                const chart = context.chart;
                                const originalData = chart.data.originalData;
                                
                                if (originalData && originalData.prices && originalData.prices[dataIndex]) {
                                    const price = originalData.prices[dataIndex];
                                    return [
                                        `Price: $${price.close?.toFixed(2) || 'N/A'}`,
                                        `Open: $${price.open?.toFixed(2) || 'N/A'}`,
                                        `High: $${price.high?.toFixed(2) || 'N/A'}`,
                                        `Low: $${price.low?.toFixed(2) || 'N/A'}`,
                                        `Volume: ${price.volume ? (price.volume / 1000000).toFixed(1) + 'M' : 'N/A'}`
                                    ];
                                }
                                return `$${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(42, 47, 62, 0.5)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8b8fa3',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        display: true,
                        position: 'right',
                        grid: {
                            color: 'rgba(42, 47, 62, 0.5)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8b8fa3',
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        hoverRadius: 4
                    }
                }
            }
        });
    }

    async loadAvailableInstruments() {
        try {
            // Try to get available instruments from the API
            const response = await fetch(`${this.apiBaseUrl}/api/v1/stocks/available`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    this.availableInstruments = data.data;
                } else if (Array.isArray(data)) {
                    this.availableInstruments = data;
                } else {
                    // Fallback to default instruments if API fails
                    this.availableInstruments = this.getDefaultInstruments();
                }
            } else {
                this.availableInstruments = this.getDefaultInstruments();
            }
        } catch (error) {
            console.log('Using default instruments:', error.message);
            this.availableInstruments = this.getDefaultInstruments();
        }
        
        this.createQuickSelectButtons();
        this.populateInstrumentDropdown();
    }

    getDefaultInstruments() {
        return [
            { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
            { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
            { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
            { symbol: 'BTC/USD', name: 'Bitcoin' },
            { symbol: 'ETH/USD', name: 'Ethereum' },
            { symbol: 'AAPL', name: 'Apple Inc.' },
            { symbol: 'MSFT', name: 'Microsoft Corporation' },
            { symbol: 'GOOGL', name: 'Alphabet Inc.' },
            { symbol: 'AMZN', name: 'Amazon.com Inc.' },
            { symbol: 'TSLA', name: 'Tesla Inc.' }
        ];
    }

    populateInstrumentDropdown() {
        const dropdown = document.getElementById('instrument-dropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">Select Instrument</option>';
        this.availableInstruments.forEach(instrument => {
            const option = document.createElement('option');
            option.value = instrument.symbol;
            option.textContent = `${instrument.symbol} - ${instrument.name}`;
            dropdown.appendChild(option);
        });
        
        // Add change event
        dropdown.addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectSymbol(e.target.value);
            }
        });
    }

    createQuickSelectButtons() {
        const container = document.getElementById('quickSelectContainer');
        container.innerHTML = '<span>Quick Select:</span>';
        
        // Add default symbols
        const defaultSymbols = ['SPY', 'QQQ', 'IWM', 'BTC/USD'];
        
        defaultSymbols.forEach(symbol => {
            const button = document.createElement('button');
            button.textContent = symbol;
            button.dataset.symbol = symbol;
            button.classList.add('quick-select-btn');
            
            if (symbol === this.currentSymbol) {
                button.classList.add('active');
            }
            
            button.addEventListener('click', () => {
                this.selectSymbol(symbol);
            });
            
            container.appendChild(button);
        });

        // Add special action buttons (restoring previous functionality)
        this.addSpecialButtons(container);
    }

    addSpecialButtons(container) {
        // Add special action buttons
        const specialButtons = [
            { text: 'TEST', onClick: () => this.fetchTestData(), class: 'test-btn' },
            { text: 'DEBUG', onClick: () => this.debugApiEndpoints(), class: 'debug-btn' },
            { text: 'POPULATE DB', onClick: () => this.populateSampleData(), class: 'populate-btn' },
            { text: 'DELETE SAMPLE DATA', onClick: () => this.deleteSampleData(), class: 'delete-btn' }
        ];
        
        specialButtons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `quick-select-btn ${btn.class}`;
            button.textContent = btn.text;
            button.onclick = btn.onClick;
            container.appendChild(button);
        });
    }

    selectSymbol(symbol) {
        // Update active state
        document.querySelectorAll('.quick-select-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-symbol="${symbol}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Update input and fetch data
        document.getElementById('symbol-input').value = symbol;
        this.currentSymbol = symbol;
        this.fetchStockData();
    }

    async loadDefaultSymbol() {
        await this.fetchStockData();
    }

    async fetchStockData() {
        const symbol = document.getElementById('symbol-input').value.trim().toUpperCase();
        if (!symbol) {
            this.showError('Please enter a stock symbol');
            return;
        }

        this.showLoading();
        this.hideError();

        try {
            const timeframe = document.getElementById('timeframe').value;
            const interval = document.getElementById('interval').value;
            
            // Try different API endpoints (restoring previous functionality)
            let data = await this.tryApiEndpoints(symbol, timeframe, interval);
            
            if (data && data.length > 0) {
                this.currentData = data;
                this.updateDisplay({ symbol, prices: data });
                this.updateChart({ symbol, prices: data });
                this.updatePriceSummary({ symbol, prices: data });
                this.updateDataTable({ symbol, prices: data });
                this.showDataElements();
            } else {
                throw new Error(`No data found for ${symbol}`);
            }

        } catch (error) {
            console.error('Error fetching stock data:', error);
            this.showError(`Failed to fetch data for ${symbol}: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async fetchTestData() {
        this.showLoading();
        this.hideError();

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/test/mock-data`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data.prices) {
                    this.currentData = result.data.prices;
                    this.updateDisplay({ symbol: 'TEST', prices: result.data.prices });
                    this.updateChart({ symbol: 'TEST', prices: result.data.prices });
                    this.updatePriceSummary({ symbol: 'TEST', prices: result.data.prices });
                    this.updateDataTable({ symbol: 'TEST', prices: result.data.prices });
                    this.showDataElements();
                } else {
                    this.showError('Invalid test data format');
                }
            } else {
                this.showError('Failed to fetch test data');
            }
        } catch (error) {
            console.error('Error fetching test data:', error);
            this.showError(`Failed to fetch test data: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async debugApiEndpoints() {
        this.showLoading();
        this.hideError();

        const endpoints = [
            '/api/v1/health',
            '/api/v1/test/simple',
            '/api/v1/test/mock-data',
            '/api/v1/stocks/available',
            '/api/v1/test/populate-sample-data'
        ];

        const results = [];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
                const status = response.status;
                const ok = response.ok;
                
                let data = null;
                try {
                    data = await response.json();
                } catch (e) {
                    data = { error: 'Invalid JSON response' };
                }

                results.push({
                    endpoint,
                    status,
                    ok,
                    data
                });
            } catch (error) {
                results.push({
                    endpoint,
                    status: 'ERROR',
                    ok: false,
                    data: { error: error.message }
                });
            }
        }

        // Display results in console and show summary
        console.log('API Debug Results:', results);
        
        const workingEndpoints = results.filter(r => r.ok).length;
        const totalEndpoints = results.length;
        
        this.showError(`API Debug: ${workingEndpoints}/${totalEndpoints} endpoints working. Check console for details.`);
        this.hideLoading();
    }

    async populateSampleData() {
        this.showLoading();
        this.hideError();

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/test/populate-sample-data`);
            if (response.ok) {
                const result = await response.json();
                console.log('Populate API response:', result);
                
                if (result.success && result.data) {
                    let records = 0;
                    let symbols = [];
                    
                    if (result.data.records !== undefined) {
                        records = result.data.records;
                    } else if (result.data.total !== undefined) {
                        records = result.data.total;
                    } else if (result.data.count !== undefined) {
                        records = result.data.count;
                    }
                    
                    if (result.data.symbols && Array.isArray(result.data.symbols)) {
                        symbols = result.data.symbols;
                    } else if (result.data.data && Array.isArray(result.data.data)) {
                        symbols = result.data.data;
                    }
                    
                    this.showError(`Database populated successfully! Created ${records} records for ${symbols.length} symbols.`);
                    
                    // Reload available instruments
                    await this.loadAvailableInstruments();
                } else {
                    this.showError('Failed to populate database: Invalid response format');
                }
            } else {
                this.showError(`Failed to populate database: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error populating sample data:', error);
            this.showError(`Failed to populate database: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async deleteSampleData() {
        this.showLoading();
        this.hideError();

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/test/delete-sample-data`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Delete API response:', result);
                
                if (result.success && result.data) {
                    const deletedInstruments = result.data.deleted_instruments || 0;
                    const deletedPrices = result.data.deleted_prices || 0;
                    
                    this.showError(`Sample data deleted successfully! Removed ${deletedPrices} price records and ${deletedInstruments} instruments.`);
                    
                    // Reload available instruments
                    await this.loadAvailableInstruments();
                } else {
                    this.showError('Failed to delete sample data: Invalid response format');
                }
            } else {
                this.showError(`Failed to delete sample data: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting sample data:', error);
            this.showError(`Failed to delete sample data: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    async tryApiEndpoints(symbol, timeframe, interval) {
        // Check if this is a cryptocurrency symbol
        const isCrypto = this._isCryptoSymbol(symbol);
        
        let endpoints = [];
        
        if (isCrypto) {
            // Use crypto-specific endpoints for symbols with slashes (e.g., BTC/USD)
            endpoints = [
                `/api/v1/prices/${symbol}?timeframe=${timeframe}&interval=${interval}`,
                `/api/v1/crypto/${symbol}?days=${this.convertTimeframeToDays(timeframe)}`,
                `/api/v1/test/mock-data`
            ];
        } else {
            // Use stock endpoints
            endpoints = [
                `/api/v1/prices/${symbol}?timeframe=${timeframe}&interval=${interval}`,
                `/api/v1/stocks/${symbol}/prices?timeframe=${timeframe}&interval=${interval}`,
                `/api/v1/market/${symbol}?timeframe=${timeframe}&interval=${interval}`,
                `/api/v1/price/${symbol}/history?days=${this.convertTimeframeToDays(timeframe)}&interval=${interval}`,
                `/api/v1/price/${symbol}`,
                // Test endpoint for mock data
                `/api/v1/test/mock-data`
            ];
        }

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && (data.prices || data.data || Array.isArray(data))) {
                        return this.normalizeData(data);
                    }
                }
            } catch (error) {
                console.log(`Endpoint ${endpoint} failed:`, error.message);
                continue;
            }
        }

        // If no API endpoints work, try to get current price
        try {
            const currentPrice = await this.getCurrentPrice(symbol);
            if (currentPrice) {
                return [currentPrice];
            }
        } catch (error) {
            console.log('Current price endpoint also failed:', error.message);
        }

        throw new Error('All API endpoints failed');
    }

    async getCurrentPrice(symbol) {
        const endpoints = [
            `/api/v1/price/${symbol}/current`,
            `/api/v1/price/${symbol}`,
            `/api/v1/prices/${symbol}?timeframe=1d&interval=1d`
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.price) {
                        return {
                            timestamp: new Date().toISOString(),
                            open: data.price,
                            high: data.price,
                            low: data.price,
                            close: data.price,
                            volume: data.volume || 0
                        };
                    }
                }
            } catch (error) {
                continue;
            }
        }
        return null;
    }

    normalizeData(data) {
        // Handle different API response formats
        let prices = [];
        
        if (data.data && data.data.prices) {
            // API response format: { success: true, data: { prices: [...] } }
            prices = data.data.prices;
        } else if (data.prices) {
            // Direct prices array
            prices = data.prices;
        } else if (data.data && Array.isArray(data.data)) {
            // API response format: { success: true, data: [...] }
            prices = data.data;
        } else if (Array.isArray(data)) {
            // Direct array
            prices = data;
        }

        return prices.map(item => {
            // Handle cryptocurrency data (price_usd field)
            if (item.price_usd !== undefined) {
                return {
                    timestamp: item.timestamp || item.created_at || item.date || item.time,
                    open: parseFloat(item.price_usd || 0),
                    high: parseFloat(item.price_usd || 0),
                    low: parseFloat(item.price_usd || 0),
                    close: parseFloat(item.price_usd || 0),
                    volume: parseInt(item.volume_24h || item.volume || 0),
                    // Additional crypto fields
                    market_cap: item.market_cap_usd,
                    price_change_24h: item.price_change_24h,
                    price_change_percent_24h: item.price_change_percent_24h
                };
            } else {
                // Handle stock data
                return {
                    timestamp: item.timestamp || item.date || item.time,
                    open: parseFloat(item.open || item.open_price || 0),
                    high: parseFloat(item.high || item.high_price || 0),
                    low: parseFloat(item.low || item.low_price || 0),
                    close: parseFloat(item.close || item.close_price || item.price || 0),
                    volume: parseInt(item.volume || 0)
                };
            }
        }).filter(item => item.close > 0); // Filter out invalid data
    }

    convertTimeframeToDays(timeframe) {
        switch (timeframe) {
            case '1d': return 1;
            case '5d': return 5;
            case '1m': return 30;
            case '3m': return 90;
            case '6m': return 180;
            case '1y': return 365;
            default: return 30;
        }
    }

    _isCryptoSymbol(symbol) {
        // Check if symbol contains a slash (e.g., BTC/USD, ETH/USD)
        return symbol.includes('/');
    }

    updateDisplay(data) {
        // Update instrument name
        document.getElementById('instrument-name').textContent = this.getInstrumentDisplayName(data.symbol);
        
        // Update current price
        if (data.prices && data.prices.length > 0) {
            const latestPrice = data.prices[data.prices.length - 1];
            const previousPrice = data.prices[data.prices.length - 2];
            
            // Current price
            document.getElementById('current-price').textContent = latestPrice.close.toFixed(2);
            
            // Price change
            if (previousPrice) {
                const change = latestPrice.close - previousPrice.close;
                const changePercent = (change / previousPrice.close) * 100;
                
                const changeAmount = document.querySelector('#price-change .change-amount');
                const changePercentEl = document.querySelector('#price-change .change-percent');
                
                changeAmount.textContent = change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
                changePercentEl.textContent = `(${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`;
                
                // Update colors
                const isPositive = change >= 0;
                changeAmount.className = `change-amount ${isPositive ? 'positive' : 'negative'}`;
                changePercentEl.className = `change-percent ${isPositive ? 'positive' : 'negative'}`;
            }
            
            // Update time
            const timestamp = new Date(latestPrice.timestamp);
            document.getElementById('price-time').textContent = 
                `At close: ${timestamp.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric' 
                })} at ${timestamp.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hour12: true 
                })} EDT`;
            
            // Update after hours (simulated for now)
            document.getElementById('ah-price').textContent = (latestPrice.close + (Math.random() - 0.5) * 2).toFixed(2);
        }
        
        // Update performance indicator
        this.updatePerformanceIndicator(data);
    }

    getInstrumentDisplayName(symbol) {
        const names = {
            'SPY': 'SPDR S&P 500 ETF (SPY)',
            'QQQ': 'Invesco QQQ Trust (QQQ)',
            'IWM': 'iShares Russell 2000 ETF (IWM)',
            'BTC/USD': 'Bitcoin (BTC/USD)'
        };
        return names[symbol] || `${symbol} Stock`;
    }

    updatePerformanceIndicator(data) {
        if (data.prices && data.prices.length > 1) {
            const firstPrice = data.prices[0].close;
            const lastPrice = data.prices[data.prices.length - 1].close;
            const performance = ((lastPrice - firstPrice) / firstPrice) * 100;
            
            const performanceEl = document.getElementById('performance-indicator');
            performanceEl.innerHTML = `<span class="performance-value ${performance >= 0 ? 'positive' : 'negative'}">${performance >= 0 ? '+' : ''}${performance.toFixed(2)}%</span>`;
        }
    }

    updateChart(data) {
        if (!data.prices || !this.chart) return;

        const labels = data.prices.map(price => {
            const date = new Date(price.timestamp);
            
            // Check if this is intraday data (multiple points per day) or daily data
            const isIntraday = this.isIntradayData(data.prices);
            
            if (isIntraday) {
                // For intraday data, show date and time
                return date.toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                });
            } else {
                // For daily data, show date only
                return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: '2-digit'
                });
            }
        });

        const prices = data.prices.map(price => price.close);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = prices;
        this.chart.data.datasets[0].label = `${data.symbol} Price`;
        
        // Store original data for tooltip access
        this.chart.data.originalData = data;
        
        this.chart.update();
    }

    isIntradayData(prices) {
        if (!prices || prices.length < 2) return false;
        
        // Check if we have multiple data points on the same day
        const dates = prices.map(price => new Date(price.timestamp).toDateString());
        const uniqueDates = new Set(dates);
        
        // If we have fewer unique dates than total prices, it's intraday data
        return uniqueDates.size < prices.length;
    }

    updatePriceSummary(data) {
        if (!data.prices || data.prices.length === 0) return;

        const latestPrice = data.prices[data.prices.length - 1];
        
        document.getElementById('day-open').textContent = `$${latestPrice.open?.toFixed(2) || '--'}`;
        document.getElementById('day-high').textContent = `$${latestPrice.high?.toFixed(2) || '--'}`;
        document.getElementById('day-low').textContent = `$${latestPrice.low?.toFixed(2) || '--'}`;
        document.getElementById('volume').textContent = this.formatVolume(latestPrice.volume);
    }

    updateDataTable(data) {
        if (!data.prices) return;

        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';

        data.prices.forEach(price => {
            const row = document.createElement('tr');
            const timestamp = new Date(price.timestamp);
            
            row.innerHTML = `
                <td>${timestamp.toLocaleString()}</td>
                <td>$${price.open?.toFixed(2) || '--'}</td>
                <td>$${price.high?.toFixed(2) || '--'}</td>
                <td>$${price.low?.toFixed(2) || '--'}</td>
                <td>$${price.close?.toFixed(2) || '--'}</td>
                <td>${this.formatVolume(price.volume)}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    formatVolume(volume) {
        if (!volume) return '--';
        
        if (volume >= 1e9) {
            return (volume / 1e9).toFixed(2) + 'B';
        } else if (volume >= 1e6) {
            return (volume / 1e6).toFixed(2) + 'M';
        } else if (volume >= 1e3) {
            return (volume / 1e3).toFixed(2) + 'K';
        }
        return volume.toString();
    }

    showDataElements() {
        document.getElementById('price-summary').classList.remove('hidden');
        document.getElementById('data-table').classList.remove('hidden');
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        const errorEl = document.getElementById('error');
        const messageEl = document.getElementById('error-message');
        messageEl.textContent = message;
        errorEl.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }

    exportData() {
        if (!this.currentData || !this.currentData.prices) {
            this.showError('No data to export');
            return;
        }

        const csvContent = this.convertToCSV(this.currentData.prices);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.currentSymbol}_${this.currentTimeframe}_data.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    convertToCSV(prices) {
        const headers = ['Date/Time', 'Open', 'High', 'Low', 'Close', 'Volume'];
        const rows = prices.map(price => [
            new Date(price.timestamp).toLocaleString(),
            price.open || '',
            price.high || '',
            price.low || '',
            price.close || '',
            price.volume || ''
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    showSettings() {
        // Placeholder for settings functionality
        alert('Settings panel would open here in a full implementation');
    }

    // ===== VOLUME ANALYSIS METHODS =====

    setupVolumeAnalysis() {
        const priceViewBtn = document.getElementById('price-view-btn');
        const volumeViewBtn = document.getElementById('volume-view-btn');
        const priceChart = document.getElementById('price-chart');
        const volumeAnalysis = document.getElementById('volume-analysis');
        const refreshVolumeBtn = document.getElementById('refresh-volume');
        const volumePeriodSelect = document.getElementById('volume-period');

        // Toggle between price chart and volume analysis
        priceViewBtn.addEventListener('click', () => {
            priceViewBtn.classList.add('active');
            volumeViewBtn.classList.remove('active');
            priceChart.style.display = 'block';
            volumeAnalysis.style.display = 'none';
        });

        volumeViewBtn.addEventListener('click', () => {
            volumeViewBtn.classList.add('active');
            priceViewBtn.classList.remove('active');
            priceChart.style.display = 'none';
            volumeAnalysis.style.display = 'block';
            this.loadVolumeAnalysis();
        });

        // Refresh volume data
        refreshVolumeBtn.addEventListener('click', () => {
            this.loadVolumeAnalysis();
        });

        // Period change
        volumePeriodSelect.addEventListener('change', () => {
            this.loadVolumeAnalysis();
        });
    }

    async loadVolumeAnalysis() {
        console.log('🔍 Starting volume analysis load...');
        const volumeAnalysisDiv = document.getElementById('volume-analysis');
        const volumePeriod = document.getElementById('volume-period').value;
        
        console.log(`📊 Volume analysis div found: ${volumeAnalysisDiv ? 'Yes' : 'No'}`);
        console.log(`📅 Volume period: ${volumePeriod}`);
        
        try {
            // Show loading state
            this.showVolumeLoading();
            console.log('⏳ Loading state shown');

            const apiUrl = `${this.apiBaseUrl}/api/v1/volume/analysis?days=${volumePeriod}`;
            console.log(`🌐 Fetching from: ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            console.log(`📡 Response status: ${response.status}`);
            
            const result = await response.json();
            console.log('📦 API Response:', result);

            if (result.success && result.data) {
                console.log(`✅ Volume data received: ${result.data.total_instruments} instruments`);
                // The API returns data nested in result.data, so pass result.data
                this.displayVolumeAnalysis(result.data);
            } else {
                console.error('❌ API returned error:', result);
                this.showVolumeError('Failed to load volume analysis');
            }
        } catch (error) {
            console.error('💥 Error loading volume analysis:', error);
            this.showVolumeError('Error loading volume analysis');
        }
    }

    showVolumeLoading() {
        const summaryCards = document.getElementById('volume-summary-cards');
        const tableBody = document.getElementById('volume-table-body');
        
        summaryCards.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i> Loading volume data...</div>';
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;"><i class="fas fa-spinner"></i> Loading...</td></tr>';
    }

    showVolumeError(message) {
        const summaryCards = document.getElementById('volume-summary-cards');
        const tableBody = document.getElementById('volume-table-body');
        
        summaryCards.innerHTML = `<div style="text-align: center; color: #f44336; padding: 20px;"><i class="fas fa-exclamation-triangle"></i> ${message}</div>`;
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #f44336;">${message}</td></tr>`;
    }

    displayVolumeAnalysis(data) {
        console.log('🎨 Displaying volume analysis:', data);
        console.log('🎨 Data.instruments:', data.instruments);
        this.displayVolumeSummary(data);
        this.displayVolumeTable(data.instruments);
        console.log('✅ Volume analysis display completed');
    }

    displayVolumeSummary(data) {
        console.log('📊 Displaying volume summary with data:', data);
        const summaryCards = document.getElementById('volume-summary-cards');
        
        // Handle different response structures
        const instruments = data.instruments || data || [];
        console.log('📋 Instruments array:', instruments);
        console.log('📋 Is instruments an array?', Array.isArray(instruments));
        
        if (!Array.isArray(instruments)) {
            console.error('❌ Instruments is not an array:', typeof instruments);
            this.showVolumeError('Invalid data format received');
            return;
        }
        
        // Calculate summary statistics
        const totalInstruments = data.total_instruments || instruments.length;
        const totalCurrentVolume = instruments.reduce((sum, inst) => sum + (inst.current_volume || 0), 0);
        const totalAvgVolume = instruments.reduce((sum, inst) => sum + (inst.average_volume || 0), 0);
        const highVolumeCount = instruments.filter(inst => inst.volume_trend_percent > 20).length;

        summaryCards.innerHTML = `
            <div class="volume-summary-card">
                <h4>Total Instruments</h4>
                <div class="value">${totalInstruments}</div>
                <div class="subtext">${data.period_days} day analysis</div>
            </div>
            <div class="volume-summary-card">
                <h4>Total Current Volume</h4>
                <div class="value">${this.formatVolume(totalCurrentVolume)}</div>
                <div class="subtext">Across all instruments</div>
            </div>
            <div class="volume-summary-card">
                <h4>Total Avg Volume</h4>
                <div class="value">${this.formatVolume(totalAvgVolume)}</div>
                <div class="subtext">${data.period_days} day average</div>
            </div>
            <div class="volume-summary-card">
                <h4>High Volume Activity</h4>
                <div class="value">${highVolumeCount}</div>
                <div class="subtext">Instruments >20% above avg</div>
            </div>
        `;
    }

    displayVolumeTable(instruments) {
        console.log('📋 Displaying volume table with instruments:', instruments);
        const tableBody = document.getElementById('volume-table-body');
        
        // Handle case where instruments might be passed directly or nested
        const instrumentsArray = instruments || [];
        console.log('📋 Instruments array for table:', instrumentsArray);
        
        if (!Array.isArray(instrumentsArray) || instrumentsArray.length === 0) {
            console.log('⚠️ No instruments data for table');
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No volume data available</td></tr>';
            return;
        }

        const rows = instrumentsArray.map(instrument => {
            const trendClass = instrument.volume_trend_percent > 5 ? 'positive' : 
                              instrument.volume_trend_percent < -5 ? 'negative' : 'neutral';
            const trendIcon = instrument.volume_trend_percent > 5 ? 'fa-arrow-up' : 
                             instrument.volume_trend_percent < -5 ? 'fa-arrow-down' : 'fa-minus';

            return `
                <tr>
                    <td><strong>${instrument.symbol}</strong></td>
                    <td><span class="instrument-type ${instrument.instrument_type}">${instrument.instrument_type}</span></td>
                    <td class="volume-number">${this.formatVolume(instrument.current_volume)}</td>
                    <td class="volume-number">${this.formatVolume(instrument.average_volume)}</td>
                    <td>
                        <div class="volume-trend ${trendClass}">
                            <i class="fas ${trendIcon}"></i>
                            ${instrument.volume_trend_percent}%
                        </div>
                    </td>
                    <td class="volume-number">${this.formatVolume(instrument.max_volume)}</td>
                    <td>${instrument.data_points}</td>
                    <td>${this.formatTimestamp(instrument.latest_timestamp)}</td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = rows;
    }

    formatVolume(volume) {
        if (!volume || volume === 0) return '--';
        
        if (volume >= 1e9) {
            return (volume / 1e9).toFixed(1) + 'B';
        } else if (volume >= 1e6) {
            return (volume / 1e6).toFixed(1) + 'M';
        } else if (volume >= 1e3) {
            return (volume / 1e3).toFixed(1) + 'K';
        }
        
        return volume.toLocaleString();
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '--';
        
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

// Initialize the platform when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StockTradingPlatform();
});

