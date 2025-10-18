from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from config import config
import os

# Initialize extensions
socketio = SocketIO()
jwt = JWTManager()
db_session = None

def create_app(config_name=None):
    """Application factory"""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize CORS
    CORS(app, 
         origins=app.config['CORS_ORIGINS'],
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
    
    # Initialize Database
    init_db(app)
    
    # Initialize JWT
    jwt.init_app(app)
    
    # Initialize SocketIO
    socketio.init_app(app, 
                     cors_allowed_origins=app.config['SOCKETIO_CORS_ALLOWED_ORIGINS'],
                     logger=True,
                     engineio_logger=True,
                     ping_timeout=app.config['SOCKETIO_PING_TIMEOUT'],
                     ping_interval=app.config['SOCKETIO_PING_INTERVAL'])
    
    # Register blueprints
    from app.routes import auth, documents, permissions, versions, comments, export_import, workspaces, user_preferences, presence, activities, notification_settings, audit_logs, file_attachments, yjs, upload, notifications, ai_chat
    app.register_blueprint(auth.bp)
    app.register_blueprint(documents.bp)
    app.register_blueprint(permissions.bp)
    app.register_blueprint(versions.bp)
    app.register_blueprint(comments.bp)
    app.register_blueprint(export_import.bp)
    app.register_blueprint(workspaces.bp)
    app.register_blueprint(user_preferences.bp)
    app.register_blueprint(presence.bp)
    app.register_blueprint(activities.bp)
    app.register_blueprint(yjs.bp)
    app.register_blueprint(notification_settings.bp)
    app.register_blueprint(audit_logs.bp)
    app.register_blueprint(file_attachments.bp)
    app.register_blueprint(upload.bp)
    app.register_blueprint(notifications.notifications_bp)
    app.register_blueprint(ai_chat.bp)
    
    # Register socket handlers
    from app.sockets import document_sockets
    document_sockets.register_handlers(socketio)
    
    # Static file serving for uploads
    @app.route('/static/uploads/<path:filename>')
    def uploaded_file(filename):
        from flask import send_from_directory
        upload_dir = os.path.join(app.root_path, '..', 'static', 'uploads')
        return send_from_directory(upload_dir, filename)
    
    # Health check endpoint
    @app.route('/health')
    def health():
        return {'status': 'ok'}, 200
    
    # Teardown
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        if db_session:
            db_session.remove()
    
    return app

def init_db(app):
    """Initialize database connection"""
    global db_session
    
    engine = create_engine(
        app.config['SQLALCHEMY_DATABASE_URI'],
        echo=app.config['SQLALCHEMY_ECHO'],
        pool_pre_ping=True,
        pool_recycle=3600
    )
    
    session_factory = sessionmaker(bind=engine)
    db_session = scoped_session(session_factory)
    
    # Make db_session available in app context
    app.db_session = db_session
    
    return db_session

def get_db():
    """Get database session"""
    from flask import current_app
    return current_app.db_session
