#!/usr/bin/env node

/**
 * Comprehensive App Test Script
 * Tests all major functionality of the stock anomaly system
 */

const https = require('https');
const http = require('http');

// Disable SSL certificate verification for self-signed certs
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const BASE_URL = 'https://localhost';
const API_BASE = `${BASE_URL}/api/v1`;

// Test symbols
const STOCK_SYMBOLS = ['SPY', 'QQQ', 'IWM'];
const CRYPTO_SYMBOL = 'BTC/USD';

// Helper function to make HTTP requests
function makeRequest(url, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'App-Test-Script/1.0'
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: jsonData
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Test functions
async function testHealthCheck() {
    console.log('🔍 Testing Health Check...');
    try {
        const response = await makeRequest(`${API_BASE}/health`);
        if (response.status === 200 && response.data.success) {
            console.log('✅ Health check passed');
            return true;
        } else {
            console.log('❌ Health check failed:', response.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Health check error:', error.message);
        return false;
    }
}

async function testPopulateSampleData() {
    console.log('🔍 Testing Sample Data Population...');
    try {
        const response = await makeRequest(`${API_BASE}/test/populate-sample-data`);
        if (response.status === 200 && response.data.success) {
            console.log('✅ Sample data populated successfully');
            console.log(`   Symbols: ${response.data.data?.symbols?.join(', ') || 'N/A'}`);
            console.log(`   Records: ${response.data.data?.records || 'N/A'}`);
            return true;
        } else {
            console.log('❌ Sample data population failed:', response.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Sample data population error:', error.message);
        return false;
    }
}

async function testStockSymbols() {
    console.log('🔍 Testing Stock Symbols...');
    let successCount = 0;
    
    for (const symbol of STOCK_SYMBOLS) {
        try {
            console.log(`   Testing ${symbol}...`);
            const response = await makeRequest(`${API_BASE}/prices/${symbol}?timeframe=1d&interval=1h`);
            
            if (response.status === 200 && response.data.success) {
                const prices = response.data.data?.prices || [];
                console.log(`   ✅ ${symbol}: ${prices.length} price points`);
                successCount++;
            } else {
                console.log(`   ❌ ${symbol}: ${response.data.error || 'No data'}`);
            }
        } catch (error) {
            console.log(`   ❌ ${symbol}: ${error.message}`);
        }
    }
    
    console.log(`✅ Stock symbols test: ${successCount}/${STOCK_SYMBOLS.length} passed`);
    return successCount === STOCK_SYMBOLS.length;
}

async function testCryptoSymbol() {
    console.log('🔍 Testing Crypto Symbol...');
    try {
        const response = await makeRequest(`${API_BASE}/prices/${CRYPTO_SYMBOL}?timeframe=1d&interval=1h`);
        
        if (response.status === 200 && response.data.success) {
            const prices = response.data.data?.prices || [];
            console.log(`✅ ${CRYPTO_SYMBOL}: ${prices.length} price points`);
            return true;
        } else {
            console.log(`❌ ${CRYPTO_SYMBOL}: ${response.data.error || 'No data'}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ ${CRYPTO_SYMBOL}: ${error.message}`);
        return false;
    }
}

async function testUI() {
    console.log('🔍 Testing UI Access...');
    try {
        const response = await makeRequest(`${BASE_URL}/`);
        if (response.status === 200) {
            console.log('✅ UI is accessible');
            return true;
        } else {
            console.log('❌ UI access failed:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ UI access error:', error.message);
        return false;
    }
}

async function testMockData() {
    console.log('🔍 Testing Mock Data Endpoint...');
    try {
        const response = await makeRequest(`${API_BASE}/test/mock-data`);
        if (response.status === 200 && response.data.success) {
            const prices = response.data.data?.prices || [];
            console.log(`✅ Mock data: ${prices.length} price points`);
            return true;
        } else {
            console.log('❌ Mock data failed:', response.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Mock data error:', error.message);
        return false;
    }
}

async function testDeleteSampleData() {
    console.log('🔍 Testing Sample Data Deletion...');
    try {
        const response = await makeRequest(`${API_BASE}/test/delete-sample-data`, 'DELETE');
        if (response.status === 200 && response.data.success) {
            console.log('✅ Sample data deleted successfully');
            return true;
        } else {
            console.log('❌ Sample data deletion failed:', response.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Sample data deletion error:', error.message);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting Comprehensive App Test\n');
    console.log('=' .repeat(50));
    
    const results = {
        healthCheck: false,
        uiAccess: false,
        mockData: false,
        populateData: false,
        stockSymbols: false,
        cryptoSymbol: false,
        deleteData: false
    };
    
    // Run tests
    results.healthCheck = await testHealthCheck();
    console.log('');
    
    results.uiAccess = await testUI();
    console.log('');
    
    results.mockData = await testMockData();
    console.log('');
    
    results.populateData = await testPopulateSampleData();
    console.log('');
    
    results.stockSymbols = await testStockSymbols();
    console.log('');
    
    results.cryptoSymbol = await testCryptoSymbol();
    console.log('');
    
    results.deleteData = await testDeleteSampleData();
    console.log('');
    
    // Summary
    console.log('=' .repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(50));
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    
    console.log(`Health Check: ${results.healthCheck ? '✅' : '❌'}`);
    console.log(`UI Access: ${results.uiAccess ? '✅' : '❌'}`);
    console.log(`Mock Data: ${results.mockData ? '✅' : '❌'}`);
    console.log(`Populate Data: ${results.populateData ? '✅' : '❌'}`);
    console.log(`Stock Symbols: ${results.stockSymbols ? '✅' : '❌'}`);
    console.log(`Crypto Symbol: ${results.cryptoSymbol ? '✅' : '❌'}`);
    console.log(`Delete Data: ${results.deleteData ? '✅' : '❌'}`);
    
    console.log('');
    console.log(`Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! The app is working perfectly.');
    } else {
        console.log('⚠️  Some tests failed. Check the logs above for details.');
    }
    
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Open https://localhost in your browser');
    console.log('   2. Try the available symbols: SPY, QQQ, IWM, BTC/USD');
    console.log('   3. Test the chart timestamp display');
    console.log('   4. Use the TEST, DEBUG, POPULATE, DELETE buttons');
}

// Run the tests
runTests().catch(console.error);
