/**
 * Configuração de WebSockets para a Bee TV
 */

// Variáveis globais
let socket;
let currentRoom = null;
let currentChatType = null;

/**
 * Inicializa a conexão de socket
 * @param {string} chatType - Tipo de chat ('text' ou 'video')
 * @returns {Promise} Promessa que resolve quando a conexão está pronta
 */
function initSocket(chatType) {
    return new Promise((resolve, reject) => {
        // Verificar se já existe uma conexão
        if (socket && socket.connected) {
            currentChatType = chatType;
            resolve(socket);
            return;
        }
        
        // Criar nova conexão
        socket = io({
            // Add these options for better connection stability
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000
        });
        
        currentChatType = chatType;
        
        // Event listeners
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
        
        // Evento de entrada na fila de espera
        socket.on('waiting', () => {
            updateStatus('Procurando alguém para conversar...');
            
            // Desabilitar botões relevantes
            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = true;
            
            // Desabilitar campos de entrada
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) messageInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            
            // Limpar área de mensagens
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) messagesContainer.innerHTML = '';
            
            // Se for chat de vídeo, parar a transmissão
            if (chatType === 'video' && window.VideoChat) {
                window.VideoChat.stopLocalStream();
            }
        });
        
        // Evento de nova mensagem
        socket.on('new_message', (data) => {
            // Verificar se a mensagem é do usuário atual ou do estranho
            const isMe = data.sender === socket.id;
            const type = isMe ? 'sent' : 'received';
            
            // Adicionar mensagem à conversa
            addMessage(data.message, type);
            
            // Reproduzir som se a mensagem for recebida
            if (!isMe) {
                window.BeeTV.playNotificationSound();
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
            
            // Habilitar botões relevantes
            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = false;
            
            // Habilitar campos de entrada
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) {
                messageInput.disabled = false;
                messageInput.focus();
            }
            if (sendBtn) sendBtn.disabled = false;
            
            // Reproduzir som de notificação
            window.BeeTV.playNotificationSound();
            
            // Se for chat de vídeo, iniciar a transmissão
            if (chatType === 'video' && window.VideoChat) {
                window.VideoChat.startVideoCall(currentRoom);
            }
        });
        
        // Evento de término de chat
        socket.on('chat_ended', (data) => {
            currentRoom = null;
            updateStatus('A conversa foi encerrada.');
            
            const statusElement = document.querySelector('.chat-status');
            if (statusElement) {
                statusElement.classList.remove('connected');
            }
            
            // Adicionar mensagem de sistema
            let message = 'O estranho desconectou.';
            if (data && data.reason === 'left') {
                message = 'O estranho encerrou a conversa.';
            }
            addMessage(message, 'system');
            
            // Desabilitar botões relevantes
            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = true;
            
            // Desabilitar campos de entrada
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) messageInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            
            // Se for chat de vídeo, parar a transmissão
            if (chatType === 'video' && window.VideoChat) {
                window.VideoChat.stopLocalStream();
            }
        });
        
        // Eventos específicos para chat de vídeo
        if (chatType === 'video') {
            socket.on('webrtc_signal', (data) => {
                if (window.VideoChat) {
                    window.VideoChat.handleSignal(data.signal, data.sender);
                }
            });
        }
    });
}

/**
 * Atualiza a mensagem de status
 * @param {string} message - Nova mensagem de status
 */
function updateStatus(message) {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

/**
 * Adiciona uma mensagem à conversa
 * @param {string} content - Conteúdo da mensagem
 * @param {string} type - Tipo de mensagem ('sent', 'received', 'system')
 */
function addMessage(content, type) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    // Criar elementos da mensagem
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.textContent = content;
    
    // Adicionar à DOM
    messageElement.appendChild(contentElement);
    messagesContainer.appendChild(messageElement);
    
    // Rolar para a última mensagem
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Envia uma mensagem para o chat atual
 * @param {string} message - Mensagem a ser enviada
 * @returns {boolean} - Sucesso ou falha
 */
function sendMessage(message) {
    if (!socket || !socket.connected || !currentRoom) {
        console.error('Não é possível enviar mensagem: socket não conectado ou sala não definida');
        return false;
    }
    
    // Enviar mensagem via WebSocket
    socket.emit('send_message', {
        room: currentRoom,
        message: message
    });
    
    return true;
}

/**
 * Entra na fila de espera para um chat
 */
function joinWaitingRoom() {
    if (!socket || !socket.connected) {
        console.error('Não é possível entrar na fila: socket não conectado');
        return false;
    }
    
    // Enviar solicitação para entrar na fila
    socket.emit('join_waiting_room', {
        type: currentChatType
    });
    
    return true;
}

/**
 * Sai do chat atual
 */
function leaveChat() {
    if (!socket || !socket.connected || !currentRoom) {
        console.error('Não é possível sair do chat: socket não conectado ou sala não definida');
        return false;
    }
    
    // Enviar solicitação para sair do chat
    socket.emit('leave_chat', {
        room: currentRoom
    });
    
    // Limpar sala atual
    currentRoom = null;
    
    return true;
}

/**
 * Envia um sinal WebRTC para o par
 * @param {Object} signal - Sinal WebRTC
 */
function sendWebRTCSignal(signal) {
    if (!socket || !socket.connected || !currentRoom) {
        console.error('Não é possível enviar sinal: socket não conectado ou sala não definida');
        return false;
    }
    
    // Enviar sinal via WebSocket
    socket.emit('webrtc_signal', {
        room: currentRoom,
        signal: signal
    });
    
    return true;
}

/**
 * Exportação de funções
 */
window.SocketManager = {
    initSocket,
    sendMessage,
    joinWaitingRoom,
    leaveChat,
    sendWebRTCSignal
};