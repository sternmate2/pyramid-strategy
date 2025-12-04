"""
Web server for price ingestion service metrics and health endpoints.
"""

import asyncio
import json
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread
from urllib.parse import urlparse, parse_qs

from .utils.logger import logger


class MetricsCollector:
    """Collects and stores metrics for the ingestion service."""
    
    def __init__(self):
        self.metrics = {
            'ingestion_requests_total': 0,
            'ingestion_requests_success_total': 0,
            'ingestion_requests_error_total': 0,
            'ingestion_symbols_processed_total': 0,
            'ingestion_data_points_stored_total': 0,
            'ingestion_last_run_timestamp': 0,
            'ingestion_last_run_duration_seconds': 0,
            'ingestion_cache_hits_total': 0,
            'ingestion_cache_misses_total': 0,
            'ingestion_api_calls_total': 0,
            'ingestion_database_operations_total': 0,
            'ingestion_errors_by_source': {},
            'ingestion_service_status': 1,  # 1 = healthy, 0 = unhealthy
        }
        self.start_time = time.time()
        logger.info("📊 Metrics collector initialized")
    
    def increment_counter(self, metric_name, value=1, labels=None):
        """Increment a counter metric."""
        if labels:
            # Handle labeled metrics
            if metric_name not in self.metrics:
                self.metrics[metric_name] = {}
            for label_key, label_value in labels.items():
                key = f"{metric_name}_{label_key}_{label_value}"
                self.metrics[key] = self.metrics.get(key, 0) + value
        else:
            self.metrics[metric_name] = self.metrics.get(metric_name, 0) + value
    
    def set_gauge(self, metric_name, value):
        """Set a gauge metric."""
        self.metrics[metric_name] = value
    
    def record_ingestion_run(self, duration_seconds, success=True):
        """Record an ingestion run."""
        self.metrics['ingestion_last_run_timestamp'] = time.time()
        self.metrics['ingestion_last_run_duration_seconds'] = duration_seconds
        if success:
            self.increment_counter('ingestion_requests_success_total')
        else:
            self.increment_counter('ingestion_requests_error_total')
        self.increment_counter('ingestion_requests_total')
    
    def get_prometheus_metrics(self):
        """Generate Prometheus-format metrics."""
        lines = []
        
        # Add help and type information
        lines.extend([
            "# HELP ingestion_requests_total Total number of ingestion requests",
            "# TYPE ingestion_requests_total counter",
            f"ingestion_requests_total {self.metrics.get('ingestion_requests_total', 0)}",
            "",
            "# HELP ingestion_requests_success_total Total number of successful ingestion requests",
            "# TYPE ingestion_requests_success_total counter", 
            f"ingestion_requests_success_total {self.metrics.get('ingestion_requests_success_total', 0)}",
            "",
            "# HELP ingestion_requests_error_total Total number of failed ingestion requests",
            "# TYPE ingestion_requests_error_total counter",
            f"ingestion_requests_error_total {self.metrics.get('ingestion_requests_error_total', 0)}",
            "",
            "# HELP ingestion_symbols_processed_total Total number of symbols processed",
            "# TYPE ingestion_symbols_processed_total counter",
            f"ingestion_symbols_processed_total {self.metrics.get('ingestion_symbols_processed_total', 0)}",
            "",
            "# HELP ingestion_data_points_stored_total Total number of data points stored",
            "# TYPE ingestion_data_points_stored_total counter",
            f"ingestion_data_points_stored_total {self.metrics.get('ingestion_data_points_stored_total', 0)}",
            "",
            "# HELP ingestion_last_run_timestamp Timestamp of last ingestion run",
            "# TYPE ingestion_last_run_timestamp gauge",
            f"ingestion_last_run_timestamp {self.metrics.get('ingestion_last_run_timestamp', 0)}",
            "",
            "# HELP ingestion_last_run_duration_seconds Duration of last ingestion run in seconds",
            "# TYPE ingestion_last_run_duration_seconds gauge", 
            f"ingestion_last_run_duration_seconds {self.metrics.get('ingestion_last_run_duration_seconds', 0)}",
            "",
            "# HELP ingestion_cache_hits_total Total cache hits",
            "# TYPE ingestion_cache_hits_total counter",
            f"ingestion_cache_hits_total {self.metrics.get('ingestion_cache_hits_total', 0)}",
            "",
            "# HELP ingestion_cache_misses_total Total cache misses", 
            "# TYPE ingestion_cache_misses_total counter",
            f"ingestion_cache_misses_total {self.metrics.get('ingestion_cache_misses_total', 0)}",
            "",
            "# HELP ingestion_api_calls_total Total API calls made",
            "# TYPE ingestion_api_calls_total counter",
            f"ingestion_api_calls_total {self.metrics.get('ingestion_api_calls_total', 0)}",
            "",
            "# HELP ingestion_database_operations_total Total database operations",
            "# TYPE ingestion_database_operations_total counter", 
            f"ingestion_database_operations_total {self.metrics.get('ingestion_database_operations_total', 0)}",
            "",
            "# HELP ingestion_service_status Service health status (1=healthy, 0=unhealthy)",
            "# TYPE ingestion_service_status gauge",
            f"ingestion_service_status {self.metrics.get('ingestion_service_status', 1)}",
            "",
            "# HELP ingestion_uptime_seconds Service uptime in seconds",
            "# TYPE ingestion_uptime_seconds gauge",
            f"ingestion_uptime_seconds {time.time() - self.start_time}",
        ])
        
        return "\n".join(lines)


class IngestionHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler for ingestion service endpoints."""
    
    def __init__(self, *args, metrics_collector=None, **kwargs):
        self.metrics_collector = metrics_collector
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == '/health':
            self._handle_health()
        elif path == '/metrics':
            self._handle_metrics()
        elif path == '/status':
            self._handle_status()
        elif path == '/':
            self._handle_root()
        else:
            self._send_404()
    
    def _handle_health(self):
        """Health check endpoint."""
        health_data = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": time.time() - self.metrics_collector.start_time if self.metrics_collector else 0,
            "service": "price-ingestion"
        }
        
        self._send_json_response(200, health_data)
    
    def _handle_metrics(self):
        """Prometheus metrics endpoint."""
        if self.metrics_collector:
            metrics_text = self.metrics_collector.get_prometheus_metrics()
            self._send_text_response(200, metrics_text, content_type="text/plain")
        else:
            self._send_text_response(500, "Metrics collector not available")
    
    def _handle_status(self):
        """Service status endpoint."""
        status_data = {
            "service": "price-ingestion",
            "status": "running",
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": time.time() - self.metrics_collector.start_time if self.metrics_collector else 0,
            "metrics": self.metrics_collector.metrics if self.metrics_collector else {}
        }
        
        self._send_json_response(200, status_data)
    
    def _handle_root(self):
        """Root endpoint with service info."""
        info = {
            "service": "Stock Price Ingestion Service",
            "version": "1.0.0",
            "endpoints": {
                "/health": "Health check endpoint",
                "/metrics": "Prometheus metrics endpoint", 
                "/status": "Detailed service status"
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self._send_json_response(200, info)
    
    def _send_json_response(self, status_code, data):
        """Send JSON response."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())
    
    def _send_text_response(self, status_code, text, content_type="text/plain"):
        """Send text response."""
        self.send_response(status_code)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(text.encode())
    
    def _send_404(self):
        """Send 404 response."""
        self.send_response(404)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Not Found"}).encode())
    
    def log_message(self, format, *args):
        """Override to use our logger."""
        logger.debug(f"HTTP: {format % args}")


class IngestionWebServer:
    """Web server for the ingestion service."""
    
    def __init__(self, port=8080):
        self.port = port
        self.metrics_collector = MetricsCollector()
        self.server = None
        self.server_thread = None
        logger.info(f"🌐 Web server initialized on port {port}")
    
    def start(self):
        """Start the web server in a background thread."""
        try:
            def handler(*args, **kwargs):
                return IngestionHTTPHandler(*args, metrics_collector=self.metrics_collector, **kwargs)
            
            self.server = HTTPServer(('0.0.0.0', self.port), handler)
            self.server_thread = Thread(target=self.server.serve_forever, daemon=True)
            self.server_thread.start()
            
            logger.info(f"🚀 Web server started on http://0.0.0.0:{self.port}")
            logger.info(f"📋 Available endpoints:")
            logger.info(f"   - http://localhost:{self.port}/health")
            logger.info(f"   - http://localhost:{self.port}/metrics") 
            logger.info(f"   - http://localhost:{self.port}/status")
            
        except Exception as e:
            logger.error(f"❌ Failed to start web server: {e}")
            raise
    
    def stop(self):
        """Stop the web server."""
        if self.server:
            logger.info("🛑 Stopping web server...")
            self.server.shutdown()
            self.server.server_close()
            if self.server_thread:
                self.server_thread.join(timeout=5)
            logger.info("✅ Web server stopped")
    
    def get_metrics_collector(self):
        """Get the metrics collector instance."""
        return self.metrics_collector
