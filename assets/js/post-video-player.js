(function () {
  var CHROME_HIDE_MS = 1500;
  function pauseOtherPlayers(active) {
    document.querySelectorAll('.post-video-player__video').forEach(function (el) {
      if (el !== active) {
        el.pause();
      }
    });
  }
  function showError(root, message) {
    var node = root.querySelector('.post-video-player__error');
    if (!node) {
      return;
    }
    node.textContent = message;
    node.hidden = false;
  }
  function supportsNativeHls(video) {
    return video.canPlayType('application/vnd.apple.mpegurl') !== '';
  }
  function bindUi(root, video, hls) {
    var frame = root.querySelector('.post-video-player__frame');
    var toolbar = root.querySelector('.post-video-player__toolbar');
    var seek = root.querySelector('.post-video-player__seek');
    var muteBtn = root.querySelector('.post-video-player__mute');
    var rate = root.querySelector('.post-video-player__rate');
    var scrubbing = false;
    var chromeTimer = null;
    var chromeHideAfterMs = 0;
    var started = false;
    function markStarted() {
      started = true;
    }
    function clearChromeTimer() {
      if (chromeTimer !== null) {
        clearTimeout(chromeTimer);
        chromeTimer = null;
      }
    }
    function clearChromeHidePlan() {
      clearChromeTimer();
      chromeHideAfterMs = 0;
    }
    function showToolbarDom() {
      root.classList.remove('post-video-player--chrome-hidden');
      if (toolbar) {
        toolbar.removeAttribute('hidden');
        toolbar.style.removeProperty('display');
      }
    }
    function hideToolbarDom() {
      root.classList.add('post-video-player--chrome-hidden');
      if (toolbar) {
        toolbar.setAttribute('hidden', '');
        toolbar.style.setProperty('display', 'none', 'important');
      }
    }
    function hideChrome() {
      if (video.paused || video.ended) {
        return;
      }
      clearChromeHidePlan();
      hideToolbarDom();
    }
    function armChromeHideTimer() {
      clearChromeTimer();
      chromeHideAfterMs = Date.now() + CHROME_HIDE_MS;
      chromeTimer = window.setTimeout(function () {
        chromeTimer = null;
        hideChrome();
      }, CHROME_HIDE_MS);
    }
    function revealChrome() {
      markStarted();
      showToolbarDom();
      clearChromeHidePlan();
      if (!video.paused) {
        armChromeHideTimer();
      }
    }
    function syncChromeWithPlayback() {
      clearChromeHidePlan();
      if (!started) {
        hideToolbarDom();
        return;
      }
      if (video.paused || video.ended) {
        showToolbarDom();
      } else {
        armChromeHideTimer();
      }
    }
    function syncChromeAfterPlaySettled() {
      window.setTimeout(function () {
        if (!video.paused && !video.ended) {
          syncChromeWithPlayback();
        }
      }, 200);
    }
    function refreshSeekMax() {
      if (!seek) {
        return;
      }
      if (video.duration && isFinite(video.duration)) {
        seek.max = '1000';
        seek.disabled = false;
      } else {
        seek.disabled = true;
      }
    }
    if (seek) {
      seek.addEventListener('pointerdown', function () {
        scrubbing = true;
        revealChrome();
      });
      seek.addEventListener('pointerup', function () {
        scrubbing = false;
        if (!video.paused) {
          syncChromeWithPlayback();
        }
      });
      seek.addEventListener('input', function () {
        if (!video.duration || !isFinite(video.duration)) {
          return;
        }
        var ratio = Number(seek.value) / 1000;
        video.currentTime = ratio * video.duration;
      });
    }
    muteBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      revealChrome();
      video.muted = !video.muted;
      muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
      muteBtn.textContent = video.muted ? 'Unmute' : 'Mute';
    });
    rate.addEventListener('change', function () {
      revealChrome();
      video.playbackRate = parseFloat(rate.value);
    });
    rate.addEventListener('click', function (ev) {
      ev.stopPropagation();
      revealChrome();
    });
    function togglePlayFromStage(ev) {
      if (ev.target.closest('.post-video-player__toolbar')) {
        return;
      }
      revealChrome();
      if (video.paused || video.ended) {
        video.play().catch(function () {});
      } else {
        video.pause();
      }
    }
    if (frame) {
      frame.addEventListener('click', togglePlayFromStage, true);
    }
    function dismissChromeIfOutside(ev) {
      if (!frame || frame.contains(ev.target)) {
        return;
      }
      if (!started) {
        return;
      }
      clearChromeHidePlan();
      hideToolbarDom();
    }
    document.addEventListener('pointerdown', dismissChromeIfOutside, true);
    video.addEventListener('keydown', function (ev) {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        revealChrome();
        if (video.paused || video.ended) {
          video.play().catch(function () {});
        } else {
          video.pause();
        }
      }
    });
    video.addEventListener('play', function () {
      markStarted();
      pauseOtherPlayers(video);
      syncChromeAfterPlaySettled();
    });
    video.addEventListener('pause', function () {
      syncChromeWithPlayback();
    });
    video.addEventListener('ended', function () {
      clearChromeHidePlan();
      if (started) {
        showToolbarDom();
      } else {
        hideToolbarDom();
      }
    });
    video.addEventListener('loadedmetadata', function () {
      refreshSeekMax();
    });
    video.addEventListener('timeupdate', function () {
      if (chromeHideAfterMs && !video.paused && !video.ended && Date.now() >= chromeHideAfterMs) {
        hideChrome();
      }
      if (scrubbing || !seek || !video.duration || !isFinite(video.duration)) {
        return;
      }
      seek.value = String(Math.floor((video.currentTime / video.duration) * 1000));
    });
    video.addEventListener('volumechange', function () {
      muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
      muteBtn.textContent = video.muted ? 'Unmute' : 'Mute';
    });
    muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
    muteBtn.textContent = video.muted ? 'Unmute' : 'Mute';
    if (seek) {
      seek.disabled = true;
    }
    if (hls) {
      hls.on(window.Hls.Events.ERROR, function (_, data) {
        if (data.fatal) {
          showError(root, 'Video playback failed');
        }
      });
    }
    video.addEventListener('error', function () {
      showError(root, 'Video playback failed');
    });
    clearChromeHidePlan();
    hideToolbarDom();
  }
  function mount(root) {
    var src = root.getAttribute('data-hls-src');
    var video = root.querySelector('.post-video-player__video');
    if (!src || !video) {
      return;
    }
    var hls = null;
    if (supportsNativeHls(video)) {
      video.src = src;
    } else if (typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
      hls = new window.Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      showError(root, 'HLS playback is not supported in this browser');
      return;
    }
    bindUi(root, video, hls);
  }
  function init() {
    document.querySelectorAll('[data-post-video-player]').forEach(mount);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
