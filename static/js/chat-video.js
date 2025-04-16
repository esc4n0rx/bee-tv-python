/**
 * Lógica do chat de vídeo da Bee TV
 */

document.addEventListener('DOMContentLoaded', function() {
    // Elementos da interface
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const endChatBtn = document.getElementById('end-chat-btn');
    const toggleVideoBtn = document.getElementById('toggle-video-btn');
    const toggleAudioBtn = document.getElementById('toggle-audio-btn');
    const toggleChatBtn = document.getElementById('toggle-chat-btn');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const chatSidebar = document.getElementById('video-chat-sidebar');
    
    // Variáveis para WebRTC
    let localStream = null;
    let peerConnection = null;
    let isVideoEnabled = true;
    let isAudioEnabled = true;
    let isChatOpen = false;
    
    /**
     * Inicialização do chat de vídeo
     */
    function init() {
        // Solicitar permissão de vídeo e áudio
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                // Salvar stream local
                localStream = stream;
                
                // Exibir vídeo local
                localVideo.srcObject = stream;
                
                // Adicionar event listeners para controles de vídeo
                setupVideoControls();
                
                // Inicializar o socket
                return window.SocketManager.initSocket('video');
            })
            .then(() => {
                console.log('Socket inicializado com sucesso para chat de vídeo');
                // Entrar automaticamente na fila de espera
                window.SocketManager.joinWaitingRoom();
            })
            .catch(error => {
                console.error('Erro ao inicializar vídeo ou socket:', error);
                if (error.name === 'NotAllowedError') {
                    showPermissionError();
                } else {
                    alert('Erro de conexão. Por favor, recarregue a página.');
                }
            });
    }
    
    /**
     * Configuração dos controles de vídeo
     */
    function setupVideoControls() {
        // Botão para habilitar/desabilitar vídeo
        toggleVideoBtn.addEventListener('click', function() {
            isVideoEnabled = !isVideoEnabled;
            
            // Atualizar estado do botão
            toggleVideoBtn.classList.toggle('off');
            
            // Habilitar/desabilitar todas as tracks de vídeo
            localStream.getVideoTracks().forEach(track => {
                track.enabled = isVideoEnabled;
            });
        });
        
        // Botão para habilitar/desabilitar áudio
        toggleAudioBtn.addEventListener('click', function() {
            isAudioEnabled = !isAudioEnabled;
            
            // Atualizar estado do botão
            toggleAudioBtn.classList.toggle('off');
            
            // Habilitar/desabilitar todas as tracks de áudio
            localStream.getAudioTracks().forEach(track => {
                track.enabled = isAudioEnabled;
            });
        });
        
        // Botão para abrir/fechar o chat lateral
        toggleChatBtn.addEventListener('click', function() {
            isChatOpen = !isChatOpen;
            
            // Atualizar estado do botão
            toggleChatBtn.classList.toggle('off');
            
            // Mostrar/esconder o chat lateral
            chatSidebar.classList.toggle('active', isChatOpen);
        });
    }
    
    /**
     * Mostra erro de permissão de câmera/microfone
     */
    function showPermissionError() {
        const videoContainer = document.getElementById('video-container');
        
        // Criar mensagem de erro
        const errorDiv = document.createElement('div');
        errorDiv.className = 'permission-message';
        errorDiv.innerHTML = `
            <h3>Permissão de câmera e microfone necessária</h3>
            <p>O Bee TV precisa de acesso à sua câmera e microfone para funcionar.</p>
            <button class="btn" id="retry-permission">Tentar novamente</button>
        `;
        
        // Adicionar à tela
        videoContainer.appendChild(errorDiv);
        
        // Adicionar event listener para o botão de retry
        document.getElementById('retry-permission').addEventListener('click', function() {
            errorDiv.remove();
            init();
        });
    }
    
    /**
     * Inicia uma chamada de vídeo
     * @param {string} roomId - ID da sala
     */
    function startVideoCall(roomId) {
        // Configurar conexão WebRTC
        setupPeerConnection();
        
        // Criar e enviar oferta
        createAndSendOffer();
    }
    
    /**
     * Configura a conexão WebRTC
     */
    function setupPeerConnection() {
        // Configuração dos servidores ICE (STUN/TURN)
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        // Criar conexão peer
        peerConnection = new RTCPeerConnection(configuration);
        
        // Adicionar stream local
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Event listener para ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Enviar candidato ICE para o par
                window.SocketManager.sendWebRTCSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };
        
        // Event listener para stream remoto
        peerConnection.ontrack = (event) => {
            // Exibir vídeo remoto
            if (remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                console.log('Recebendo stream remoto');
            }
        };
        
        // Event listener para mudança de estado da conexão
        peerConnection.onconnectionstatechange = () => {
            console.log('Estado da conexão WebRTC:', peerConnection.connectionState);
        };
    }
    
    /**
     * Cria e envia uma oferta WebRTC
     */
    function createAndSendOffer() {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                // Enviar oferta para o par
                window.SocketManager.sendWebRTCSignal({
                    type: 'offer',
                    sdp: peerConnection.localDescription
                });
            })
            .catch(error => {
                console.error('Erro ao criar oferta:', error);
            });
    }
    
    /**
     * Processa sinais WebRTC recebidos
     * @param {Object} signal - Sinal WebRTC
     * @param {string} senderId - ID do remetente
     */
    function handleSignal(signal, senderId) {
        if (!peerConnection) {
            console.warn('Recebido sinal WebRTC, mas peer connection não existe');
            return;
        }
        
        // Processar diferentes tipos de sinais
        if (signal.type === 'offer') {
            // Recebeu uma oferta, definir descrição remota
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(() => peerConnection.createAnswer())
                .then(answer => peerConnection.setLocalDescription(answer))
                .then(() => {
                    // Enviar resposta para o par
                    window.SocketManager.sendWebRTCSignal({
                        type: 'answer',
                        sdp: peerConnection.localDescription
                    });
                })
                .catch(error => {
                    console.error('Erro ao processar oferta:', error);
                });
        } else if (signal.type === 'answer') {
            // Recebeu uma resposta, definir descrição remota
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .catch(error => {
                    console.error('Erro ao processar resposta:', error);
                });
        } else if (signal.type === 'ice-candidate') {
            // Recebeu um candidato ICE, adicionar à conexão
            peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
                .catch(error => {
                    console.error('Erro ao adicionar candidato ICE:', error);
                });
        }
    }
    
    /**
     * Para o stream de vídeo local
     */
    function stopLocalStream() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        // Limpar vídeos
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
    }
    
    /**
     * Envia uma mensagem de texto no chat de vídeo
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
    
    // Event listeners para o chat de texto
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
            
            // Parar stream atual
            stopLocalStream();
            
            // Reiniciar vídeo
            init();
            
            // Atualizar UI
            updateStatus('Procurando um novo estranho para conversar...');
        });
    }
    
    if (endChatBtn) {
        endChatBtn.addEventListener('click', function() {
            // Sair do chat atual
            window.SocketManager.leaveChat();
            
            // Parar stream atual
            stopLocalStream();
            
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
        
        // Se o chat estiver fechado, notificar o usuário
        if (!isChatOpen) {
            window.BeeTV.showNotification('Nova mensagem', 'info');
        }
    }
    
    // Exportar funções para uso global
    window.VideoChat = {
        startVideoCall,
        handleSignal,
        stopLocalStream
    };
    
    // Inicializar o chat de vídeo
    init();
});