# Comprehensive App Test Script (PowerShell)
# Tests all major functionality of the stock anomaly system

Write-Host "🚀 Starting Comprehensive App Test" -ForegroundColor Green
Write-Host ""
Write-Host ("=" * 50) -ForegroundColor Cyan

# Test configuration
$BaseUrl = "https://localhost"
$ApiBase = "$BaseUrl/api/v1"
$StockSymbols = @('SPY', 'QQQ', 'IWM')
$CryptoSymbol = 'BTC/USD'

# Disable SSL certificate verification
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

# Helper function to make HTTP requests
function Invoke-ApiRequest {
    param(
        [string]$Uri,
        [string]$Method = 'GET'
    )
    
    try {
        $response = Invoke-WebRequest -Uri $Uri -Method $Method -UseBasicParsing -TimeoutSec 10
        return @{
            Status = $response.StatusCode
            Success = $true
            Data = $response.Content | ConvertFrom-Json
        }
    }
    catch {
        return @{
            Status = $_.Exception.Response.StatusCode.value__
            Success = $false
            Error = $_.Exception.Message
            Data = $null
        }
    }
}

# Test functions
function Test-HealthCheck {
    Write-Host "🔍 Testing Health Check..." -ForegroundColor Yellow
    $result = Invoke-ApiRequest -Uri "$ApiBase/health"
    
    if ($result.Success -and $result.Data.success) {
        Write-Host "✅ Health check passed" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Health check failed: $($result.Error)" -ForegroundColor Red
        return $false
    }
}

function Test-UI {
    Write-Host "🔍 Testing UI Access..." -ForegroundColor Yellow
    $result = Invoke-ApiRequest -Uri $BaseUrl
    
    if ($result.Success -and $result.Status -eq 200) {
        Write-Host "✅ UI is accessible" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ UI access failed: $($result.Status)" -ForegroundColor Red
        return $false
    }
}

function Test-MockData {
    Write-Host "🔍 Testing Mock Data Endpoint..." -ForegroundColor Yellow
    $result = Invoke-ApiRequest -Uri "$ApiBase/test/mock-data"
    
    if ($result.Success -and $result.Data.success) {
        $priceCount = $result.Data.data.prices.Count
        Write-Host "✅ Mock data: $priceCount price points" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Mock data failed: $($result.Error)" -ForegroundColor Red
        return $false
    }
}

function Test-PopulateSampleData {
    Write-Host "🔍 Testing Sample Data Population..." -ForegroundColor Yellow
    $result = Invoke-ApiRequest -Uri "$ApiBase/test/populate-sample-data"
    
    if ($result.Success -and $result.Data.success) {
        $symbols = $result.Data.data.symbols -join ', '
        $records = $result.Data.data.records
        Write-Host "✅ Sample data populated successfully" -ForegroundColor Green
        Write-Host "   Symbols: $symbols" -ForegroundColor Gray
        Write-Host "   Records: $records" -ForegroundColor Gray
        return $true
    } else {
        Write-Host "❌ Sample data population failed: $($result.Error)" -ForegroundColor Red
        return $false
    }
}

function Test-StockSymbols {
    Write-Host "🔍 Testing Stock Symbols..." -ForegroundColor Yellow
    $successCount = 0
    
    foreach ($symbol in $StockSymbols) {
        Write-Host "   Testing $symbol..." -ForegroundColor Gray
        $result = Invoke-ApiRequest -Uri "$ApiBase/prices/$symbol?timeframe=1d&interval=1h"
        
        if ($result.Success -and $result.Data.success) {
            $priceCount = $result.Data.data.prices.Count
            Write-Host "   ✅ $symbol`: $priceCount price points" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "   ❌ $symbol`: $($result.Data.error)" -ForegroundColor Red
        }
    }
    
    Write-Host "✅ Stock symbols test: $successCount/$($StockSymbols.Count) passed" -ForegroundColor Green
    return ($successCount -eq $StockSymbols.Count)
}

