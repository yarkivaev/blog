(function () {
  var MOVE_PX = 12;
  var MAX_MS = 350;
  var VIDEO_CONTROL_SELECTOR = '.post-video-player__toolbar, .post-video-player__play';
  function verticalTarget(el) {
    if (el.classList.contains('post-video-player')) {
      return el.querySelector('.post-video-player__frame') || el;
    }
    return el;
  }
  function horizontalItem(el) {
    if (el.classList.contains('post-video-player__frame')) {
      return el.closest('.post-video-player');
    }
    return el;
  }
  function centerHorizontally(el) {
    var item = horizontalItem(el);
    if (!item) {
      return;
    }
    var track = item.closest('.horizontal-scroll');
    if (!track) {
      return;
    }
    var max = Math.max(0, track.scrollWidth - track.clientWidth);
    if (max <= 2) {
      return;
    }
    var left = item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, Math.min(left, max)), behavior: 'smooth' });
  }
  function centerVertically(el) {
    var target = verticalTarget(el);
    var rect = target.getBoundingClientRect();
    var top = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
  function center(el) {
    centerVertically(el);
    centerHorizontally(el);
  }
  function videoWillStart(player) {
    var video = player.querySelector('.post-video-player__video');
    if (!video) {
      return true;
    }
    return video.paused || video.ended;
  }
  function afterCenterTap(el) {
    if (el.classList.contains('post-video-player')) {
      el.dispatchEvent(new CustomEvent('post-video-player:center-tap'));
    }
  }
  function activateTap(el) {
    if (el.classList.contains('post-video-player') && !videoWillStart(el)) {
      afterCenterTap(el);
      return;
    }
    center(el);
    afterCenterTap(el);
  }
  function bindTap(el, options) {
    var ignoreSelector = options && options.ignoreSelector;
    var pointerId = null;
    var startX = 0;
    var startY = 0;
    var startT = 0;
    var moved = false;
    function ignoreTarget(target) {
      if (!ignoreSelector) {
        return false;
      }
      return Boolean(target.closest(ignoreSelector));
    }
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) {
        return;
      }
      if (ignoreTarget(e.target)) {
        return;
      }
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startT = Date.now();
      moved = false;
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId !== pointerId) {
        return;
      }
      if (Math.abs(e.clientX - startX) > MOVE_PX || Math.abs(e.clientY - startY) > MOVE_PX) {
        moved = true;
      }
    });
    function finish(e) {
      if (e.pointerId !== pointerId) {
        return;
      }
      var elapsed = Date.now() - startT;
      var tap = !moved && elapsed <= MAX_MS;
      pointerId = null;
      if (tap) {
        e.preventDefault();
        activateTap(el);
      }
    }
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', function (e) {
      if (e.pointerId === pointerId) {
        pointerId = null;
        moved = true;
      }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateTap(el);
      }
    });
  }
  function markTapTarget(el, label, options) {
    if (el.dataset.centerOnTapBound === 'true') {
      return;
    }
    el.dataset.centerOnTapBound = 'true';
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', label);
    bindTap(el, options);
  }
  function bindImages(root) {
    root.querySelectorAll('img').forEach(function (img) {
      if (img.dataset.centerOnTapBound === 'true') {
        return;
      }
      img.setAttribute('draggable', 'false');
      markTapTarget(img, 'Показать по центру экрана');
    });
  }
  function bindVideos(root) {
    root.querySelectorAll('.post-video-player').forEach(function (player) {
      if (player.dataset.centerOnTapBound === 'true') {
        return;
      }
      var video = player.querySelector('.post-video-player__video');
      if (video) {
        video.setAttribute('tabindex', '-1');
      }
      markTapTarget(player, 'Показать по центру и воспроизвести', { ignoreSelector: VIDEO_CONTROL_SELECTOR });
    });
  }
  function init() {
    var root = document.querySelector('.article__content');
    if (!root) {
      return;
    }
    bindImages(root);
    bindVideos(root);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
