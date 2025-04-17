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
       
        if (socket && socket.connected) {
            currentChatType = chatType;
            resolve(socket);
            return;
        }
        
      
        socket = io({
          
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000
        });
        
        currentChatType = chatType;
        

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
        

        socket.on('waiting', () => {
            updateStatus('Procurando alguém para conversar...');
            

            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = true;
            

            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) messageInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            

            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) messagesContainer.innerHTML = '';
            

            if (chatType === 'video' && window.VideoChat) {
                window.VideoChat.stopLocalStream();
            }
        });
        

        socket.on('new_message', (data) => {
           
            const isMe = data.sender === socket.id;
            const type = isMe ? 'sent' : 'received';
            
           
            addMessage(data.message, type);
            
            if (!isMe) {
                window.BeeTV.playNotificationSound();
            }
        });
        
        socket.on('chat_started', (data) => {
            currentRoom = data.room;
            updateStatus('Conectado! Você pode começar a conversar.');
            
            const statusElement = document.querySelector('.chat-status');
            if (statusElement) {
                statusElement.classList.add('connected');
                statusElement.classList.remove('disconnected');
            }
            
           
            addMessage('Você está conectado com um estranho!', 'system');
            
            
            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = false;
            
           
            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) {
                messageInput.disabled = false;
                messageInput.focus();
            }
            if (sendBtn) sendBtn.disabled = false;
            
           
            window.BeeTV.playNotificationSound();
            
            
            if (chatType === 'video' && window.VideoChat) {
                window.VideoChat.startVideoCall(currentRoom);
            }
        });
        

        socket.on('chat_ended', (data) => {
            currentRoom = null;
            updateStatus('A conversa foi encerrada.');
            
            const statusElement = document.querySelector('.chat-status');
            if (statusElement) {
                statusElement.classList.remove('connected');
            }
            

            let message = 'O estranho desconectou.';
            if (data && data.reason === 'left') {
                message = 'O estranho encerrou a conversa.';
            }
            addMessage(message, 'system');
            

            const endChatBtn = document.getElementById('end-chat-btn');
            if (endChatBtn) endChatBtn.disabled = true;
            

            const messageInput = document.getElementById('message-input');
            const sendBtn = document.getElementById('send-btn');
            if (messageInput) messageInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;
            

            if (chatType === 'video' && window.VideoChat) {
                window.VideoChat.stopLocalStream();
            }
        });
        

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
    
    socket.emit('webrtc_signal', {
        room: currentRoom,
        signal: signal
    });
    
    return true;
}

window.SocketManager = {
    initSocket,
    sendMessage,
    joinWaitingRoom,
    leaveChat,
    sendWebRTCSignal
};