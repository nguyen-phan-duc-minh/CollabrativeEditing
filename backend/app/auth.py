import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
from app.models import User
from app import get_db

def generate_jwt(user_id):
    """Generate JWT token for user"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES'],
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    return token

def decode_jwt(token):
    """Decode JWT token"""
    try:
        payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_current_user():
    """Get current user from JWT token"""
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    payload = decode_jwt(token)
    
    if not payload:
        return None
    
    db = get_db()
    user = db.query(User).filter_by(id=payload['user_id']).first()
    return user

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return f(user, *args, **kwargs)
    return decorated_function

def get_or_create_user(email, display_name=None, avatar_url=None, google_id=None):
    """Get or create user by email"""
    db = get_db()
    user = db.query(User).filter_by(email=email).first()
    
    if not user:
        user = User(
            email=email,
            display_name=display_name or email.split('@')[0],
            avatar_url=avatar_url,
            google_id=google_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update user info if provided
        if google_id and not user.google_id:
            user.google_id = google_id
        if avatar_url:
            user.avatar_url = avatar_url
        if display_name:
            user.display_name = display_name
        user.updated_at = datetime.utcnow()
        db.commit()
    
    return user

def verify_google_token(token):
    """Verify Google OAuth token (access_token)"""
    import requests as http_requests
    
    try:
        # Use access_token to get user info from Google API
        response = http_requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10
        )
        
        print(f"DEBUG: Google userinfo response status: {response.status_code}")
        if response.status_code != 200:
            print(f"DEBUG: Google userinfo error: {response.text}")
            return None
        
        userinfo = response.json()
        print(f"DEBUG: Google userinfo: {userinfo}")
        
        # Verify the token is for the correct client
        token_info_response = http_requests.get(
            f'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token={token}',
            timeout=10
        )
        
        print(f"DEBUG: Token info response status: {token_info_response.status_code}")
        if token_info_response.status_code != 200:
            print(f"DEBUG: Token info error: {token_info_response.text}")
            return None
            
        token_info = token_info_response.json()
        print(f"DEBUG: Token info: {token_info}")
        
        # Check if token is for our client ID (optional but recommended)
        expected_client_id = current_app.config.get('GOOGLE_CLIENT_ID')
        print(f"DEBUG: Expected client ID: {expected_client_id}")
        print(f"DEBUG: Token audience: {token_info.get('aud')}")
        
        if 'aud' in token_info and expected_client_id and token_info['aud'] != expected_client_id:
            print("DEBUG: Client ID mismatch")
            return None
        
        result = {
            'email': userinfo['email'],
            'name': userinfo.get('name', ''),
            'picture': userinfo.get('picture', ''),
            'sub': userinfo['sub']
        }
        print(f"DEBUG: Returning user result: {result}")
        return result
    except Exception as e:
        current_app.logger.error(f"Google token verification failed: {str(e)}")
        return None
