/**
 * Configuração de WebSockets para a Bee TV
 */

// Variáveis globais
let socket;
let currentRoom = null;
let currentChatType = null;

/**
 * @param {string} chatType 
 * @returns {Promise} 
 */
function initSocket(chatType) {
    return new Promise((resolve, reject) => {
        // Se o socket já estiver conectado, apenas atualiza o tipo de chat
        if (socket && socket.connected) {
            currentChatType = chatType;
            resolve(socket);
            return;
        }
        
        // Inicializar o socket com configurações aprimoradas
        socket = io({
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000
        });
        
        currentChatType = chatType;
        
        // Eventos do socket
        socket.on('connect', () => {
            console.log('Conectado ao servidor WebSocket');
            resolve(socket);
        });
        
        socket.on('connect_error', (error) => {
            console.error('Erro na conexão WebSocket:', error);
            reject(error);
        });
        
        socket.on('disconnect', () => {
            console.log('Desconectado do servidor WebSocket');
            updateStatus('Desconectado. Tentando reconectar...');
            document.querySelector('.chat-status').classList.add('disconnected');
        });
        
        // Evento de espera
        socket.on('waiting', () => {
            updateStatus('Procurando alguém para conversar...');
            
            // Desabilitar botão de encerrar conversa
            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = true;
            
            // Desabilitar entrada de mensagem
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) messageInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            
            // Limpar mensagens
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) messagesContainer.innerHTML = '';
            
            // Lidar com elementos de vídeo
            if (chatType === 'video' && window.VideoChat) {
                // VideoChat.stopLocalStream() será chamado apenas se não estivermos reiniciando a conexão
            }
        });
        
        // Evento de nova mensagem
        socket.on('new_message', (data) => {
            // Verificar se a mensagem é nossa
            const isMe = data.sender === socket.id;
            const type = isMe ? 'sent' : 'received';
            
            // Adicionar a mensagem à interface
            addMessage(data.message, type);
            
            if (!isMe) {
                window.BeeTV.playSound('notification');
            }
        });
        
        // Evento de início de chat
        socket.on('chat_started', (data) => {
            currentRoom = data.room;
            updateStatus('Conectado! Você pode começar a conversar.');
            
            const statusElement = document.querySelector('.chat-status');
            if (statusElement) {
                statusElement.classList.add('connected');
                statusElement.classList.remove('disconnected');
            }
            
            // Adicionar mensagem de sistema
            addMessage('Você está conectado com um estranho!', 'system');
            
            // Habilitar botões e controles
            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = false;
            
            // Habilitar entrada de mensagem
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) {
                messageInput.disabled = false;
                messageInput.focus();
            }
            if (sendBtn) sendBtn.disabled = false;
            
            // Tocar som de notificação
            window.BeeTV.playSound('notification');
            
            // Iniciar videochamada se for chat de vídeo
            if (chatType === 'video' && window.VideoChat) {
                console.log('Iniciando chamada de vídeo...');
                // Pequeno atraso para evitar condições de corrida
                setTimeout(() => {
                    // Somente um lado deve iniciar a chamada para evitar conflitos
                    // Usando um sistema simples - quem entrar na sala primeiro será o iniciador
                    const shouldInitiate = data.is_initiator === true || data.room.charAt(0) < '8';
                    
                    if (shouldInitiate) {
                        console.log('Este cliente será o iniciador da chamada');
                        window.VideoChat.startVideoCall(currentRoom);
                    } else {
                        console.log('Este cliente aguardará a oferta do outro par');
                        // Ainda configura a conexão, mas não envia oferta
                        if (window.VideoChat.prepareForCall) {
                            window.VideoChat.prepareForCall();
                        }
                    }
                }, 1000);
            }
        });
        
        // Evento de fim de chat
        socket.on('chat_ended', (data) => {
            currentRoom = null;
            updateStatus('A conversa foi encerrada.');
            
            const statusElement = document.querySelector('.chat-status');
            if (statusElement) {
                statusElement.classList.remove('connected');
            }
            
            // Mostrar mensagem apropriada
            let message = 'O estranho desconectou.';
            if (data && data.reason === 'left') {
                message = 'O estranho encerrou a conversa.';
            }
            addMessage(message, 'system');
            
            // Desabilitar botão de encerrar conversa
            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = true;
            
            // Desabilitar entrada de mensagem
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) messageInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            
            // Encerrar videochamada se for chat de vídeo
            if (chatType === 'video' && window.VideoChat) {
                window.VideoChat.stopLocalStream();
            }
        });
        
        // Eventos específicos para o chat de vídeo
        if (chatType === 'video') {
            socket.on('webrtc_signal', (data) => {
                console.log('Sinal WebRTC recebido do servidor');
                
                // Prevenir processamento de sinais duplicados
                const signalKey = JSON.stringify({
                    type: data.signal.type,
                    sender: data.sender
                });
                
                // Para sinais ICE, adicionar o candidato no hash para garantir unicidade
                if (data.signal.type === 'ice-candidate' && data.signal.candidate) {
                    signalKey.candidate = data.signal.candidate.candidate;
                }
                
                if (window.VideoChat) {
                    // Usar um pequeno atraso para evitar condições de corrida
                    setTimeout(() => {
                        window.VideoChat.handleSignal(data.signal, data.sender);
                    }, 200);
                }
            });
        }
    });
}

/**
 * @param {string} message
 */
function updateStatus(message) {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

/**
 * @param {string} content 
 * @param {string} type 
 */
function addMessage(content, type) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.textContent = content;
    
    messageElement.appendChild(contentElement);
    messagesContainer.appendChild(messageElement);
    
    // Rolar para a última mensagem
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * @param {string} message 
 * @returns {boolean} 
 */
function sendMessage(message) {
    if (!socket || !socket.connected || !currentRoom) {
        console.error('Não é possível enviar mensagem: socket não conectado ou sala não definida');
        return false;
    }
    
    socket.emit('send_message', {
        room: currentRoom,
        message: message
    });
    
    return true;
}

function joinWaitingRoom() {
    if (!socket || !socket.connected) {
        console.error('Não é possível entrar na fila: socket não conectado');
        return false;
    }
    
    console.log('Entrando na sala de espera para:', currentChatType);
    socket.emit('join_waiting_room', {
        type: currentChatType
    });
    
    return true;
}

function leaveChat() {
    if (!socket || !socket.connected || !currentRoom) {
        console.error('Não é possível sair do chat: socket não conectado ou sala não definida');
        return false;
    }
    
    socket.emit('leave_chat', {
        room: currentRoom
    });
    
    currentRoom = null;
    
    return true;
}

/**
 * @param {Object} signal 
 */
function sendWebRTCSignal(signal) {
    if (!socket || !socket.connected || !currentRoom) {
        console.error('Não é possível enviar sinal: socket não conectado ou sala não definida');
        return false;
    }
    
    console.log('Enviando sinal WebRTC:', signal.type);
    socket.emit('webrtc_signal', {
        room: currentRoom,
        signal: signal
    });
    
    return true;
}

// Expor funções para o contexto global
window.SocketManager = {
    initSocket,
    sendMessage,
    joinWaitingRoom,
    leaveChat,
    sendWebRTCSignal
};