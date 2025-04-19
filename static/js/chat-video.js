/**
 * Lógica do chat de vídeo da Bee TV
 */

document.addEventListener('DOMContentLoaded', function() {
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
    const videoContainer = document.getElementById('video-container');
    
    let localStream = null;
    let peerConnection = null;
    let isVideoEnabled = true;
    let isAudioEnabled = true;
    let isChatOpen = false;
    let isConnected = false;
    
    // Adiciona elemento para efeito de TV estática
    const staticEffect = document.createElement('div');
    staticEffect.className = 'tv-static-effect';
    staticEffect.innerHTML = `
        <div class="tv-static">
            <div class="tv-static-noise"></div>
        </div>`;
    videoContainer.appendChild(staticEffect);

    function init() {
        // Mostrar efeito de TV estática por padrão
        staticEffect.style.display = 'block';
        
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStream = stream;
                
                // Adiciona o stream local ao elemento de vídeo
                if (localVideo) {
                    localVideo.srcObject = stream;
                    // Garantir que o vídeo comece a ser reproduzido
                    localVideo.play().catch(e => console.error("Erro ao reproduzir vídeo local:", e));
                }

                setupVideoControls();
                
                return window.SocketManager.initSocket('video');
            })
            .then(() => {
                console.log('Socket inicializado com sucesso para chat de vídeo');
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

    function setupVideoControls() {
        toggleVideoBtn.addEventListener('click', function() {
            isVideoEnabled = !isVideoEnabled;
            toggleVideoBtn.classList.toggle('off');
            localStream.getVideoTracks().forEach(track => {
                track.enabled = isVideoEnabled;
            });
        });
        
        toggleAudioBtn.addEventListener('click', function() {
            isAudioEnabled = !isAudioEnabled;
            toggleAudioBtn.classList.toggle('off');
            localStream.getAudioTracks().forEach(track => {
                track.enabled = isAudioEnabled;
            });
        });
        
        toggleChatBtn.addEventListener('click', function() {
            isChatOpen = !isChatOpen;
            toggleChatBtn.classList.toggle('off');
            chatSidebar.classList.toggle('active', isChatOpen);
        });
    }

    function showPermissionError() {
        staticEffect.style.display = 'none'; // Esconder efeito de estática
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'permission-message';
        errorDiv.innerHTML = `
            <h3>Permissão de câmera e microfone necessária</h3>
            <p>O Bee TV precisa de acesso à sua câmera e microfone para funcionar.</p>
            <button class="btn" id="retry-permission">Tentar novamente</button>
        `;

        videoContainer.appendChild(errorDiv);

        document.getElementById('retry-permission').addEventListener('click', function() {
            errorDiv.remove();
            init();
        });
    }
    
    function startVideoCall(roomId) {
        isConnected = true;
        // Esconder efeito de TV estática quando conectado com outro usuário
        staticEffect.style.display = 'none';
        
        setupPeerConnection();
        createAndSendOffer();
    }

    function setupPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        // Fechar qualquer conexão existente antes de criar uma nova
        if (peerConnection) {
            peerConnection.close();
        }
        
        peerConnection = new RTCPeerConnection(configuration);
        
        // Adicionar as trilhas locais à conexão
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log('Adicionando trilha local à conexão:', track.kind);
                peerConnection.addTrack(track, localStream);
            });
        } else {
            console.error('Stream local não disponível ao configurar peer connection');
        }
        
        // Lidar com candidatos ICE
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Enviando candidato ICE');
                window.SocketManager.sendWebRTCSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };
        
        // Receber stream remoto
        peerConnection.ontrack = (event) => {
            console.log('Stream remoto recebido:', event.streams[0]);
            if (remoteVideo && event.streams && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                // Garantir que o vídeo comece a ser reproduzido
                remoteVideo.play().catch(e => console.error("Erro ao reproduzir vídeo remoto:", e));
            }
        };

        // Monitorar o estado da conexão
        peerConnection.onconnectionstatechange = () => {
            console.log('Estado da conexão WebRTC:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log('Conexão WebRTC estabelecida com sucesso');
                // Aqui podemos fazer algo quando a conexão é estabelecida
            } else if (peerConnection.connectionState === 'disconnected' || 
                      peerConnection.connectionState === 'failed' ||
                      peerConnection.connectionState === 'closed') {
                console.log('Conexão WebRTC encerrada ou falhou');
                staticEffect.style.display = 'block'; // Mostrar efeito estático quando desconectado
            }
        };
        
        // Monitorar mudanças de ICE
        peerConnection.oniceconnectionstatechange = () => {
            console.log('Estado da conexão ICE:', peerConnection.iceConnectionState);
        };
    }
    
    function createAndSendOffer() {
        if (!peerConnection) {
            console.error('Tentativa de criar oferta sem inicializar peerConnection');
            return;
        }
        
        peerConnection.createOffer()
            .then(offer => {
                console.log('Oferta criada, definindo descrição local');
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                console.log('Enviando oferta para par');
                window.SocketManager.sendWebRTCSignal({
                    type: 'offer',
                    sdp: peerConnection.localDescription
                });
            })
            .catch(error => {
                console.error('Erro ao criar oferta:', error);
            });
    }
    
    function handleSignal(signal, senderId) {
        if (!peerConnection) {
            console.warn('Recebido sinal WebRTC, mas peer connection não existe');
            setupPeerConnection(); // Inicializar connection se não existir
        }
        
        console.log('Sinal WebRTC recebido:', signal.type);
        
        if (signal.type === 'offer') {
            console.log('Oferta recebida, definindo descrição remota');
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(() => {
                    console.log('Criando resposta para oferta');
                    return peerConnection.createAnswer();
                })
                .then(answer => {
                    console.log('Definindo descrição local (resposta)');
                    return peerConnection.setLocalDescription(answer);
                })
                .then(() => {
                    console.log('Enviando resposta para oferta');
                    window.SocketManager.sendWebRTCSignal({
                        type: 'answer',
                        sdp: peerConnection.localDescription
                    });
                    
                    // Esconder efeito de TV estática quando conectado
                    staticEffect.style.display = 'none';
                    isConnected = true;
                })
                .catch(error => {
                    console.error('Erro ao processar oferta:', error);
                });
        } else if (signal.type === 'answer') {
            console.log('Resposta recebida, definindo descrição remota');
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(() => {
                    console.log('Conexão de resposta estabelecida');
                    // Esconder efeito de TV estática quando conectado
                    staticEffect.style.display = 'none';
                    isConnected = true;
                })
                .catch(error => {
                    console.error('Erro ao processar resposta:', error);
                });
        } else if (signal.type === 'ice-candidate') {
            console.log('Candidato ICE recebido');
            peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
                .catch(error => {
                    console.error('Erro ao adicionar candidato ICE:', error);
                });
        }
    }
    
    function stopLocalStream() {
        if (localStream) {
            localStream.getTracks().forEach(track => {
                console.log('Parando trilha:', track.kind);
                track.stop();
            });
        }
        
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        
        // Mostrar efeito de TV estática quando não conectado
        staticEffect.style.display = 'block';
        isConnected = false;
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
            stopLocalStream();
            
            // Reiniciar a conexão
            init();
            
            updateStatus('Procurando um novo estranho para conversar...');
        });
    }
    
    if (endChatBtn) {
        endChatBtn.addEventListener('click', function() {
            window.SocketManager.leaveChat();
            stopLocalStream();
            
            endChatBtn.disabled = true;
            messageInput.disabled = true;
            sendBtn.disabled = true;
            updateStatus('Você encerrou a conversa.');
            
            addSystemMessage('Você encerrou a conversa.');
            
            // Mostrar efeito de TV estática quando não conectado
            staticEffect.style.display = 'block';
            isConnected = false;
        });
    }
    
    function updateStatus(message) {
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
    
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
        
        if (!isChatOpen) {
            window.BeeTV.showNotification('Nova mensagem', 'info');
        }
    }

    // Expor funções para o contexto global
    window.VideoChat = {
        startVideoCall,
        handleSignal,
        stopLocalStream
    };

    // Inicializar o chat de vídeo
    init();
});