"""
WebSocket handlers for real-time collaboration
"""

from flask_socketio import emit, join_room, leave_room, rooms
from flask import request
from app.auth import decode_jwt
from app.models import Document, Permission, Operation, Version, User, UserPresence
from app.ot_engine import OTEngine
from app import get_db
from app.services.activity_service import ActivityService
from datetime import datetime
import json
from collections import defaultdict

# Debug print function
def debug_print(message):
    print(f"[DEBUG] {message}")

# Store active users per document
active_users = {}  # {document_id: {user_id: {sid, cursor_pos, color}}}

# Store video call sessions
video_call_sessions = defaultdict(dict)  # {document_id: {'creator': user_name, 'creator_id': user_id, 'participants': [user_id]}}}

# Store pending operations per document
pending_operations = {}  # {document_id: [operations]}

# Debug mode - set to True to enable logging
DEBUG_SOCKET = True

def debug_debug_print(*args, **kwargs):
    """Conditional print for debugging"""
    if DEBUG_SOCKET:
        debug_print(*args, **kwargs)

def register_handlers(socketio):
    """Register all WebSocket event handlers"""
    
    @socketio.on('connect')
    def handle_connect(auth):
        """Handle client connection"""
        try:
            # Try to get token from multiple sources
            token = None
            
            # Try query parameter first
            if hasattr(request, 'args') and request.args:
                token = request.args.get('token')
                debug_debug_print(f"Token from query params: {bool(token)}")
            
            # Try auth object if query didn't work
            if not token and auth and isinstance(auth, dict):
                token = auth.get('token')
                debug_print(f"Token from auth object: {bool(token)}")
                
            # Try from headers
            if not token and hasattr(request, 'headers'):
                auth_header = request.headers.get('Authorization')
                if auth_header and auth_header.startswith('Bearer '):
                    token = auth_header[7:]
                    debug_print(f"Token from headers: {bool(token)}")
                
            debug_print(f"WebSocket connect attempt, final token present: {bool(token)}")
            
            if not token:
                debug_print("No token provided in WebSocket connection")
                emit('error', {'message': 'Authentication required'})
                return False
            
            payload = decode_jwt(token)
            debug_print(f"Token decode result: {payload}")
            
            if not payload:
                debug_print("Invalid token provided")
                emit('error', {'message': 'Invalid token'})
                return False
            
            if not payload:
                debug_print("Invalid token in WebSocket connection")
                return False
            
            # Store user info in session
            request.user_id = payload['user_id']
            debug_print(f"Client connected: {request.sid}, user_id: {payload['user_id']}")
            return True
            
        except Exception as e:
            debug_print(f"Error in WebSocket connect: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        sid = request.sid
        
        # Remove user from all rooms
        for document_id, users in list(active_users.items()):
            for user_id, data in list(users.items()):
                if data.get('sid') == sid:
                    del active_users[document_id][user_id]
                    
                    # Notify others
                    emit('presence.left', {
                        'user_id': user_id,
                        'document_id': document_id
                    }, room=f'doc_{document_id}', skip_sid=sid)
                    
                    # Clean up empty rooms
                    if not active_users[document_id]:
                        del active_users[document_id]
        
        debug_print(f"Client disconnected: {sid}")
    
    @socketio.on('join')
    def handle_join(data):
        """Handle user joining a document room"""
        token = request.args.get('token')
        payload = decode_jwt(token)
        
        if not payload:
            emit('error', {'message': 'Invalid token'})
            return
        
        user_id = payload['user_id']
        document_id = data.get('document_id')
        
        if not document_id:
            emit('error', {'message': 'document_id required'})
            return
        
        db = get_db()
        
        # Check permission
        permission = db.query(Permission).filter_by(
            document_id=document_id,
            user_id=user_id
        ).first()
        
        # Also check share token
        if not permission:
            share_token = data.get('share_token')
            document = db.query(Document).filter_by(id=document_id).first()
            if share_token and document and document.share_token == share_token:
                # Allow access with viewer role
                permission_role = 'viewer'
            else:
                emit('error', {'message': 'Access denied'})
                return
        else:
            permission_role = permission.role
        
        # Get user info
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            emit('error', {'message': 'User not found'})
            return
        
        # Get document
        document = db.query(Document).filter_by(id=document_id).first()
        if not document:
            emit('error', {'message': 'Document not found'})
            return
        
        # Join room
        room = f'doc_{document_id}'
        join_room(room)
        
        # Track active user
        if document_id not in active_users:
            active_users[document_id] = {}
        
        # Generate random color for cursor
        import random
        color = f"#{random.randint(0, 0xFFFFFF):06x}"
        
        active_users[document_id][user_id] = {
            'sid': request.sid,
            'user': user.to_dict(),
            'color': color,
            'cursor': None,
            'role': permission_role
        }
        
        # Send current state to joining user
        emit('joined', {
            'document_id': document_id,
            'document': document.to_dict(include_content=True),
            'role': permission_role,
            'active_users': [
                {
                    'user_id': uid,
                    'user': data['user'],
                    'color': data['color'],
                    'cursor': data['cursor']
                }
                for uid, data in active_users[document_id].items()
            ]
        })
        
        # Notify others
        emit('presence.joined', {
            'user_id': user_id,
            'user': user.to_dict(),
            'color': color,
            'document_id': document_id
        }, room=room, skip_sid=request.sid)
        
        debug_print(f"User {user_id} joined document {document_id}")
    
    @socketio.on('leave')
    def handle_leave(data):
        """Handle user leaving a document room"""
        token = request.args.get('token')
        payload = decode_jwt(token)
        
        if not payload:
            return
        
        user_id = payload['user_id']
        document_id = data.get('document_id')
        
        if not document_id:
            return
        
        room = f'doc_{document_id}'
        leave_room(room)
        
        # Remove from active users
        if document_id in active_users and user_id in active_users[document_id]:
            del active_users[document_id][user_id]
            
            # Notify others
            emit('presence.left', {
                'user_id': user_id,
                'document_id': document_id
            }, room=room)
            
            # Clean up
            if not active_users[document_id]:
                del active_users[document_id]
        
        debug_print(f"User {user_id} left document {document_id}")
    
    @socketio.on('op.apply')
    def handle_operation(data):
        """Handle operation from client"""
        token = request.args.get('token')
        payload = decode_jwt(token)
        
        if not payload:
            emit('error', {'message': 'Invalid token'})
            return
        
        user_id = payload['user_id']
        document_id = data.get('document_id')
        operation = data.get('operation')
        client_version = data.get('version')
        
        if not document_id or not operation:
            emit('error', {'message': 'document_id and operation required'})
            return
        
        db = get_db()
        
        # Check permission (must be editor or owner)
        permission = db.query(Permission).filter_by(
            document_id=document_id,
            user_id=user_id
        ).first()
        
        if not permission or permission.role not in ['owner', 'editor']:
            emit('error', {'message': 'Insufficient permissions'})
            return
        
        # Get document
        document = db.query(Document).filter_by(id=document_id).first()
        if not document:
            emit('error', {'message': 'Document not found'})
            return
        
        # Validate operation
        if not OTEngine.validate_operation(operation):
            emit('error', {'message': 'Invalid operation'})
            return
        
        # Check version and transform if needed
        if client_version < document.current_version:
            # Get operations since client version
            recent_ops = db.query(Operation).filter(
                Operation.document_id == document_id,
                Operation.version_no > client_version,
                Operation.version_no <= document.current_version
            ).order_by(Operation.version_no).all()
            
            # Transform against each recent operation
            transformed_op = operation
            for recent_op in recent_ops:
                server_op = json.loads(recent_op.op_payload)
                transformed_op = OTEngine.transform(transformed_op, server_op, side='left')
                
                if transformed_op is None:
                    # Operation was nullified
                    emit('op.rejected', {
                        'reason': 'Operation conflict',
                        'server_version': document.current_version
                    })
                    return
        else:
            transformed_op = operation
        
        # Apply operation to document
        try:
            if isinstance(document.content, str):
                content = document.content
            else:
                content = json.loads(document.content) if document.content else {}
            
            new_content = OTEngine.apply_operation(content, transformed_op)
            
            if isinstance(new_content, dict):
                document.content = json.dumps(new_content)
            else:
                document.content = new_content
        except Exception as e:
            debug_print(f"Error applying operation: {e}")
            emit('error', {'message': 'Failed to apply operation'})
            return
        
        # Increment version
        document.current_version += 1
        document.updated_at = datetime.utcnow()
        new_version = document.current_version
        
        # Save operation
        op_record = Operation(
            document_id=document_id,
            version_no=new_version,
            user_id=user_id,
            op_type=transformed_op.get('type', 'unknown'),
            op_payload=json.dumps(transformed_op)
        )
        db.add(op_record)
        
        # Check if we need to create a snapshot
        from flask import current_app
        snapshot_interval = current_app.config.get('SNAPSHOT_INTERVAL', 150)
        
        if new_version % snapshot_interval == 0:
            version = Version(
                document_id=document_id,
                version_no=new_version,
                created_by=user_id,
                snapshot_content=document.content,
                snapshot_ref=f"Auto-snapshot at version {new_version}"
            )
            db.add(version)
        
        db.commit()
        
        # Broadcast to all users in room
        room = f'doc_{document_id}'
        emit('op.committed', {
            'document_id': document_id,
            'operation': transformed_op,
            'version': new_version,
            'user_id': user_id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room, skip_sid=request.sid)
        
        # Acknowledge to sender
        emit('op.acknowledged', {
            'document_id': document_id,
            'version': new_version,
            'server_version': new_version
        })
        
        debug_print(f"Operation applied: doc={document_id}, version={new_version}, user={user_id}")
    
    @socketio.on('presence.update')
    def handle_presence_update(data):
        """Handle cursor/selection update"""
        token = request.args.get('token')
        payload = decode_jwt(token)
        
        if not payload:
            return
        
        user_id = payload['user_id']
        document_id = data.get('document_id')
        cursor = data.get('cursor')
        
        if not document_id:
            return
        
        # Update cursor position
        if document_id in active_users and user_id in active_users[document_id]:
            active_users[document_id][user_id]['cursor'] = cursor
            
            # Broadcast to others
            room = f'doc_{document_id}'
            emit('presence.updated', {
                'user_id': user_id,
                'cursor': cursor,
                'document_id': document_id
            }, room=room, skip_sid=request.sid)
    
    @socketio.on('content.change')
    def handle_content_change(data):
        """
        Handle real-time content changes (Simple Broadcast)
        This is for live editing without complex OT
        """
        token = request.args.get('token')
        payload = decode_jwt(token)
        
        if not payload:
            emit('error', {'message': 'Invalid token'})
            return
        
        user_id = payload['user_id']
        document_id = data.get('document_id')
        content = data.get('content')  # HTML content from TipTap
        
        if not document_id or content is None:
            emit('error', {'message': 'document_id and content required'})
            return
        
        db = get_db()
        
        # Check permission (must be editor or owner)
        permission = db.query(Permission).filter_by(
            document_id=document_id,
            user_id=user_id
        ).first()
        
        if not permission or permission.role not in ['owner', 'editor']:
            emit('error', {'message': 'Insufficient permissions - only Editor/Owner can edit'})
            return
        
        # Get document
        document = db.query(Document).filter_by(id=document_id).first()
        if not document:
            emit('error', {'message': 'Document not found'})
            return
        
        # Update document content (NO version created here)
        document.content = content
        document.updated_at = datetime.utcnow()
        db.commit()
        
        # Broadcast to all other users in room
        room = f'doc_{document_id}'
        emit('content.updated', {
            'document_id': document_id,
            'content': content,
            'user_id': user_id,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }, room=room, skip_sid=request.sid)  # skip_sid to not send back to sender
        
        debug_print(f"Content updated: doc={document_id}, user={user_id}, length={len(content)}")

    @socketio.on('comment.add')
    def handle_add_comment(data):
        """Handle new comment creation"""
        try:
            token = request.args.get('token')
            payload = decode_jwt(token)
            
            if not payload:
                emit('error', {'message': 'Invalid token'})
                return
            
            user_id = payload['user_id']
            document_id = data.get('document_id')
            comment_data = data.get('comment')
            
            if not document_id or not comment_data:
                emit('error', {'message': 'document_id and comment data required'})
                return
            
            # Broadcast new comment to all users in room
            room = f'doc_{document_id}'
            emit('comment.new', {
                'document_id': document_id,
                'comment': comment_data,
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }, room=room, include_self=True)
            
            debug_print(f"New comment broadcasted: doc={document_id}, user={user_id}")
            
        except Exception as e:
            debug_print(f"Error handling add comment: {e}")
            emit('error', {'message': 'Failed to broadcast comment'})

    @socketio.on('comment.update')
    def handle_update_comment(data):
        """Handle comment update"""
        try:
            token = request.args.get('token')
            payload = decode_jwt(token)
            
            if not payload:
                emit('error', {'message': 'Invalid token'})
                return
            
            user_id = payload['user_id']
            document_id = data.get('document_id')
            comment_data = data.get('comment')
            
            if not document_id or not comment_data:
                emit('error', {'message': 'document_id and comment data required'})
                return
            
            # Broadcast updated comment to all users in room
            room = f'doc_{document_id}'
            emit('comment.updated', {
                'document_id': document_id,
                'comment': comment_data,
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }, room=room, include_self=True)
            
            debug_print(f"Comment updated broadcasted: doc={document_id}, user={user_id}")
            
        except Exception as e:
            debug_print(f"Error handling update comment: {e}")
            emit('error', {'message': 'Failed to broadcast comment update'})

    @socketio.on('comment.delete')
    def handle_delete_comment(data):
        """Handle comment deletion"""
        try:
            token = request.args.get('token')
            payload = decode_jwt(token)
            
            if not payload:
                emit('error', {'message': 'Invalid token'})
                return
            
            user_id = payload['user_id']
            document_id = data.get('document_id')
            comment_id = data.get('comment_id')
            
            if not document_id or not comment_id:
                emit('error', {'message': 'document_id and comment_id required'})
                return
            
            # Broadcast comment deletion to all users in room
            room = f'doc_{document_id}'
            emit('comment.deleted', {
                'document_id': document_id,
                'comment_id': comment_id,
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }, room=room, include_self=True)
            
            debug_print(f"Comment deletion broadcasted: doc={document_id}, user={user_id}, comment={comment_id}")
            
        except Exception as e:
            debug_print(f"Error handling delete comment: {e}")
            emit('error', {'message': 'Failed to broadcast comment deletion'})

    @socketio.on('cursor.update')
    def handle_cursor_update(data):
        """Handle cursor position updates"""
        try:
            document_id = data.get('document_id')
            cursor = data.get('cursor')
            user_id = data.get('user_id')
            
            if not all([document_id, user_id, cursor is not None]):
                emit('error', {'message': 'Invalid cursor update data'})
                return
            
            room = f'doc_{document_id}'
            
            # Update cursor position in active users
            if document_id in active_users and user_id in active_users[document_id]:
                active_users[document_id][user_id]['cursor'] = cursor
            
            # Broadcast cursor update to other users in the room
            emit('cursor.update', {
                'document_id': document_id,
                'user_id': user_id,
                'cursor': cursor,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }, room=room, skip_sid=request.sid)  # Skip sender
            
        except Exception as e:
            debug_print(f"Error handling cursor update: {e}")
            emit('error', {'message': 'Failed to broadcast cursor update'})

    @socketio.on('video_call.start')
    def handle_video_call_start(data):
        """Handle video call start"""
        try:
            document_id = data.get('document_id')
            user_id = data.get('user_id')
            user_name = data.get('user_name')
            
            if not all([document_id, user_id, user_name]):
                emit('error', {'message': 'Invalid video call start data'})
                return
            
            # Store video call session
            video_call_sessions[document_id] = {
                'creator': user_name,
                'creator_id': user_id,
                'participants': [user_id],
                'created_at': datetime.utcnow().isoformat() + 'Z'
            }
            
            room = f'doc_{document_id}'
            
            # Broadcast video call start to other users in the room
            emit('video_call.started', {
                'document_id': document_id,
                'user_id': user_id,
                'user_name': user_name,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }, room=room, skip_sid=request.sid)
            
            debug_print(f"Video call started: doc={document_id}, user={user_name}, session={video_call_sessions[document_id]}")
            
        except Exception as e:
            debug_print(f"Error handling video call start: {e}")
            emit('error', {'message': 'Failed to broadcast video call start'})

    @socketio.on('video_call.join')
    def handle_video_call_join(data):
        """Handle video call join"""
        try:
            document_id = data.get('document_id')
            user_id = data.get('user_id')
            user_name = data.get('user_name')
            
            if not all([document_id, user_id, user_name]):
                emit('error', {'message': 'Invalid video call join data'})
                return
            
            # Add user to video call session
            if document_id in video_call_sessions:
                if user_id not in video_call_sessions[document_id]['participants']:
                    video_call_sessions[document_id]['participants'].append(user_id)
            
            room = f'doc_{document_id}'
            
            # Broadcast video call join to other users in the room
            emit('video_call.joined', {
                'document_id': document_id,
                'user_id': user_id,
                'user_name': user_name,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }, room=room, skip_sid=request.sid)
            
            debug_print(f"Video call joined: doc={document_id}, user={user_name}, participants={len(video_call_sessions.get(document_id, {}).get('participants', []))}")
            
        except Exception as e:
            debug_print(f"Error handling video call join: {e}")
            emit('error', {'message': 'Failed to broadcast video call join'})

    @socketio.on('video_call.end')
    def handle_video_call_end(data):
        """Handle video call end"""
        try:
            document_id = data.get('document_id')
            user_id = data.get('user_id')
            user_name = data.get('user_name')
            is_creator = data.get('is_creator', False)
            
            if not all([document_id, user_id]):
                emit('error', {'message': 'Invalid video call end data'})
                return
            
            room = f'doc_{document_id}'
            
            # Handle session cleanup
            if document_id in video_call_sessions:
                if is_creator or user_id == video_call_sessions[document_id].get('creator_id'):
                    # Creator is ending the call - end for everyone
                    del video_call_sessions[document_id]
                    emit('video_call.ended', {
                        'document_id': document_id,
                        'user_id': user_id,
                        'user_name': user_name,
                        'is_creator': True,
                        'timestamp': datetime.utcnow().isoformat() + 'Z'
                    }, room=room, skip_sid=request.sid)
                    debug_print(f"Video call ended by creator: doc={document_id}, user={user_name}")
                else:
                    # Regular participant leaving
                    participants = video_call_sessions[document_id].get('participants', [])
                    if user_id in participants:
                        participants.remove(user_id)
                    
                    # If no participants left, end the call
                    if len(participants) <= 1:  # Only creator left
                        del video_call_sessions[document_id]
                        emit('video_call.ended', {
                            'document_id': document_id,
                            'user_id': user_id,
                            'user_name': user_name,
                            'is_creator': True,  # Call ending because no one left
                            'timestamp': datetime.utcnow().isoformat() + 'Z'
                        }, room=room, skip_sid=request.sid)
                        debug_print(f"Video call ended (no participants): doc={document_id}, user={user_name}")
                    else:
                        emit('video_call.ended', {
                            'document_id': document_id,
                            'user_id': user_id,
                            'user_name': user_name,
                            'is_creator': False,
                            'timestamp': datetime.utcnow().isoformat() + 'Z'
                        }, room=room, skip_sid=request.sid)
                        debug_print(f"User left video call: doc={document_id}, user={user_name}, remaining={len(participants)}")
            
        except Exception as e:
            debug_print(f"Error handling video call end: {e}")
            emit('error', {'message': 'Failed to broadcast video call end'})

    @socketio.on('video_call.get_status')
    def handle_video_call_get_status(data):
        """Get current video call status for a document"""
        try:
            document_id = data.get('document_id')
            
            if not document_id:
                emit('error', {'message': 'Invalid document ID'})
                return
            
            # Get current call status
            call_session = video_call_sessions.get(document_id, {})
            is_active = bool(call_session)
            
            participants_info = []
            if is_active:
                # Get participant names - you may want to query actual user data
                participant_ids = call_session.get('participants', [])
                for pid in participant_ids:
                    # This is simplified - in production you'd query user database
                    participants_info.append({
                        'id': pid, 
                        'name': f'User-{pid}'  # You should get actual user name from DB
                    })
            
            response_data = {
                'document_id': document_id,
                'is_active': is_active,
                'creator': call_session.get('creator', ''),
                'participants': participants_info,
                'created_at': call_session.get('created_at', ''),
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
            
            emit('video_call.status', response_data)
            
            debug_print(f"Video call status sent: doc={document_id}, active={is_active}, creator={call_session.get('creator', '')}, participants={len(participants_info)}")
            debug_print(f"Current sessions: {dict(video_call_sessions)}")
            
        except Exception as e:
            debug_print(f"Error getting video call status: {e}")
            emit('error', {'message': 'Failed to get video call status'})
