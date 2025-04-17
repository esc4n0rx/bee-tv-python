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
    
    let localStream = null;
    let peerConnection = null;
    let isVideoEnabled = true;
    let isAudioEnabled = true;
    let isChatOpen = false;
    

    function init() {

        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                localStream = stream;

                localVideo.srcObject = stream;

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
        const videoContainer = document.getElementById('video-container');
        
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
    
    /**
     * @param {string} roomId
     */
    function startVideoCall(roomId) {
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
        
        peerConnection = new RTCPeerConnection(configuration);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {

                window.SocketManager.sendWebRTCSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };
        
        peerConnection.ontrack = (event) => {
            if (remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                console.log('Recebendo stream remoto');
            }
        };
        

        peerConnection.onconnectionstatechange = () => {
            console.log('Estado da conexão WebRTC:', peerConnection.connectionState);
        };
    }
    
    function createAndSendOffer() {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {

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
     * @param {Object} signal 
     * @param {string} senderId
     */
    function handleSignal(signal, senderId) {
        if (!peerConnection) {
            console.warn('Recebido sinal WebRTC, mas peer connection não existe');
            return;
        }
        
        if (signal.type === 'offer') {
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(() => peerConnection.createAnswer())
                .then(answer => peerConnection.setLocalDescription(answer))
                .then(() => {
                    window.SocketManager.sendWebRTCSignal({
                        type: 'answer',
                        sdp: peerConnection.localDescription
                    });
                })
                .catch(error => {
                    console.error('Erro ao processar oferta:', error);
                });
        } else if (signal.type === 'answer') {
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .catch(error => {
                    console.error('Erro ao processar resposta:', error);
                });
        } else if (signal.type === 'ice-candidate') {
            peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
                .catch(error => {
                    console.error('Erro ao adicionar candidato ICE:', error);
                });
        }
    }
    
    function stopLocalStream() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
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
        
        if (!isChatOpen) {
            window.BeeTV.showNotification('Nova mensagem', 'info');
        }
    }
    

    window.VideoChat = {
        startVideoCall,
        handleSignal,
        stopLocalStream
    };
    

    init();
});