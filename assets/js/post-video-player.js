(function () {
  var CHROME_HIDE_MS = 1500;
  var VIEWPORT_ROOT_MARGIN = '320px 0px';
  var HLS_NETWORK_RETRIES = 6;
  var HLS_MEDIA_RETRIES = 3;
  var PREFETCH_SEGMENTS = 2;
  var playerState = new Map();
  var viewportRoots = new Set();
  var focusedPlaybackRoot = null;
  var mediaPriorityVideo = false;
  var MEDIA_PRIORITY_EVENT = 'media-priority-video';
  var HLS_PRELOAD_LINK_ID = 'media-priority-hls-preload';
  function setMediaPriorityVideo(active) {
    if (active === mediaPriorityVideo) {
      return;
    }
    mediaPriorityVideo = active;
    document.dispatchEvent(new CustomEvent(MEDIA_PRIORITY_EVENT, { detail: { active: active } }));
    var preloadLink = document.getElementById(HLS_PRELOAD_LINK_ID);
    if (!active && preloadLink) {
      preloadLink.remove();
    }
  }
  function preloadHlsManifest(url) {
    if (!url || document.getElementById(HLS_PRELOAD_LINK_ID)) {
      return;
    }
    var link = document.createElement('link');
    link.id = HLS_PRELOAD_LINK_ID;
    link.rel = 'preload';
    link.as = 'fetch';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
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
      maxBufferLength: 8,
      maxMaxBufferLength: 20,
      maxBufferSize: 25 * 1000 * 1000,
      backBufferLength: 30,
      startFragPrefetch: false,
      fragLoadingTimeOut: 60000,
      manifestLoadingTimeOut: 30000,
      levelLoadingTimeOut: 30000,
      fragLoadingMaxRetry: 8,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 2000,
      manifestLoadingRetryDelay: 2000,
      levelLoadingRetryDelay: 2000,
    });
  }
  function retryPlayback(state) {
    hideError(state.root);
    setLoading(state.root, true);
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
    state.media = false;
    state.prepared = false;
    state.sourceLoaded = false;
    resetPlayTimers(state);
    state.playIntent = false;
    state.video.pause();
    state.video.removeAttribute('src');
    state.video.load();
    state.onFragBuffered = null;
    state.prefetchMode = false;
    state.prefetchStopped = false;
    prepareMedia(state);
    beginPlayback(state);
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
      showError(state.root, 'Slow connection — tap to retry', function () {
        networkRetries = 0;
        mediaRetries = 0;
        retryPlayback(state);
      });
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
    function syncLoadingFromReadyState() {
      if (video.error) {
        setLoadingState(false);
        return;
      }
      if (video.readyState >= 2) {
        setLoadingState(false);
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
    if (playBtn) {
      playBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (video.ended) {
          video.currentTime = 0;
        }
        root.dispatchEvent(new CustomEvent('post-video-player:center-tap'));
      });
    }
    var centerSignaled = false;
    function signalCenterOnce() {
      if (centerSignaled) {
        return;
      }
      centerSignaled = true;
      root.dispatchEvent(new CustomEvent('post-video-player:center-viewport'));
    }
    function onPlaybackReady() {
      if (!state || !state.playIntent || !video.paused) {
        return;
      }
      tryPlayback(state);
    }
    video.addEventListener('playing', function () {
      if (state) {
        clearPlayIntent(state);
      }
      setLoadingState(false);
      signalCenterOnce();
      video.addEventListener('resize', signalCenterOnce, { once: true });
    });
    video.addEventListener('canplay', function () {
      if (state && state.playIntent && state.native) {
        setLoadingState(false);
      }
      onPlaybackReady();
    });
    video.addEventListener('loadeddata', onPlaybackReady);
    root.addEventListener('post-video-player:center-tap', function () {
      if (video.paused || video.ended) {
        if (state) {
          beginPlayback(state);
        }
        revealChrome();
      } else {
        if (state) {
          clearPlayIntent(state);
        }
        video.pause();
        revealChrome();
      }
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
      stopPrefetchExcept(root);
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
        refreshViewportPrefetch();
      }
      syncPlayOverlay();
      syncChromeWithPlayback();
    });
    video.addEventListener('ended', function () {
      clearChromeHidePlan();
      if (focusedPlaybackRoot === root) {
        focusedPlaybackRoot = null;
      }
      refreshViewportPrefetch();
      syncPlayOverlay();
      if (started) {
        showToolbarDom();
      } else {
        hideToolbarDom();
      }
    });
    video.addEventListener('loadedmetadata', function () {
      refreshSeekMax();
      if (state && state.playIntent && state.native) {
        setLoadingState(false);
        tryPlayback(state);
      }
    });
    video.addEventListener('waiting', function () {
      if (scrubbing) {
        return;
      }
      if (state && state.native && state.video.readyState >= 2) {
        return;
      }
      if (started && state && state.playIntent) {
        return;
      }
      setLoadingState(true);
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
      if (hls || !state || !state.sourceLoaded) {
        return;
      }
      showError(root, 'Slow connection — tap to retry', function () {
        retryPlayback(state);
      });
    });
    syncLoadingFromReadyState();
    syncPlayOverlay();
    clearChromeHidePlan();
    hideToolbarDom();
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
      media: false,
      prepared: false,
      sourceLoaded: false,
      playIntent: false,
      playRetryTimer: null,
      playStallTimer: null,
      prefetchMode: false,
      prefetchStopped: false,
      prefetchedSegments: 0,
      native: preferNativeHls(video),
      revealChrome: null,
    };
  }
  function canPrefetch(root) {
    if (isTouchDevice()) {
      return false;
    }
    if (!viewportRoots.has(root)) {
      return false;
    }
    if (focusedPlaybackRoot && focusedPlaybackRoot !== root) {
      return false;
    }
    return true;
  }
  function stopPrefetch(state) {
    if (!state || state.playIntent) {
      return;
    }
    if (!state.video.paused && focusedPlaybackRoot === state.root) {
      return;
    }
    if (state.hls) {
      state.hls.stopLoad();
    }
  }
  function stopPrefetchExcept(exceptRoot) {
    playerState.forEach(function (state, root) {
      if (root === exceptRoot) {
        return;
      }
      stopPrefetch(state);
    });
  }
  function refreshViewportPrefetch() {
    viewportRoots.forEach(function (root) {
      if (!canPrefetch(root)) {
        return;
      }
      var state = playerState.get(root);
      if (!state) {
        return;
      }
      prefetchStream(state);
    });
  }
  function wireHlsEvents(state) {
    var Hls = window.Hls;
    if (!state.hls) {
      return;
    }
    if (state.onFragBuffered) {
      state.hls.off(Hls.Events.FRAG_BUFFERED, state.onFragBuffered);
    }
    state.onFragBuffered = function () {
      if (state.playIntent && state.video.paused) {
        tryPlayback(state);
      }
      if (state.prefetchMode && !state.playIntent && !state.prefetchStopped) {
        state.prefetchedSegments += 1;
        if (state.prefetchedSegments >= PREFETCH_SEGMENTS) {
          state.prefetchStopped = true;
          state.hls.stopLoad();
        }
      }
    };
    state.hls.on(Hls.Events.FRAG_BUFFERED, state.onFragBuffered);
  }
  function prefetchStream(state) {
    if (!canPrefetch(state.root) || state.playIntent || state.native) {
      return;
    }
    prepareMedia(state);
    if (state.prefetchStopped && state.sourceLoaded) {
      return;
    }
    loadStream(state, false);
    if (state.hls) {
      state.prefetchMode = true;
      state.prefetchedSegments = 0;
      state.prefetchStopped = false;
      state.hls.startLoad();
    }
  }
  function clearPlayRetry(state) {
    if (state.playRetryTimer !== null) {
      clearTimeout(state.playRetryTimer);
      state.playRetryTimer = null;
    }
  }
  function resetPlayTimers(state) {
    clearPlayRetry(state);
    if (state.playStallTimer !== null) {
      clearTimeout(state.playStallTimer);
      state.playStallTimer = null;
    }
  }
  function clearPlayIntent(state) {
    state.playIntent = false;
    resetPlayTimers(state);
    setMediaPriorityVideo(false);
  }
  function tryPlayback(state) {
    var video = state.video;
    if (!state.playIntent || !video.paused) {
      return;
    }
    var promise = video.play();
    if (promise === undefined) {
      return;
    }
    promise.catch(function (err) {
      if (!state.playIntent) {
        return;
      }
      if (err && err.name === 'NotAllowedError') {
        setLoading(state.root, false);
        return;
      }
    });
  }
  function schedulePlayback(state) {
    clearPlayRetry(state);
    tryPlayback(state);
    if (!state.playIntent || !state.video.paused) {
      return;
    }
    state.playRetryTimer = window.setTimeout(function () {
      state.playRetryTimer = null;
      if (!state.playIntent || !state.video.paused) {
        return;
      }
      if (state.video.readyState >= 2) {
        tryPlayback(state);
        return;
      }
      schedulePlayback(state);
    }, 250);
  }
  function beginNativePlayback(state) {
    if (!state.sourceLoaded) {
      state.video.src = state.src;
      state.sourceLoaded = true;
      state.media = true;
    }
    tryPlayback(state);
    schedulePlayback(state);
  }
  function beginPlayback(state) {
    resetPlayTimers(state);
    state.playIntent = false;
    hideError(state.root);
    focusedPlaybackRoot = state.root;
    stopPrefetchExcept(state.root);
    setMediaPriorityVideo(true);
    state.video.setAttribute('fetchpriority', 'high');
    preloadHlsManifest(state.src);
    state.playIntent = true;
    state.prefetchMode = false;
    state.prefetchStopped = false;
    setLoading(state.root, true);
    prepareMedia(state);
    if (state.native) {
      beginNativePlayback(state);
    } else {
      ensureStreamLoaded(state, true);
      schedulePlayback(state);
    }
    state.playStallTimer = window.setTimeout(function () {
      state.playStallTimer = null;
      if (!state.playIntent || !state.video.paused) {
        return;
      }
      clearPlayIntent(state);
      setLoading(state.root, false);
      showError(state.root, 'Playback did not start — tap to retry', function () {
        beginPlayback(state);
      });
    }, 45000);
  }
  function prepareMedia(state) {
    if (state.prepared) {
      return;
    }
    if (!state.ui) {
      bindUi(state.root, state.video, null, state);
      state.ui = true;
    }
    if (state.native) {
      state.prepared = true;
      return;
    }
    if (typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
      state.hls = createHlsInstance();
      bindHlsRecovery(state.hls, state);
      state.hls.attachMedia(state.video);
      state.prepared = true;
      return;
    }
    if (supportsNativeHls(state.video)) {
      state.native = true;
      state.prepared = true;
      return;
    }
    showError(state.root, 'HLS playback is not supported in this browser');
  }
  function loadStream(state, forPlay) {
    if (state.sourceLoaded) {
      if (state.hls) {
        state.hls.startLoad();
        if (forPlay) {
          state.prefetchMode = false;
          state.prefetchStopped = false;
        }
      }
      if (forPlay && state.playIntent) {
        schedulePlayback(state);
      }
      return;
    }
    if (forPlay) {
      setLoading(state.root, true);
    }
    if (state.native) {
      state.video.src = state.src;
    } else if (state.hls) {
      state.hls.loadSource(state.src);
      wireHlsEvents(state);
      if (state.revealChrome) {
        bindQuality(state.root, state.hls, state.revealChrome);
      }
    } else if (supportsNativeHls(state.video)) {
      state.video.src = state.src;
      state.native = true;
    } else {
      setLoading(state.root, false);
      showError(state.root, 'HLS playback is not supported in this browser');
      return;
    }
    state.sourceLoaded = true;
    state.media = true;
    if (!forPlay && state.hls) {
      state.prefetchMode = true;
      state.prefetchedSegments = 0;
      state.prefetchStopped = false;
    }
  }
  function ensureStreamLoaded(state, forPlay) {
    if (!state.prepared) {
      prepareMedia(state);
    }
    loadStream(state, forPlay !== false);
  }
  function detachMedia(state) {
    if (state.playIntent) {
      return;
    }
    if (!state.video.paused && focusedPlaybackRoot === state.root) {
      return;
    }
    state.video.pause();
    if (!state.sourceLoaded) {
      setLoading(state.root, false);
      return;
    }
    stopPrefetch(state);
    state.prefetchStopped = false;
    state.prefetchedSegments = 0;
    setLoading(state.root, false);
  }
  function activatePlayer(root) {
    viewportRoots.add(root);
    var state = playerState.get(root);
    if (!state) {
      state = createPlayerState(root);
      if (!state) {
        return;
      }
      playerState.set(root, state);
    }
    prepareMedia(state);
    if (canPrefetch(root)) {
      prefetchStream(state);
    }
  }
  function deactivatePlayer(root) {
    viewportRoots.delete(root);
    var state = playerState.get(root);
    if (!state) {
      return;
    }
    if (focusedPlaybackRoot === root && !state.video.paused) {
      return;
    }
    detachMedia(state);
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
  function init() {
    var roots = document.querySelectorAll('[data-post-video-player]');
    roots.forEach(function (root) {
      root.classList.remove('post-video-player--loading');
      root.removeAttribute('aria-busy');
    });
    observePlayers(roots);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
