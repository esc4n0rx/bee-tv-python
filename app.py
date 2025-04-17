from flask import Flask, render_template, request, session
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
from flask_assets import Environment, Bundle
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import uuid
import logging
import os
import secrets
import html

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# Configurações de segurança para cookies
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hora

# Configuração do limitador de taxa
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Configuração de assets
assets = Environment(app)
js = Bundle('js/main.js', 'js/chat-text.js', 'js/chat-video.js', 'js/socket.js',
            filters='jsmin', output='gen/packed.js')
assets.register('js_all', js)

css = Bundle('css/style.css', 'css/home.css', 'css/chat-text.css', 'css/chat-video.css',
             filters='cssmin', output='gen/packed.css')
assets.register('css_all', css)

# Configurar o SocketIO para produção
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    ping_timeout=60,
    ping_interval=25,
    logger=True,
    engineio_logger=True
)

# Configuração de logs
if not app.debug:
    file_handler = logging.handlers.RotatingFileHandler(
        'bee_tv.log', maxBytes=10240, backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Bee TV startup')
else:
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

logger = logging.getLogger(__name__)

# Armazenamento de usuários (em memória - não persiste)
waiting_users = {
    'text': [],
    'video': []
}

# Mapeamento de pares de usuários
active_pairs = {}

# Validação de sessão
def validate_session(request):
    # Verifica se existe uma sessão válida
    # Esta é uma implementação básica que você pode expandir
    if session.get('socket_token'):
        return True
    return True  # Por enquanto, aceita todas as conexões

# Adicionar cabeçalhos de segurança
@app.after_request
def add_security_headers(response):
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://*;"
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat-texto')
@limiter.limit("10 per minute")
def chat_text():
    return render_template('chat_text.html')

@app.route('/chat-video')
@limiter.limit("10 per minute")
def chat_video():
    return render_template('chat_video.html')

# Eventos de Socket.IO
@socketio.on('connect')
def handle_connect():
    # Gerar um token temporário para a sessão
    session_token = str(uuid.uuid4())
    session['socket_token'] = session_token
    
    # Verificar sessão antes de permitir conexão
    if not validate_session(request):
        return False  # Rejeita conexão
    
    logger.info(f'Cliente conectado: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f'Cliente desconectado: {request.sid}')
    
    # Remover usuário das filas de espera
    for chat_type in waiting_users:
        if request.sid in waiting_users[chat_type]:
            waiting_users[chat_type].remove(request.sid)
    
    # Notificar par se estiver em uma conversa ativa
    for room_id, pair in list(active_pairs.items()):
        if request.sid in pair:
            other_user = pair[0] if pair[1] == request.sid else pair[1]
            leave_room(room_id)
            emit('chat_ended', {'reason': 'disconnect'}, room=other_user)
            del active_pairs[room_id]

@socketio.on('join_waiting_room')
def handle_join_waiting_room(data):
    if not isinstance(data, dict) or 'type' not in data:
        return
    
    user_id = request.sid
    chat_type = data.get('type')  # 'text' ou 'video'
    
    # Validar tipo de chat
    if chat_type not in ['text', 'video']:
        return
    
    logger.info(f'Usuário {user_id} entrando na fila de espera para {chat_type}')
    
    # Verificar se usuário já está em alguma fila
    for c_type in waiting_users:
        if user_id in waiting_users[c_type]:
            waiting_users[c_type].remove(user_id)
    
    # Verificar se há usuário esperando
    if waiting_users[chat_type]:
        other_user = waiting_users[chat_type].pop(0)
        room_id = str(uuid.uuid4())
        
        # Criar par
        active_pairs[room_id] = (other_user, user_id)
        
        # Juntar ambos na mesma sala
        join_room(room_id, other_user)
        join_room(room_id, user_id)
        
        logger.info(f'Par criado na sala {room_id}: {other_user} e {user_id}')
        
        # Notificar ambos os usuários
        emit('chat_started', {'room': room_id}, room=room_id)
    else:
        # Adicionar usuário à fila de espera
        waiting_users[chat_type].append(user_id)
        emit('waiting', {})

@socketio.on('leave_chat')
def handle_leave_chat(data):
    if not isinstance(data, dict):
        return
    
    user_id = request.sid
    room_id = data.get('room')
    
    if not room_id or not isinstance(room_id, str):
        return
    
    if room_id and room_id in active_pairs:
        pair = active_pairs[room_id]
        if user_id in pair:
            other_user = pair[0] if pair[1] == user_id else pair[1]
            
            # Remover da sala
            leave_room(room_id)
            emit('chat_ended', {'reason': 'left'}, room=other_user)
            
            # Remover par
            del active_pairs[room_id]
            logger.info(f'Usuário {user_id} saiu da sala {room_id}')

@socketio.on('send_message')
def handle_send_message(data):
    if not isinstance(data, dict):
        return
    
    room_id = data.get('room')
    message = data.get('message')
    
    if not room_id or not message or not isinstance(message, str) or not isinstance(room_id, str):
        return
    
    # Limitar tamanho da mensagem
    message = message[:500]
    
    # Verificar se usuário está na sala
    if room_id not in active_pairs or request.sid not in active_pairs[room_id]:
        return
    
    # Sanitizar mensagem
    message = html.escape(message)
    
    # Enviar mensagem para a sala
    emit('new_message', {
        'sender': request.sid,
        'message': message
    }, room=room_id)

# Sinalização WebRTC
@socketio.on('webrtc_signal')
def handle_webrtc_signal(data):
    if not isinstance(data, dict):
        return
    
    room_id = data.get('room')
    signal = data.get('signal')
    
    if not room_id or not signal or not isinstance(room_id, str):
        return
    
    # Verificar se usuário está na sala
    if room_id not in active_pairs or request.sid not in active_pairs[room_id]:
        return
    
    pair = active_pairs[room_id]
    sender = request.sid
    receiver = pair[0] if pair[1] == sender else pair[1]
    
    # Enviar sinal para o outro usuário
    emit('webrtc_signal', {
        'sender': sender,
        'signal': signal
    }, room=receiver)

if __name__ == '__main__':
    # Obter porta do ambiente ou usar 5000 como padrão
    port = int(os.environ.get('PORT', 5000))
    
    # Em produção, use 0.0.0.0 para ouvir em todas as interfaces
    host = os.environ.get('HOST', '0.0.0.0')
    
    # Usar modo debug com base em variável de ambiente
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    # Iniciar o servidor
    socketio.run(app, host=host, port=port, debug=debug)