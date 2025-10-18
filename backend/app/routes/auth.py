from flask import Blueprint, request, jsonify, current_app
from app.auth import verify_google_token, generate_jwt, get_or_create_user, require_auth

bp = Blueprint('auth', __name__, url_prefix='/auth')

@bp.route('/google', methods=['POST'])
def google_auth():
    """Authenticate with Google OAuth"""
    data = request.get_json()
    token = data.get('token')
    
    print(f"DEBUG: Received auth request with token: {token[:20] if token else 'None'}...")
    
    if not token:
        print("DEBUG: No token provided")
        return jsonify({'error': 'Token required'}), 400
    
    google_user = verify_google_token(token) # Verify Google token
    print(f"DEBUG: Google user verification result: {google_user}")
    
    if not google_user:
        print("DEBUG: Google token verification failed")
        return jsonify({'error': 'Invalid token'}), 401
    
    # Get or create user
    user = get_or_create_user(
        email=google_user['email'], display_name=google_user['name'],
        avatar_url=google_user['picture'], google_id=google_user['sub'])
    
    jwt_token = generate_jwt(user.id) # Generate JWT
    
    return jsonify({'token': jwt_token, 'user': user.to_dict()}), 200

@bp.route('/me', methods=['GET'])
@require_auth
def get_current_user_info(user):
    """Get current user information"""
    return jsonify({'user': user.to_dict()}), 200

@bp.route('/refresh', methods=['POST'])
@require_auth
def refresh_token(user):
    """Refresh JWT token"""
    new_token = generate_jwt(user.id)
    return jsonify({'token': new_token}), 200
