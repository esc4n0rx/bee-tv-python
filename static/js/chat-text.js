/**
 * Lógica do chat de texto da Bee TV
 */

document.addEventListener('DOMContentLoaded', function() {
    // Elementos da interface
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const endChatBtn = document.getElementById('end-chat-btn');
    
    // Inicializar o socket
    window.SocketManager.initSocket('text')
        .then(() => {
            console.log('Socket inicializado com sucesso para chat de texto');
            // Entrar automaticamente na fila de espera
            window.SocketManager.joinWaitingRoom();
        })
        .catch(error => {
            console.error('Erro ao inicializar socket:', error);
            alert('Erro de conexão. Por favor, recarregue a página.');
        });
    
    // Event listeners
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
            // Primeiro sair do chat atual (se houver)
            window.SocketManager.leaveChat();
            
            // Entrar em um novo chat
            window.SocketManager.joinWaitingRoom();
            
            // Atualizar UI
            updateStatus('Procurando um novo estranho para conversar...');
        });
    }
    
    if (endChatBtn) {
        endChatBtn.addEventListener('click', function() {
            // Sair do chat atual
            window.SocketManager.leaveChat();
            
            // Atualizar UI
            endChatBtn.disabled = true;
            messageInput.disabled = true;
            sendBtn.disabled = true;
            updateStatus('Você encerrou a conversa.');
            
            // Adicionar mensagem de sistema
            addSystemMessage('Você encerrou a conversa.');
        });
    }
    
    /**
     * Envia uma mensagem para o chat atual
     */
    function sendMessage() {
        if (!messageInput || messageInput.disabled || !messageInput.value.trim()) {
            return;
        }
        
        const message = messageInput.value.trim();
        
        // Enviar mensagem via WebSocket
        const success = window.SocketManager.sendMessage(message);
        
        if (success) {
            // Limpar campo de entrada
            messageInput.value = '';
            messageInput.focus();
        } else {
            alert('Não foi possível enviar a mensagem. Tente novamente.');
        }
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
     * Adiciona uma mensagem de sistema à conversa
     * @param {string} message - Mensagem a ser adicionada
     */
    function addSystemMessage(message) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;
        
        // Criar elementos da mensagem
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.textContent = message;
        
        // Adicionar à DOM
        messageElement.appendChild(contentElement);
        messagesContainer.appendChild(messageElement);
        
        // Rolar para a última mensagem
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});