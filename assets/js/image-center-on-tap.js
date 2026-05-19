(function () {
  var MOVE_PX = 12;
  var MAX_MS = 350;
  var CENTER_RETRY_MAX = 24;
  var VIDEO_CONTROL_SELECTOR = '.post-video-player__toolbar, .post-video-player__play';
  function playerFrom(el) {
    return el.closest('.post-video-player');
  }
  function verticalTarget(el) {
    var player = playerFrom(el);
    if (player) {
      return player.querySelector('.post-video-player__frame') || player;
    }
    return el;
  }
  function centerHorizontally(el) {
    var item = playerFrom(el) || el;
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
  function centerTarget(el) {
    centerVertically(el);
    centerHorizontally(el);
  }
  function frameHasSize(player) {
    var frame = player.querySelector('.post-video-player__frame');
    var probe = frame || player;
    var rect = probe.getBoundingClientRect();
    return rect.height >= 4 && rect.width >= 4;
  }
  function centerTargetWhenSized(player, attempt) {
    var step = attempt || 0;
    if (frameHasSize(player) || step >= CENTER_RETRY_MAX) {
      centerTarget(player);
      return;
    }
    window.requestAnimationFrame(function () {
      centerTargetWhenSized(player, step + 1);
    });
  }
  function dispatchCenterTap(player) {
    player.dispatchEvent(new CustomEvent('post-video-player:center-tap'));
  }
  function activateTap(el) {
    var player = playerFrom(el);
    if (player) {
      dispatchCenterTap(player);
      return;
    }
    centerTarget(el);
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
      player.dataset.centerOnTapBound = 'true';
      var frame = player.querySelector('.post-video-player__frame');
      var video = player.querySelector('.post-video-player__video');
      if (video) {
        video.setAttribute('tabindex', '-1');
      }
      if (!frame) {
        return;
      }
      player.addEventListener('post-video-player:center-viewport', function () {
        centerTargetWhenSized(player, 0);
      });
      markTapTarget(frame, 'Показать по центру и воспроизвести', { ignoreSelector: VIDEO_CONTROL_SELECTOR });
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
