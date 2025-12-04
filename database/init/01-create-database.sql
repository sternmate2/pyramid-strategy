-- Create database and user (if not exists)
-- This script runs when the PostgreSQL container starts for the first time

-- Ensure the database exists
SELECT 'CREATE DATABASE stock_anomaly'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'stock_anomaly')\gexec

-- Connect to the database
\c stock_anomaly;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Set timezone
SET timezone = 'UTC';