from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
import uuid
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = 'bee-tv-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Armazenamento de usuários (em memória - não persiste)
waiting_users = {
    'text': [],
    'video': []
}

# Mapeamento de pares de usuários
active_pairs = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat-texto')
def chat_text():
    return render_template('chat_text.html')

@app.route('/chat-video')
def chat_video():
    return render_template('chat_video.html')

# Eventos de Socket.IO
@socketio.on('connect')
def handle_connect():
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
    user_id = request.sid
    chat_type = data['type']  # 'text' ou 'video'
    
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
    user_id = request.sid
    room_id = data.get('room')
    
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
    room_id = data.get('room')
    message = data.get('message')
    
    if room_id and message and room_id in active_pairs:
        # Enviar mensagem para a sala
        emit('new_message', {
            'sender': request.sid,
            'message': message
        }, room=room_id)

# Sinalização WebRTC
@socketio.on('webrtc_signal')
def handle_webrtc_signal(data):
    room_id = data.get('room')
    signal = data.get('signal')
    
    if room_id and signal and room_id in active_pairs:
        pair = active_pairs[room_id]
        sender = request.sid
        receiver = pair[0] if pair[1] == sender else pair[1]
        
        # Enviar sinal para o outro usuário
        emit('webrtc_signal', {
            'sender': sender,
            'signal': signal
        }, room=receiver)

if __name__ == '__main__':
    socketio.run(app, debug=True)