from flask import Blueprint, request, Response
from flask_socketio import SocketIO, emit, join_room
from app.auth import decode_jwt
import json

bp = Blueprint('yjs', __name__, url_prefix='/yjs')

@bp.route('/<document_id>', methods=['GET', 'POST', 'OPTIONS', 'PATCH', 'PUT'])
def yjs_websocket(document_id):
    """Handle YJS WebSocket connections for collaborative editing"""
    
    # Get token from query parameter
    token = request.args.get('token')
    if not token:
        return Response('Unauthorized: Token required', status=401)
    
    # Verify token
    payload = decode_jwt(token)
    if not payload:
        return Response('Unauthorized: Invalid token', status=401)
    
    # For WebSocket upgrade requests, return appropriate headers
    if request.headers.get('Upgrade') == 'websocket':
        return Response('WebSocket Upgrade', status=101, headers={
            'Upgrade': 'websocket',
            'Connection': 'Upgrade',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH, PUT',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection'
        })
    
    # For regular HTTP requests, return success
    return Response('YJS WebSocket endpoint ready', status=200, headers={
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH, PUT',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection'
    })

@bp.route('/<document_id>', methods=['OPTIONS'])
def yjs_options(document_id):
    """Handle CORS preflight for YJS WebSocket"""
    return Response('', status=200, headers={
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH, PUT',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection'
    })