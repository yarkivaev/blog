/**
 * Image Auto-Retry System
 * Automatically retries failed image loads with exponential backoff
 */

class ImageRetrySystem {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 10000; // 10 seconds
    this.retryAttempts = new Map();
    
    this.init();
  }
  
  init() {
    // Handle existing images
    this.setupImageErrorHandlers();
    
    // Handle dynamically added images
    this.observeNewImages();
    
    console.log('Image retry system initialized');
  }
  
  setupImageErrorHandlers() {
    const images = document.querySelectorAll('img');
    images.forEach(img => this.attachErrorHandler(img));
  }
  
  attachErrorHandler(img) {
    // Skip if already handled
    if (img.dataset.retryHandled) return;
    
    // Mark as handled
    img.dataset.retryHandled = 'true';
    
    // Only add loading class if image hasn't loaded yet
    if (!img.complete) {
      img.classList.add('loading');
    }
    
    // Handle successful load
    img.addEventListener('load', () => {
      img.classList.remove('loading', 'error', 'retry');
      this.retryAttempts.delete(img.src);
    });
    
    // Handle error
    img.addEventListener('error', (e) => {
      this.handleImageError(img);
    });
    
    // If image is already in error state, handle it
    if (img.complete && img.naturalWidth === 0) {
      this.handleImageError(img);
    }
  }
  
  handleImageError(img) {
    const src = img.src;
    const currentAttempts = this.retryAttempts.get(src) || 0;
    
    console.log(`Image load failed: ${src} (attempt ${currentAttempts + 1})`);
    
    img.classList.remove('loading');
    img.classList.add('error');
    
    if (currentAttempts < this.maxRetries) {
      this.scheduleRetry(img, currentAttempts);
    } else {
      this.handlePermanentFailure(img);
    }
  }
  
  scheduleRetry(img, attemptCount) {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attemptCount), 
      this.maxDelay
    );
    
    console.log(`Scheduling retry for ${img.src} in ${delay}ms`);
    
    // Update retry count
    this.retryAttempts.set(img.src, attemptCount + 1);
    
    // Add retry animation
    img.classList.add('retry');
    
    setTimeout(() => {
      this.retryImage(img);
    }, delay);
  }
  
  retryImage(img) {
    console.log(`Retrying image: ${img.src}`);
    
    // Get the base URL without query parameters
    let baseUrl = img.src.split('?')[0];
    
    // If this was already a retry attempt, make sure we have the correct base URL
    if (img.dataset.originalSrc && window._imagePrefix) {
      // Reconstruct the correct URL from the original filename
      baseUrl = window._imagePrefix + img.dataset.originalSrc;
    }
    
    const cacheBuster = Date.now();
    const newSrc = `${baseUrl}?retry=${cacheBuster}`;
    
    console.log(`Retry URL: ${newSrc}`);
    
    img.classList.remove('error', 'retry');
    img.classList.add('loading');
    
    // Force reload with cache buster
    img.src = newSrc;
  }
  
  handlePermanentFailure(img) {
    console.warn(`Image permanently failed after ${this.maxRetries} attempts: ${img.src}`);
    
    img.classList.remove('retry');
    img.classList.add('error');
    
    // Create fallback placeholder
    this.createErrorPlaceholder(img);
  }
  
  createErrorPlaceholder(img) {
    const placeholder = document.createElement('div');
    placeholder.className = 'image-error-placeholder';
    
    // Store original filename if available
    if (img.dataset.originalSrc) {
      placeholder.dataset.originalSrc = img.dataset.originalSrc;
    }
    
    placeholder.innerHTML = `
      <div>Image failed to load</div>
      <button class="retry-button" onclick="imageRetrySystem.manualRetry('${img.src}', this)">
        Retry
      </button>
    `;
    
    // Replace image with placeholder
    img.parentNode.replaceChild(placeholder, img);
  }
  
  manualRetry(originalSrc, button) {
    console.log(`Manual retry requested for: ${originalSrc}`);
    
    // Extract the base URL without retry parameters
    const baseUrl = originalSrc.split('?')[0];
    
    // Reset retry counter for the base URL
    this.retryAttempts.delete(baseUrl);
    this.retryAttempts.delete(originalSrc);
    
    // Create new image element
    const img = document.createElement('img');
    img.classList.add('loading');
    
    // If we have the original filename stored, use it
    const placeholder = button.parentNode;
    const originalFilename = placeholder.dataset.originalSrc;
    if (originalFilename && window._imagePrefix) {
      img.dataset.originalSrc = originalFilename;
      img.src = window._imagePrefix + originalFilename;
    } else {
      img.src = baseUrl;
    }
    
    console.log(`Manual retry with URL: ${img.src}`);
    
    // Attach error handler
    this.attachErrorHandler(img);
    
    // Replace placeholder with new image
    placeholder.parentNode.replaceChild(img, placeholder);
  }
  
  observeNewImages() {
    // Watch for dynamically added images
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            if (node.tagName === 'IMG') {
              this.attachErrorHandler(node);
            } else {
              // Check for images within added nodes
              const images = node.querySelectorAll?.('img') || [];
              images.forEach(img => this.attachErrorHandler(img));
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize the retry system when DOM is ready
let imageRetrySystem;

function initRetrySystem() {
  if (!imageRetrySystem) {
    imageRetrySystem = new ImageRetrySystem({
      maxRetries: 3,
      baseDelay: 1500,
      maxDelay: 8000
    });
    
    // Make it globally available
    window.imageRetrySystem = imageRetrySystem;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRetrySystem);
} else {
  initRetrySystem();
}

// Export for global access
window.imageRetrySystem = imageRetrySystem;