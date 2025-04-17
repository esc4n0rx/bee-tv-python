/**
 * Script principal da Bee TV - Dark Theme Version
 */

document.addEventListener('DOMContentLoaded', function() {
  
    // Initialize bee animation
    const beeAnimation = document.querySelector('.bee-animation');
    if (beeAnimation) {
        initBeeAnimation(beeAnimation);
    }
    
    // Initialize card hover effects
    initCardEffects();
    
    // Initialize enhanced background effect
    initEnhancedBackground();
    
    // Add audio preloading
    preloadAudio();
});

/**
 * Initializes enhanced animated bee
 * @param {Element} beeElement
 */
function initBeeAnimation(beeElement) {
    // Random start position
    const randomX = Math.floor(Math.random() * window.innerWidth * 0.8);
    const randomY = Math.floor(Math.random() * window.innerHeight * 0.8);
    beeElement.style.transform = `translate(${randomX}px, ${randomY}px)`;
    
    // Create trail effect
    const trail = document.createElement('div');
    trail.className = 'bee-trail';
    document.body.appendChild(trail);
    
    const animateBee = () => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Make sure bee stays within visible range
        const maxX = viewportWidth * 0.8;
        const maxY = viewportHeight * 0.8;
        
        const randomX = Math.floor(Math.random() * maxX);
        const randomY = Math.floor(Math.random() * maxY);
        
        // Add trail effect
        const beeRect = beeElement.getBoundingClientRect();
        const beeX = beeRect.left + beeRect.width / 2;
        const beeY = beeRect.top + beeRect.height / 2;
        
        const trailDot = document.createElement('div');
        trailDot.className = 'trail-dot';
        trailDot.style.left = `${beeX}px`;
        trailDot.style.top = `${beeY}px`;
        trail.appendChild(trailDot);
        
        // Remove trail after animation
        setTimeout(() => {
            if (trailDot && trail.contains(trailDot)) {
                trail.removeChild(trailDot);
            }
        }, 1000);
        
        beeElement.style.transition = 'transform 10s cubic-bezier(0.25, 0.1, 0.25, 1)';
        beeElement.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${Math.random() * 20 - 10}deg)`;
    };
    
    animateBee();
    setInterval(animateBee, 10000);
}

/**
 * Initialize card hover effects with enhanced interaction
 */
function initCardEffects() {
    const choiceCards = document.querySelectorAll('.choice-card');
    choiceCards.forEach(card => {
        // 3D tilt effect
        card.addEventListener('mousemove', function(e) {
            const cardRect = this.getBoundingClientRect();
            const cardCenterX = cardRect.left + cardRect.width / 2;
            const cardCenterY = cardRect.top + cardRect.height / 2;
            
            // Calculate distance from pointer to center
            const distX = e.clientX - cardCenterX;
            const distY = e.clientY - cardCenterY;
            
            // Calculate tilt angle (max 10 degrees)
            const tiltX = (distY / cardRect.height) * 10;
            const tiltY = -(distX / cardRect.width) * 10;
            
            // Apply 3D transform
            this.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-5px) scale(1.02)`;
            
            // Add highlight effect
            const highlight = document.createElement('div');
            highlight.className = 'card-highlight';
            highlight.style.left = `${e.clientX - cardRect.left}px`;
            highlight.style.top = `${e.clientY - cardRect.top}px`;
            
            this.appendChild(highlight);
            
            setTimeout(() => {
                highlight.remove();
            }, 500);
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
            
            // Remove any remaining highlights
            const highlights = this.querySelectorAll('.card-highlight');
            highlights.forEach(h => h.remove());
        });
        
        // Add click effect
        card.addEventListener('mousedown', function() {
            this.style.transform = 'translateY(2px) scale(0.98)';
        });
        
        card.addEventListener('mouseup', function() {
            this.style.transform = 'translateY(-5px) scale(1.02)';
        });
    });
    
    // Feature hover effects
    const features = document.querySelectorAll('.feature');
    features.forEach(feature => {
        feature.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            playSound('hover');
        });
        
        feature.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });
}

/**
 * Initialize enhanced background effects
 */
function initEnhancedBackground() {
    const honeycombBg = document.querySelector('.honeycomb-background');
    if (!honeycombBg) return;
    
    // Create particle effect
    const particles = document.createElement('div');
    particles.className = 'particles';
    document.body.appendChild(particles);
    
    // Create particles
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random position
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        particle.style.left = `${posX}%`;
        particle.style.top = `${posY}%`;
        
        // Random size
        const size = Math.random() * 10 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Random animation duration
        const duration = Math.random() * 20 + 10;
        particle.style.animationDuration = `${duration}s`;
        
        // Random delay
        const delay = Math.random() * 10;
        particle.style.animationDelay = `${delay}s`;
        
        particles.appendChild(particle);
    }
    
    // Interactive background effect
    document.addEventListener('mousemove', function(e) {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        honeycombBg.style.backgroundPosition = `${mouseX * 10}% ${mouseY * 10}%`;
    });
}

/**
 * Preload audio files for better performance
 */
function preloadAudio() {
    const audioFiles = {
        notification: '/static/assets/notification.m4a',
        hover: '/static/assets/hover.mp3'
    };
    
    // Preload notification sound
    for (const [key, path] of Object.entries(audioFiles)) {
        const audio = new Audio();
        audio.src = path;
        audio.preload = 'auto';
        window[`${key}Sound`] = audio;
    }
}

/**
 * Play a sound effect
 * @param {string} soundType - Type of sound to play
 */
function playSound(soundType) {
    const sound = window[`${soundType}Sound`];
    if (sound) {
        // Clone the audio to allow multiple overlapping sounds
        const audioClone = sound.cloneNode();
        audioClone.volume = soundType === 'hover' ? 0.1 : 0.5;
        audioClone.play().catch(e => console.error('Erro ao reproduzir som:', e));
    }
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Notification type (info, success, error)
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || document.body;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Force reflow before adding show class
    toast.offsetHeight; 
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove after animation
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
    
    playSound('notification');
}

/**
 * Show a notification bubble
 * @param {string} message - Message to display
 * @param {string} type - Notification type (info, success, error)
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Force reflow
    notification.offsetHeight;
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after animation
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
    
    // Play notification sound
    playSound('notification');
}

// Export functions to global namespace
window.BeeTV = {
    showNotification,
    showToast,
    playSound
};