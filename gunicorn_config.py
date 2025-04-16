# gunicorn_config.py
worker_class = "eventlet"
workers = 1  # Important: Only use 1 worker for WebSocket applications
worker_connections = 1000
bind = "0.0.0.0:5000"
timeout = 120  # Increase timeout
keepalive = 2