"""
Main application entry point
"""

import os
from dotenv import load_dotenv
from app import create_app, socketio

# Load environment variables
load_dotenv()

# Create Flask app with debug info
app = create_app()
print("App created with registered blueprints")

if __name__ == '__main__':
    # Reduce logging for cleaner output
    import logging
    logging.getLogger('socketio').setLevel(logging.WARNING)
    logging.getLogger('engineio').setLevel(logging.WARNING)
    
    # Run with SocketIO
    socketio.run(
        app,
        host='0.0.0.0',
        port=5001,
        debug=False,  # Disable debug for cleaner logs
        use_reloader=False
    )