function Test-CryptoSymbol {
    Write-Host "🔍 Testing Crypto Symbol..." -ForegroundColor Yellow
    $result = Invoke-ApiRequest -Uri "$ApiBase/prices/$CryptoSymbol?timeframe=1d&interval=1h"
    
    if ($result.Success -and $result.Data.success) {
        $priceCount = $result.Data.data.prices.Count
        Write-Host "✅ $CryptoSymbol`: $priceCount price points" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $CryptoSymbol`: $($result.Data.error)" -ForegroundColor Red
        return $false
    }
}

function Test-DeleteSampleData {
    Write-Host "🔍 Testing Sample Data Deletion..." -ForegroundColor Yellow
    $result = Invoke-ApiRequest -Uri "$ApiBase/test/delete-sample-data" -Method 'DELETE'
    
    if ($result.Success -and $result.Data.success) {
        Write-Host "✅ Sample data deleted successfully" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Sample data deletion failed: $($result.Error)" -ForegroundColor Red
        return $false
    }
}

# Run all tests
$results = @{
    HealthCheck = Test-HealthCheck
    UIAccess = Test-UI
    MockData = Test-MockData
    PopulateData = Test-PopulateSampleData
    StockSymbols = Test-StockSymbols
    CryptoSymbol = Test-CryptoSymbol
    DeleteData = Test-DeleteSampleData
}

Write-Host ""
Write-Host ("=" * 50) -ForegroundColor Cyan
Write-Host "📊 TEST SUMMARY" -ForegroundColor Green
Write-Host ("=" * 50) -ForegroundColor Cyan

$totalTests = $results.Count
$passedTests = ($results.Values | Where-Object { $_ -eq $true }).Count

Write-Host "Health Check: $(if ($results.HealthCheck) { '✅' } else { '❌' })" -ForegroundColor $(if ($results.HealthCheck) { 'Green' } else { 'Red' })
Write-Host "UI Access: $(if ($results.UIAccess) { '✅' } else { '❌' })" -ForegroundColor $(if ($results.UIAccess) { 'Green' } else { 'Red' })
Write-Host "Mock Data: $(if ($results.MockData) { '✅' } else { '❌' })" -ForegroundColor $(if ($results.MockData) { 'Green' } else { 'Red' })
Write-Host "Populate Data: $(if ($results.PopulateData) { '✅' } else { '❌' })" -ForegroundColor $(if ($results.PopulateData) { 'Green' } else { 'Red' })
Write-Host "Stock Symbols: $(if ($results.StockSymbols) { '✅' } else { '❌' })" -ForegroundColor $(if ($results.StockSymbols) { 'Green' } else { 'Red' })
Write-Host "Crypto Symbol: $(if ($results.CryptoSymbol) { '✅' } else { '❌' })" -ForegroundColor $(if ($results.CryptoSymbol) { 'Green' } else { 'Red' })
Write-Host "Delete Data: $(if ($results.DeleteData) { '✅' } else { '❌' })" -ForegroundColor $(if ($results.DeleteData) { 'Green' } else { 'Red' })

Write-Host ""
Write-Host "Overall: $passedTests/$totalTests tests passed" -ForegroundColor $(if ($passedTests -eq $totalTests) { 'Green' } else { 'Yellow' })

if ($passedTests -eq $totalTests) {
    Write-Host "🎉 All tests passed! The app is working perfectly." -ForegroundColor Green
} else {
    Write-Host "⚠️  Some tests failed. Check the logs above for details." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Open https://localhost in your browser" -ForegroundColor White
Write-Host "   2. Try the available symbols: SPY, QQQ, IWM, BTC/USD" -ForegroundColor White
Write-Host "   3. Test the chart timestamp display" -ForegroundColor White
Write-Host "   4. Use the TEST, DEBUG, POPULATE, DELETE buttons" -ForegroundColor White
