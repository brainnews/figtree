#!/usr/bin/env python3
"""
Simple HTTP server for local Figtree development and testing.
Serves the website-auth.html file with proper CORS headers.
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse, parse_qs

class FigtreeDevHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # Root path - serve website-auth.html
        if parsed_path.path == '/' or parsed_path.path == '/website-auth.html':
            self.path = '/website-auth.html'
        
        # Handle API endpoints for testing
        elif parsed_path.path == '/api/auth/check':
            self.handle_auth_check(parsed_path)
            return
        
        # Serve static files
        super().do_GET()
    
    def handle_auth_check(self, parsed_path):
        """Mock API endpoint for testing auth completion"""
        query_params = parse_qs(parsed_path.query)
        state = query_params.get('state', [None])[0]
        
        # For testing, return a mock successful response after a delay
        import json
        import time
        
        response_data = {
            "status": "not_ready",
            "message": "Authentication not complete yet"
        }
        
        # Mock: Return success after 5 requests (simulating user completing auth)
        # In reality, this would check a database or cache
        
        self.send_response(404)  # Not found = auth not complete yet
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode())
    
    def log_message(self, format, *args):
        # Custom log format
        print(f"[{self.address_string()}] {format % args}")

def run_server(port=5500):
    """Run the development server"""
    handler = FigtreeDevHandler
    
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"🚀 Figtree Development Server")
        print(f"📂 Serving files from: {os.getcwd()}")
        print(f"🌐 Server running at: http://127.0.0.1:{port}")
        print(f"🔗 Auth page: http://127.0.0.1:{port}/website-auth.html")
        print(f"🛑 Press Ctrl+C to stop")
        print("-" * 50)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

if __name__ == "__main__":
    port = 5500
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number, using default 5500")
    
    run_server(port)