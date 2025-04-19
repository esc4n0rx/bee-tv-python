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
    let isInitiator = false; // Flag para indicar quem iniciou a chamada
    let pendingCandidates = []; // Armazena candidatos ICE enquanto a conexão não está pronta
    
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
        
        // Definir este usuário como iniciador da chamada
        isInitiator = true;
        
        // Verificar se já existe uma conexão
        if (peerConnection && peerConnection.signalingState !== 'closed') {
            console.log('Conexão já existe, não precisamos criar outra');
            return;
        }
        
        setupPeerConnection();
        
        // Pequeno delay para garantir que tudo esteja configurado
        setTimeout(() => {
            createAndSendOffer();
        }, 1000);
    }

    function setupPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        // Fechar qualquer conexão existente antes de criar uma nova
        if (peerConnection) {
            peerConnection.close();
        }
        
        pendingCandidates = []; // Limpar candidatos pendentes
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
        
        // Quando a coleta de ICE for concluída
        peerConnection.onicegatheringstatechange = () => {
            console.log('Estado da coleta ICE:', peerConnection.iceGatheringState);
            if (peerConnection.iceGatheringState === 'complete') {
                console.log('Coleta de candidatos ICE concluída');
            }
        };
        
        // Receber stream remoto
        peerConnection.ontrack = (event) => {
            console.log('Stream remoto recebido:', event.streams[0]);
            if (remoteVideo && event.streams && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                // Garantir que o vídeo comece a ser reproduzido
                remoteVideo.play().catch(e => console.error("Erro ao reproduzir vídeo remoto:", e));
                
                // Adicionar evento para detectar quando o vídeo realmente começa a ser reproduzido
                remoteVideo.onloadedmetadata = () => {
                    console.log('Metadata do vídeo remoto carregada');
                };
                
                remoteVideo.oncanplay = () => {
                    console.log('Vídeo remoto pronto para ser reproduzido');
                    staticEffect.style.display = 'none'; // Esconder efeito de TV estática
                };
            }
        };

        // Monitorar o estado da conexão
        peerConnection.onconnectionstatechange = () => {
            console.log('Estado da conexão WebRTC:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log('Conexão WebRTC estabelecida com sucesso');
                // Esconder efeito de TV estática quando conectado
                staticEffect.style.display = 'none';
                isConnected = true;
                
                // Verificar se o vídeo está sendo exibido
                if (remoteVideo && remoteVideo.srcObject) {
                    console.log('Stream remoto definido e conexão estabelecida!');
                } else {
                    console.warn('Conexão estabelecida mas sem stream remoto!');
                }
            } else if (peerConnection.connectionState === 'disconnected' || 
                      peerConnection.connectionState === 'failed' ||
                      peerConnection.connectionState === 'closed') {
                console.log('Conexão WebRTC encerrada ou falhou');
                staticEffect.style.display = 'block'; // Mostrar efeito estático quando desconectado
                isConnected = false;
            }
        };
        
        // Monitorar mudanças de ICE
        peerConnection.oniceconnectionstatechange = () => {
            console.log('Estado da conexão ICE:', peerConnection.iceConnectionState);
            
            if (peerConnection.iceConnectionState === 'connected' || 
                peerConnection.iceConnectionState === 'completed') {
                console.log('Conexão ICE estabelecida!');
                staticEffect.style.display = 'none';  // Esconder efeito de TV estática
                isConnected = true;
            } else if (peerConnection.iceConnectionState === 'failed') {
                console.error('Conexão ICE falhou!');
                
                // Tentar reiniciar a coleta de ICE
                peerConnection.restartIce();
            }
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
        if (!peerConnection || peerConnection.signalingState === 'closed') {
            console.warn('Recebido sinal WebRTC, mas peer connection não existe ou está fechada');
            setupPeerConnection(); // Inicializar connection se não existir
        }
        
        console.log('Sinal WebRTC recebido:', signal.type);
        
        if (signal.type === 'offer') {
            // Verificar se podemos processar a oferta
            if (peerConnection.signalingState !== 'stable') {
                console.warn('Não podemos processar oferta no estado:', peerConnection.signalingState);
                console.log('Fechando conexão existente e criando nova');
                
                // Fechar conexão existente e criar nova
                if (peerConnection) {
                    peerConnection.close();
                }
                setupPeerConnection();
            }
            
            // Marcar este usuário como não sendo o iniciador
            isInitiator = false;
            
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
                    
                    // Pequeno delay para garantir que o setLocalDescription seja concluído
                    setTimeout(() => {
                        // Processa candidatos ICE pendentes
                        processPendingCandidates();
                        
                        // Esconder efeito de TV estática quando conectado
                        staticEffect.style.display = 'none';
                        isConnected = true;
                    }, 500);
                })
                .catch(error => {
                    console.error('Erro ao processar oferta:', error);
                });
        } else if (signal.type === 'answer') {
            console.log('Resposta recebida, definindo descrição remota');
            
            // Verificar se estamos no estado correto para receber uma resposta
            if (peerConnection.signalingState === 'have-local-offer') {
                peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                    .then(() => {
                        console.log('Conexão de resposta estabelecida');
                        
                        // Pequeno delay para garantir que o setRemoteDescription seja concluído
                        setTimeout(() => {
                            // Processa candidatos ICE pendentes
                            processPendingCandidates();
                            
                            // Esconder efeito de TV estática quando conectado
                            staticEffect.style.display = 'none';
                            isConnected = true;
                        }, 500);
                    })
                    .catch(error => {
                        console.error('Erro ao processar resposta:', error);
                    });
            } else {
                console.warn('Ignorando resposta: estado de sinalização incorreto:', peerConnection.signalingState);
                
                // Se estamos recebendo uma resposta duplicada, podemos ignorá-la com segurança
                if (peerConnection.signalingState === 'stable' && isConnected) {
                    console.log('Conexão já está estabelecida, ignorando resposta duplicada');
                } else {
                    console.warn('Estado inesperado da conexão, pode ser necessário reiniciar');
                }
            }
        } else if (signal.type === 'ice-candidate') {
            if (signal.candidate) {
                console.log('Candidato ICE recebido');
                
                // Verificar se podemos adicionar o candidato agora ou armazená-lo para mais tarde
                if (
                    peerConnection.remoteDescription && 
                    peerConnection.remoteDescription.type
                ) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
                        .catch(error => {
                            console.error('Erro ao adicionar candidato ICE:', error);
                            
                            // Se falhar, armazenar para tentar mais tarde
                            pendingCandidates.push(signal.candidate);
                        });
                } else {
                    // Armazenar o candidato para processamento posterior
                    console.log('Armazenando candidato ICE para processamento posterior');
                    pendingCandidates.push(signal.candidate);
                }
            }
        }
    }
    
    // Função para processar candidatos ICE pendentes
    function processPendingCandidates() {
        if (pendingCandidates.length > 0) {
            console.log(`Processando ${pendingCandidates.length} candidatos ICE pendentes`);
            
            // Criar uma cópia do array para trabalhar com ela
            const candidatesToProcess = [...pendingCandidates];
            pendingCandidates = []; // Limpar a lista original
            
            // Processar cada candidato
            const promises = candidatesToProcess.map(candidate => {
                return peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(error => {
                        console.error('Erro ao adicionar candidato ICE pendente:', error);
                        
                        // Se o estado de sinalização não permitir adicionar candidatos,
                        // armazenamos novamente para tentar mais tarde
                        if (error.name === 'InvalidStateError') {
                            console.log('Estado inválido para adicionar candidato ICE, armazenando para tentar mais tarde');
                            pendingCandidates.push(candidate);
                        }
                    });
            });
            
            // Aguardar que todos os candidatos sejam processados
            Promise.all(promises)
                .then(() => {
                    console.log('Todos os candidatos ICE pendentes foram processados');
                    
                    // Se ainda temos candidatos pendentes (devido a erros), agendar nova tentativa
                    if (pendingCandidates.length > 0) {
                        console.log(`Ainda temos ${pendingCandidates.length} candidatos pendentes, tentando novamente em 1s`);
                        setTimeout(processPendingCandidates, 1000);
                    }
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
            setTimeout(() => {
                init();
                updateStatus('Procurando um novo estranho para conversar...');
            }, 500);
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

    // Função para preparar para chamada sem iniciar oferta
    function prepareForCall() {
        isConnected = true;
        staticEffect.style.display = 'none';
        
        // Não definir como iniciador
        isInitiator = false;
        
        // Verificar se já existe uma conexão
        if (peerConnection && peerConnection.signalingState !== 'closed') {
            console.log('Conexão já existe, não precisamos criar outra');
            return;
        }
        
        setupPeerConnection();
        console.log('Preparado para receber oferta de chamada');
    }

    // Expor funções para o contexto global
    window.VideoChat = {
        startVideoCall,
        handleSignal,
        stopLocalStream,
        prepareForCall
    };

    // Inicializar o chat de vídeo
    init();
});