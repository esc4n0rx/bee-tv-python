/**
 * Script principal da Bee TV
 */

document.addEventListener('DOMContentLoaded', function() {
  
    const beeAnimation = document.querySelector('.bee-animation');
    if (beeAnimation) {
        initBeeAnimation(beeAnimation);
    }
    
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
 * @param {Element} beeElement
 */
function initBeeAnimation(beeElement) {
    const animateBee = () => {

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const randomX = Math.floor(Math.random() * (viewportWidth - 100));
        const randomY = Math.floor(Math.random() * (viewportHeight - 100));
        
        beeElement.style.transition = 'transform 10s ease-in-out';
        beeElement.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${Math.random() * 20 - 10}deg)`;
    };
    
    animateBee();
    setInterval(animateBee, 10000);
}


function playNotificationSound() {
    const audio = new Audio();
    audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADmAD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwAc0AAAAAAAAAABSAJAJAQgAAgAAAA5hZxTKuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
    audio.volume = 0.5;
    audio.play().catch(e => console.error('Erro ao reproduzir som:', e));
}

/**
 * @param {string} message 
 * @param {string} type 
 */
function showNotification(message, type = 'info') {

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    

    document.body.appendChild(notification);
    

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
    

    playNotificationSound();
}

window.BeeTV = {
    showNotification,
    playNotificationSound
};