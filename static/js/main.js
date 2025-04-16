/**
 * Script principal da Bee TV
 */

// Animação da abelha na página inicial
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se estamos na página inicial
    const beeAnimation = document.querySelector('.bee-animation');
    if (beeAnimation) {
        initBeeAnimation(beeAnimation);
    }
    
    // Adicionar animação de hover nos cards da escolha
    const choiceCards = document.querySelectorAll('.choice-card');
    choiceCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
            this.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.1)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
            this.style.boxShadow = '';
        });
    });
});

/**
 * Inicializa a animação da abelha voando
 * @param {Element} beeElement - Elemento da abelha
 */
function initBeeAnimation(beeElement) {
    const animateBee = () => {
        // Gerar posição aleatória na tela
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const randomX = Math.floor(Math.random() * (viewportWidth - 100));
        const randomY = Math.floor(Math.random() * (viewportHeight - 100));
        
        // Animação suave para a nova posição
        beeElement.style.transition = 'transform 10s ease-in-out';
        beeElement.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${Math.random() * 20 - 10}deg)`;
    };
    
    // Iniciar animação e repetir a cada 10 segundos
    animateBee();
    setInterval(animateBee, 10000);
}

/**
 * Reproduz um som de notificação
 */
function playNotificationSound() {
    // Criar elemento de áudio
    const audio = new Audio();
    audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADmAD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAc0AAAAAAAAAABSAJAJAQgAAgAAAA5hZxTKuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
    audio.volume = 0.5;
    audio.play().catch(e => console.error('Erro ao reproduzir som:', e));
}

/**
 * Mostra uma notificação na página
 * @param {string} message - Mensagem para exibir
 * @param {string} type - Tipo de notificação (success, error, info)
 */
function showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Adicionar à página
    document.body.appendChild(notification);
    
    // Mostrar com animação
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
    
    // Reproduzir som
    playNotificationSound();
}

/**
 * Funções de exportação
 */
window.BeeTV = {
    showNotification,
    playNotificationSound
};