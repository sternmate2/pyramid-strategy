# Stock Price Monitor UI

A modern, responsive web interface for monitoring stock prices using the price-api service.

## Features

- **Real-time Stock Data**: Fetch current and historical stock prices
- **Interactive Charts**: Beautiful line charts using Chart.js
- **Multiple Timeframes**: View data from 1 day to 1 year
- **Flexible Intervals**: Choose from 1 minute to daily intervals
- **Quick Symbol Selection**: Pre-configured buttons for popular stocks
- **Price Summary**: Current price, change, range, and volume
- **Data Export**: Download price data as CSV
- **Responsive Design**: Works on desktop and mobile devices

## Usage

### 1. Select a Stock Symbol
- Type a stock symbol in the input field (e.g., AAPL, MSFT, GOOGL)
- Use the quick selection buttons for popular stocks
- Press Enter or click "Fetch Data"

### 2. Choose Timeframe and Interval
- **Timeframe**: Select how far back to fetch data (1 day to 1 year)
- **Interval**: Choose data granularity (1 minute to daily)

### 3. View Data
- **Chart**: Interactive price chart with hover tooltips
- **Summary Cards**: Current price, change, daily range, volume
- **Data Table**: Detailed price history in tabular format

### 4. Export Data
- Click the "Export" button to download data as CSV
- Data includes timestamp, OHLC prices, and volume

## API Endpoints

The UI automatically tries multiple API endpoints to fetch data:

- `/api/prices/{symbol}`
- `/api/stocks/{symbol}/prices`
- `/api/market/{symbol}`
- `/prices/{symbol}`
- `/stocks/{symbol}/prices`

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

## Troubleshooting

### No Data Displayed
1. Check if the price-api service is running
2. Verify the stock symbol is valid
3. Check browser console for API errors
4. Ensure nginx is properly configured

### Chart Not Loading
1. Check if Chart.js is loaded (CDN)
2. Verify the canvas element exists
3. Check for JavaScript errors in console

### API Errors
1. Verify the price-api service endpoints
2. Check CORS configuration
3. Ensure proper authentication if required

## Development

### File Structure
```
public/
├── index.html      # Main HTML file
├── styles.css      # CSS styling
├── script.js       # JavaScript application
└── README.md       # This file
```

### Customization
- Modify `styles.css` for visual changes
- Update `script.js` for functionality changes
- Add new API endpoints in `tryApiEndpoints()`

### Testing
- Use browser developer tools
- Check Network tab for API calls
- Use `window.debugStockMonitor` for debugging

## Dependencies

- **Chart.js**: Chart rendering library
- **Font Awesome**: Icons
- **Modern CSS**: Flexbox, Grid, CSS Variables
- **ES6+ JavaScript**: Async/await, classes, modules
