(function () {
  var CHROME_HIDE_MS = 1500;
  var VIEWPORT_ROOT_MARGIN = '320px 0px';
  var HLS_NETWORK_RETRIES = 6;
  var HLS_MEDIA_RETRIES = 3;
  var playerState = new Map();
  var viewportRoots = new Set();
  var focusedPlaybackRoot = null;
  var idleLoadRoot = null;
  var mediaPriorityVideo = false;
  function isPlaybackActive() {
    if (!focusedPlaybackRoot) {
      return false;
    }
    var state = playerState.get(focusedPlaybackRoot);
    if (!state) {
      return false;
    }
    if (state.playIntent) {
      return true;
    }
    return !state.video.paused && !state.video.ended;
  }
  function viewportCenterDistance(root) {
    var rect = root.getBoundingClientRect();
    var centerY = rect.top + rect.height / 2;
    return Math.abs(centerY - window.innerHeight / 2);
  }
  function pickIdleLoadCandidate() {
    var best = null;
    var bestDistance = Infinity;
    viewportRoots.forEach(function (root) {
      var distance = viewportCenterDistance(root);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = root;
      }
    });
    return best;
  }
  function unmountPlayer(state) {
    if (!state.mounted) {
      return;
    }
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
    state.video.pause();
    state.video.removeAttribute('src');
    state.video.load();
    state.mounted = false;
    if (idleLoadRoot === state.root) {
      idleLoadRoot = null;
    }
  }
  function syncMediaLoading() {
    if (isPlaybackActive()) {
      idleLoadRoot = null;
      playerState.forEach(function (state, root) {
        if (root === focusedPlaybackRoot) {
          if (!state.mounted) {
            mountPlayer(state);
          }
          return;
        }
        unmountPlayer(state);
      });
      return;
    }
    var candidate = pickIdleLoadCandidate();
    idleLoadRoot = candidate;
    playerState.forEach(function (state, root) {
      if (root === candidate) {
        if (!state.mounted) {
          mountPlayer(state);
        }
        return;
      }
      unmountPlayer(state);
    });
  }
  var MEDIA_PRIORITY_EVENT = 'media-priority-video';
  function setMediaPriorityVideo(active) {
    if (active === mediaPriorityVideo) {
      return;
    }
    mediaPriorityVideo = active;
    document.dispatchEvent(new CustomEvent(MEDIA_PRIORITY_EVENT, { detail: { active: active } }));
  }
  function pauseOtherPlayers(active) {
    document.querySelectorAll('.post-video-player__video').forEach(function (el) {
      if (el !== active) {
        el.pause();
      }
    });
  }
  function setLoading(root, on) {
    root.classList.toggle('post-video-player--loading', on);
    if (on) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  }
  function hideError(root) {
    var node = root.querySelector('.post-video-player__error');
    if (!node) {
      return;
    }
    node.hidden = true;
    node.textContent = '';
    node.onclick = null;
    root.classList.remove('post-video-player--error-retry');
  }
  function showError(root, message, onRetry) {
    setLoading(root, false);
    root.classList.remove('post-video-player--play-visible');
    var playBtn = root.querySelector('.post-video-player__play');
    if (playBtn) {
      playBtn.hidden = true;
    }
    var node = root.querySelector('.post-video-player__error');
    if (!node) {
      return;
    }
    node.textContent = message;
    node.hidden = false;
    if (onRetry) {
      root.classList.add('post-video-player--error-retry');
      node.onclick = function () {
        hideError(root);
        onRetry();
      };
    }
  }
  function isTouchDevice() {
    if (isIos()) {
      return true;
    }
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }
  function createHlsInstance() {
    return new window.Hls({
      enableWorker: !isTouchDevice(),
      maxBufferLength: 12,
      maxMaxBufferLength: 30,
      fragLoadingTimeOut: 60000,
      manifestLoadingTimeOut: 30000,
      fragLoadingMaxRetry: 8,
      manifestLoadingMaxRetry: 6,
    });
  }
  function supportsNativeHls(video) {
    return video.canPlayType('application/vnd.apple.mpegurl') !== '';
  }
  function isIos() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPod/i.test(ua)) {
      return true;
    }
    if (/iPad/i.test(ua)) {
      return true;
    }
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }
  function preferNativeHls(video) {
    if (!supportsNativeHls(video)) {
      return false;
    }
    return isTouchDevice();
  }
  function hlsLevelLabel(level) {
    if (level.height) {
      return level.height + 'p';
    }
    if (level.width) {
      return level.width + 'p';
    }
    if (typeof level.level === 'number') {
      return 'Level ' + (level.level + 1);
    }
    return 'Level';
  }
  function bindQuality(root, hls, revealChrome) {
    var label = root.querySelector('.post-video-player__quality-label');
    var select = root.querySelector('.post-video-player__quality');
    if (!label || !select || !hls) {
      return;
    }
    var manual = false;
    function sortedLevels() {
      return hls.levels.slice().sort(function (a, b) {
        return (b.height || b.bitrate || 0) - (a.height || a.bitrate || 0);
      });
    }
    function populate() {
      var levels = sortedLevels();
      select.textContent = '';
      var auto = document.createElement('option');
      auto.value = '-1';
      auto.textContent = 'Auto';
      select.appendChild(auto);
      levels.forEach(function (level) {
        var option = document.createElement('option');
        option.value = String(level.level);
        option.textContent = hlsLevelLabel(level);
        select.appendChild(option);
      });
      if (levels.length < 2) {
        label.hidden = true;
        return;
      }
      label.hidden = false;
      select.value = manual ? String(hls.currentLevel) : '-1';
    }
    select.addEventListener('change', function () {
      revealChrome();
      var value = select.value;
      if (value === '-1') {
        manual = false;
        hls.currentLevel = -1;
        return;
      }
      manual = true;
      hls.currentLevel = parseInt(value, 10);
    });
    select.addEventListener('click', function (ev) {
      ev.stopPropagation();
      revealChrome();
    });
    hls.on(window.Hls.Events.MANIFEST_PARSED, populate);
    hls.on(window.Hls.Events.LEVEL_SWITCHED, function () {
      if (manual) {
        select.value = String(hls.currentLevel);
        return;
      }
      select.value = '-1';
    });
  }
  function bindHlsRecovery(hls, state) {
    var Hls = window.Hls;
    var networkRetries = 0;
    var mediaRetries = 0;
    hls.on(Hls.Events.ERROR, function (_, data) {
      if (!data.fatal) {
        return;
      }
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < HLS_NETWORK_RETRIES) {
        networkRetries += 1;
        hideError(state.root);
        setLoading(state.root, true);
        hls.startLoad();
        return;
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries < HLS_MEDIA_RETRIES) {
        mediaRetries += 1;
        hideError(state.root);
        hls.recoverMediaError();
        return;
      }
      setMediaPriorityVideo(false);
      state.playIntent = false;
      showError(state.root, 'Slow connection — tap to retry', function () {
        networkRetries = 0;
        mediaRetries = 0;
        remountPlayer(state);
        beginPlayback(state);
      });
    });
  }
  function createPlayerState(root) {
    var src = root.getAttribute('data-hls-src');
    var video = root.querySelector('.post-video-player__video');
    if (!src || !video) {
      return null;
    }
    return {
      root: root,
      video: video,
      src: src,
      hls: null,
      ui: false,
      mounted: false,
      playIntent: false,
      native: preferNativeHls(video),
      revealChrome: null,
    };
  }
  function remountPlayer(state) {
    unmountPlayer(state);
    state.playIntent = false;
    setLoading(state.root, false);
  }
  function ensureUi(state) {
    if (state.ui) {
      return;
    }
    bindUi(state.root, state.video, null, state);
    state.ui = true;
  }
  function mountPlayer(state) {
    if (state.mounted) {
      return;
    }
    ensureUi(state);
    if (state.native) {
      state.video.src = state.src;
      state.mounted = true;
      return;
    }
    if (typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
      state.hls = createHlsInstance();
      bindHlsRecovery(state.hls, state);
      state.hls.loadSource(state.src);
      state.hls.attachMedia(state.video);
      if (state.revealChrome) {
        bindQuality(state.root, state.hls, state.revealChrome);
      }
      state.mounted = true;
      return;
    }
    if (supportsNativeHls(state.video)) {
      state.native = true;
      state.video.src = state.src;
      state.mounted = true;
      return;
    }
    showError(state.root, 'HLS playback is not supported in this browser');
  }
  function requestPlay(state) {
    var promise = state.video.play();
    if (promise === undefined) {
      return;
    }
    promise.catch(function (err) {
      if (!state.playIntent) {
        return;
      }
      if (err && err.name === 'NotAllowedError') {
        setLoading(state.root, false);
        state.playIntent = false;
        setMediaPriorityVideo(false);
        return;
      }
    });
  }
  function cancelPlaybackExcept(activeRoot) {
    playerState.forEach(function (state, root) {
      if (root === activeRoot) {
        return;
      }
      state.playIntent = false;
      state.video.pause();
      setLoading(state.root, false);
      unmountPlayer(state);
    });
  }
  function beginPlayback(state) {
    if (!state) {
      return;
    }
    cancelPlaybackExcept(state.root);
    pauseOtherPlayers(state.video);
    hideError(state.root);
    focusedPlaybackRoot = state.root;
    setMediaPriorityVideo(true);
    state.playIntent = true;
    setLoading(state.root, true);
    mountPlayer(state);
    if (!state.mounted) {
      state.playIntent = false;
      setMediaPriorityVideo(false);
      return;
    }
    requestPlay(state);
    syncMediaLoading();
  }
  function bindUi(root, video, hls, state) {
    var frame = root.querySelector('.post-video-player__frame');
    var toolbar = root.querySelector('.post-video-player__toolbar');
    var seek = root.querySelector('.post-video-player__seek');
    var muteBtn = root.querySelector('.post-video-player__mute');
    var rate = root.querySelector('.post-video-player__rate');
    var playBtn = root.querySelector('.post-video-player__play');
    var scrubbing = false;
    var chromeTimer = null;
    var chromeHideAfterMs = 0;
    var started = false;
    var hoverInside = false;
    var hoverChrome = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    function setLoadingState(on) {
      setLoading(root, on);
      syncPlayOverlay();
    }
    function syncPlayOverlay() {
      var idle = video.paused || video.ended;
      var chromeHidden = root.classList.contains('post-video-player--chrome-hidden');
      var show = idle && chromeHidden && !video.error;
      root.classList.toggle('post-video-player--play-visible', show);
      if (playBtn) {
        playBtn.hidden = !show;
      }
    }
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
      syncPlayOverlay();
    }
    function hideToolbarDom() {
      root.classList.add('post-video-player--chrome-hidden');
      if (toolbar) {
        toolbar.setAttribute('hidden', '');
        toolbar.style.setProperty('display', 'none', 'important');
      }
      syncPlayOverlay();
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
      if (!video.paused && !video.ended) {
        armChromeHideTimer();
      }
    }
    if (state) {
      state.revealChrome = revealChrome;
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
    function onFramePointerEnter() {
      if (!hoverChrome) {
        return;
      }
      hoverInside = true;
      showToolbarDom();
      clearChromeHidePlan();
    }
    function onFramePointerLeave() {
      if (!hoverChrome) {
        return;
      }
      hoverInside = false;
      if (scrubbing) {
        return;
      }
      if (!started) {
        hideToolbarDom();
        return;
      }
      if (video.paused || video.ended) {
        return;
      }
      armChromeHideTimer();
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
    function signalCenterViewport() {
      root.dispatchEvent(new CustomEvent('post-video-player:center-viewport'));
    }
    function onCenterTap() {
      if (video.paused || video.ended) {
        if (video.ended) {
          video.currentTime = 0;
        }
        signalCenterViewport();
        if (state) {
          beginPlayback(state);
        }
        revealChrome();
        return;
      }
      if (state) {
        state.playIntent = false;
        setMediaPriorityVideo(false);
      }
      video.pause();
      revealChrome();
    }
    if (playBtn) {
      playBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        onCenterTap();
      });
    }
    root.addEventListener('post-video-player:center-tap', onCenterTap);
    video.addEventListener('playing', function () {
      if (state) {
        state.playIntent = false;
      }
      setLoadingState(false);
      signalCenterViewport();
      video.addEventListener('resize', signalCenterViewport, { once: true });
    });
    if (frame) {
      frame.addEventListener('pointerenter', onFramePointerEnter);
      frame.addEventListener('pointerleave', onFramePointerLeave);
    }
    function dismissChromeIfOutside(ev) {
      if (!frame || frame.contains(ev.target)) {
        return;
      }
      if (!started) {
        return;
      }
      if (hoverInside) {
        return;
      }
      clearChromeHidePlan();
      hideToolbarDom();
    }
    document.addEventListener('pointerdown', dismissChromeIfOutside, true);
    video.addEventListener('play', function () {
      markStarted();
      focusedPlaybackRoot = root;
      pauseOtherPlayers(video);
      syncPlayOverlay();
      syncChromeAfterPlaySettled();
    });
    video.addEventListener('pause', function () {
      if (state && !state.playIntent) {
        setLoadingState(false);
        if (focusedPlaybackRoot === root) {
          focusedPlaybackRoot = null;
        }
        if (focusedPlaybackRoot === null) {
          setMediaPriorityVideo(false);
          syncMediaLoading();
        }
      }
      syncPlayOverlay();
      syncChromeWithPlayback();
    });
    video.addEventListener('ended', function () {
      clearChromeHidePlan();
      if (focusedPlaybackRoot === root) {
        focusedPlaybackRoot = null;
      }
      setMediaPriorityVideo(false);
      syncMediaLoading();
      syncPlayOverlay();
      if (started) {
        showToolbarDom();
      } else {
        hideToolbarDom();
      }
    });
    video.addEventListener('loadedmetadata', function () {
      refreshSeekMax();
    });
    video.addEventListener('waiting', function () {
      if (scrubbing) {
        return;
      }
      if (started && !video.paused) {
        return;
      }
      if (state && state.playIntent) {
        setLoadingState(true);
      }
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
    video.addEventListener('error', function () {
      if (!state || !state.mounted) {
        return;
      }
      setMediaPriorityVideo(false);
      state.playIntent = false;
      showError(root, 'Slow connection — tap to retry', function () {
        remountPlayer(state);
        beginPlayback(state);
      });
    });
    syncPlayOverlay();
    clearChromeHidePlan();
    hideToolbarDom();
  }
  function activatePlayer(root) {
    viewportRoots.add(root);
    syncMediaLoading();
  }
  function deactivatePlayer(root) {
    viewportRoots.delete(root);
    var state = playerState.get(root);
    if (!state) {
      syncMediaLoading();
      return;
    }
    if (focusedPlaybackRoot === root && isPlaybackActive()) {
      return;
    }
    state.playIntent = false;
    state.video.pause();
    setLoading(state.root, false);
    unmountPlayer(state);
    syncMediaLoading();
  }
  function observePlayers(roots) {
    if (typeof IntersectionObserver === 'undefined') {
      roots.forEach(activatePlayer);
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            activatePlayer(entry.target);
          } else {
            deactivatePlayer(entry.target);
          }
        });
      },
      { root: null, rootMargin: VIEWPORT_ROOT_MARGIN, threshold: 0 }
    );
    roots.forEach(function (root) {
      observer.observe(root);
    });
  }
  var scrollRepickPending = false;
  function onScrollIdleRepick() {
    if (scrollRepickPending || isPlaybackActive()) {
      return;
    }
    scrollRepickPending = true;
    window.requestAnimationFrame(function () {
      scrollRepickPending = false;
      if (isPlaybackActive()) {
        return;
      }
      var candidate = pickIdleLoadCandidate();
      if (candidate === idleLoadRoot) {
        return;
      }
      syncMediaLoading();
    });
  }
  function init() {
    var roots = document.querySelectorAll('[data-post-video-player]');
    roots.forEach(function (root) {
      root.classList.remove('post-video-player--loading');
      root.removeAttribute('aria-busy');
      var state = createPlayerState(root);
      if (!state) {
        return;
      }
      playerState.set(root, state);
      ensureUi(state);
    });
    observePlayers(roots);
    window.addEventListener('scroll', onScrollIdleRepick, { passive: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
