(function () {
  var VIEWPORT_ROOT_MARGIN = '320px 0px';
  var MEDIA_PRIORITY_EVENT = 'media-priority-video';
  var viewportMargin = { top: 320, right: 0, bottom: 320, left: 0 };
  var viewportObserver = null;
  var videoPriorityActive = false;
  var activeLoads = [];
  var deferredImages = [];
  function isVideoPriority() {
    return videoPriorityActive;
  }
  function isNearViewport(img) {
    var rect = img.getBoundingClientRect();
    var viewW = document.documentElement.clientWidth;
    var viewH = document.documentElement.clientHeight;
    return (
      rect.bottom >= -viewportMargin.bottom &&
      rect.top <= viewH + viewportMargin.top &&
      rect.right >= -viewportMargin.left &&
      rect.left <= viewW + viewportMargin.right
    );
  }
  function shouldDeferUpgrade(img) {
    return isVideoPriority() && !isNearViewport(img);
  }
  function removeActiveLoad(entry) {
    activeLoads = activeLoads.filter(function (item) {
      return item !== entry;
    });
  }
  function abortOffViewportImageLoads() {
    var kept = [];
    activeLoads.forEach(function (entry) {
      if (isNearViewport(entry.img)) {
        kept.push(entry);
        return;
      }
      entry.loader.onload = null;
      entry.loader.onerror = null;
      entry.loader.src = '';
    });
    activeLoads = kept;
  }
  function deferUpgrade(img) {
    if (deferredImages.indexOf(img) !== -1) {
      return;
    }
    deferredImages.push(img);
  }
  function flushDeferredNearViewport() {
    var pending = deferredImages.slice();
    deferredImages = [];
    pending.forEach(function (img) {
      if (img.classList.contains('loaded')) {
        return;
      }
      if (isNearViewport(img)) {
        upgrade(img);
        return;
      }
      deferUpgrade(img);
    });
  }
  function flushDeferredImages() {
    var pending = deferredImages.slice();
    deferredImages = [];
    pending.forEach(function (img) {
      if (img.classList.contains('loaded')) {
        return;
      }
      observeImage(img);
    });
  }
  function upgrade(img) {
    if (img.classList.contains('loaded')) {
      return;
    }
    if (shouldDeferUpgrade(img)) {
      deferUpgrade(img);
      return;
    }
    var fullSrc = img.dataset.src;
    var srcset = img.dataset.srcset;
    var sizes = img.dataset.sizes;
    if (!fullSrc && !srcset) {
      return;
    }
    var loader = new Image();
    if (srcset) {
      loader.srcset = srcset;
    }
    if (sizes) {
      loader.sizes = sizes;
    }
    loader.src = fullSrc || '';
    function apply() {
      if (img.classList.contains('loaded')) {
        return;
      }
      if (srcset) {
        img.srcset = srcset;
        img.sizes = sizes || '';
      }
      if (fullSrc) {
        img.src = fullSrc;
      }
      img.classList.add('loaded');
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
      img.removeAttribute('data-sizes');
    }
    var entry = { loader: loader, img: img, apply: apply };
    activeLoads.push(entry);
    loader.onload = function () {
      removeActiveLoad(entry);
      apply();
    };
    loader.onerror = function () {
      removeActiveLoad(entry);
      apply();
    };
    if (loader.complete) {
      removeActiveLoad(entry);
      apply();
    }
  }
  function observeImage(img) {
    if (!img.classList.contains('blur-up') || img.classList.contains('loaded')) {
      return;
    }
    img.classList.remove('loading', 'error', 'retry');
    img.setAttribute('fetchpriority', 'low');
    if (viewportObserver) {
      viewportObserver.observe(img);
      return;
    }
    upgrade(img);
  }
  function observeImages(root) {
    root.querySelectorAll('img.blur-up:not(.loaded)').forEach(observeImage);
  }
  function createViewportObserver() {
    if (typeof IntersectionObserver === 'undefined') {
      return null;
    }
    return new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          var img = entry.target;
          viewportObserver.unobserve(img);
          upgrade(img);
        });
      },
      { root: null, rootMargin: VIEWPORT_ROOT_MARGIN, threshold: 0 }
    );
  }
  function onMediaPriority(ev) {
    var active = ev.detail && ev.detail.active;
    if (active) {
      videoPriorityActive = true;
      abortOffViewportImageLoads();
      flushDeferredNearViewport();
      return;
    }
    videoPriorityActive = false;
    flushDeferredImages();
  }
  function init() {
    document.addEventListener(MEDIA_PRIORITY_EVENT, onMediaPriority);
    viewportObserver = createViewportObserver();
    observeImages(document);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  if (typeof MutationObserver !== 'undefined') {
    var domObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) {
            return;
          }
          if (node.matches && node.matches('img.blur-up')) {
            observeImage(node);
          }
          observeImages(node);
        });
      });
    });
    domObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
