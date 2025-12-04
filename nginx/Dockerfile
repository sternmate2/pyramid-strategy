FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy configuration files
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx.dev.conf /etc/nginx/conf.d/default.conf

# Copy static files
COPY public/ /usr/share/nginx/html/

# Create log directory
RUN mkdir -p /var/log/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]