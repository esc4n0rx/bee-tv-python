/**
 * Lógica do chat de texto da Bee TV
 */

document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const endChatBtn = document.getElementById('end-chat-btn');
    
    window.SocketManager.initSocket('text')
        .then(() => {
            console.log('Socket inicializado com sucesso para chat de texto');
            window.SocketManager.joinWaitingRoom();
        })
        .catch(error => {
            console.error('Erro ao inicializar socket:', error);
            alert('Erro de conexão. Por favor, recarregue a página.');
        });
    
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (newChatBtn) {
        newChatBtn.addEventListener('click', function() {
            window.SocketManager.leaveChat();
            
            window.SocketManager.joinWaitingRoom();
            
            updateStatus('Procurando um novo estranho para conversar...');
        });
    }
    
    if (endChatBtn) {
        endChatBtn.addEventListener('click', function() {
            window.SocketManager.leaveChat();
            
            endChatBtn.disabled = true;
            messageInput.disabled = true;
            sendBtn.disabled = true;
            updateStatus('Você encerrou a conversa.');
            addSystemMessage('Você encerrou a conversa.');
        });
    }
    

    function sendMessage() {
        if (!messageInput || messageInput.disabled || !messageInput.value.trim()) {
            return;
        }
        
        const message = messageInput.value.trim();
        
        const success = window.SocketManager.sendMessage(message);
        
        if (success) {
            messageInput.value = '';
            messageInput.focus();
        } else {
            alert('Não foi possível enviar a mensagem. Tente novamente.');
        }
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
     * @param {string} message 
     */
    function addSystemMessage(message) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.textContent = message;
        
        messageElement.appendChild(contentElement);
        messagesContainer.appendChild(messageElement);
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});