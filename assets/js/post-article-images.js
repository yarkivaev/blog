(function () {
  var MAX_HEIGHT_RATIO = 0.95;
  var resizeTimer = null;

  function isLayoutTarget(img) {
    if (!img.closest('.article__content')) {
      return false;
    }
    if (img.closest('.horizontal-scroll')) {
      return false;
    }
    return true;
  }

  function viewportLimits() {
    return {
      w: document.documentElement.clientWidth,
      h: Math.round(window.innerHeight * MAX_HEIGHT_RATIO)
    };
  }

  function ensureFigureParent(img) {
    var parent = img.parentNode;
    if (!parent) {
      return null;
    }
    if (parent.classList && parent.classList.contains('figure')) {
      return parent;
    }
    if (parent.classList && parent.classList.contains('article__content')) {
      var figure = document.createElement('div');
      figure.className = 'figure';
      parent.insertBefore(figure, img);
      figure.appendChild(img);
      return figure;
    }
    parent.className = 'figure';
    return parent;
  }

  function fitToViewport(img) {
    var nw = img.naturalWidth;
    var nh = img.naturalHeight;
    if (nw <= 0 || nh <= 0) {
      return;
    }
    var limits = viewportLimits();
    var scale = Math.min(limits.w / nw, limits.h / nh);
    img.style.width = Math.round(nw * scale) + 'px';
    img.style.height = Math.round(nh * scale) + 'px';
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.aspectRatio = '';
  }

  function applyBaseLayout(img) {
    ensureFigureParent(img);
    img.loading = 'lazy';
    img.style.maxWidth = '100vw';
    img.style.maxHeight = Math.round(window.innerHeight * MAX_HEIGHT_RATIO) + 'px';
    img.style.width = 'auto';
    img.style.height = 'auto';
    img.style.aspectRatio = '';
  }

  function layoutImage(img) {
    if (!isLayoutTarget(img)) {
      return;
    }
    applyBaseLayout(img);
    if (img.complete && img.naturalWidth > 0) {
      fitToViewport(img);
    }
  }

  function bindImage(img) {
    if (img.dataset.postArticleImageBound === 'true') {
      return;
    }
    img.dataset.postArticleImageBound = 'true';
    layoutImage(img);
    img.addEventListener('load', function () {
      if (!isLayoutTarget(img)) {
        return;
      }
      fitToViewport(img);
    });
  }

  function scan(root) {
    var scope = root || document;
    scope.querySelectorAll('.article__content img').forEach(bindImage);
  }

  function reflowAll() {
    document.querySelectorAll('.article__content img[data-post-article-image-bound="true"]').forEach(function (img) {
      if (!isLayoutTarget(img) || img.naturalWidth <= 0) {
        return;
      }
      fitToViewport(img);
    });
  }

  function onResize() {
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      reflowAll();
    }, 120);
  }

  function init() {
    scan(document);
    window.addEventListener('resize', onResize);
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) {
            return;
          }
          if (node.matches && node.matches('img')) {
            bindImage(node);
          }
          scan(node);
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
