(function () {
  var EPS = 2;
  function carouselItems(track) {
    return Array.from(track.children);
  }
  function itemMetrics(track) {
    return carouselItems(track).map(function (el) {
      var left = el.offsetLeft;
      var width = el.offsetWidth;
      return { el: el, left: left, right: left + width, width: width };
    });
  }
  function scrollMaximum(track) {
    return Math.max(0, track.scrollWidth - track.clientWidth);
  }
  function trackIsScrollable(track) {
    return scrollMaximum(track) > EPS;
  }
  function boundaryAtRightEdge(metrics) {
    var list = [];
    var index = 0;
    while (index < metrics.length) {
      list.push(metrics[index].right);
      index += 1;
    }
    return list;
  }
  function boundaryAtLeftEdge(metrics) {
    var list = [];
    var index = 0;
    while (index < metrics.length) {
      list.push(metrics[index].left);
      index += 1;
    }
    return list;
  }
  function nearestBoundaryRight(viewRight, boundaries) {
    var candidate = null;
    var index = 0;
    while (index < boundaries.length) {
      var position = boundaries[index];
      if (position > viewRight + EPS) {
        if (candidate === null || position < candidate) {
          candidate = position;
        }
      }
      index += 1;
    }
    return candidate;
  }
  function nearestBoundaryLeft(viewLeft, boundaries) {
    var candidate = null;
    var index = 0;
    while (index < boundaries.length) {
      var position = boundaries[index];
      if (position < viewLeft - EPS) {
        if (candidate === null || position > candidate) {
          candidate = position;
        }
      }
      index += 1;
    }
    return candidate;
  }
  function targetScrollRight(metrics, scrollLeft, clientWidth, max) {
    var viewRight = scrollLeft + clientWidth;
    var boundary = nearestBoundaryRight(viewRight, boundaryAtRightEdge(metrics));
    if (boundary === null) {
      return scrollLeft;
    }
    return Math.min(Math.max(0, boundary - clientWidth), max);
  }
  function targetScrollLeft(metrics, scrollLeft) {
    var boundary = nearestBoundaryLeft(scrollLeft, boundaryAtLeftEdge(metrics));
    if (boundary === null) {
      return scrollLeft;
    }
    return Math.max(0, boundary);
  }
  function canScrollNext(track, metrics) {
    var max = scrollMaximum(track);
    var viewRight = track.scrollLeft + track.clientWidth;
    var boundary = nearestBoundaryRight(viewRight, boundaryAtRightEdge(metrics));
    if (boundary === null) {
      return false;
    }
    var target = Math.min(Math.max(0, boundary - track.clientWidth), max);
    return Math.abs(target - track.scrollLeft) > EPS;
  }
  function canScrollPrev(track, metrics) {
    var boundary = nearestBoundaryLeft(track.scrollLeft, boundaryAtLeftEdge(metrics));
    if (boundary === null) {
      return false;
    }
    var target = Math.max(0, boundary);
    return Math.abs(target - track.scrollLeft) > EPS;
  }
  function setButtonVisible(button, visible) {
    button.hidden = !visible;
    button.setAttribute('aria-hidden', visible ? 'false' : 'true');
    button.tabIndex = visible ? 0 : -1;
  }
  function refreshCarousel(carousel) {
    var track = carousel.querySelector('.horizontal-scroll');
    if (!track) {
      return;
    }
    var scrollable = trackIsScrollable(track);
    carousel.classList.toggle('horizontal-scroll-carousel--static', !scrollable);
    if (!scrollable) {
      track.scrollLeft = 0;
      setButtonVisible(carousel.querySelector('.horizontal-scroll-carousel__btn--prev'), false);
      setButtonVisible(carousel.querySelector('.horizontal-scroll-carousel__btn--next'), false);
      return;
    }
    var metrics = itemMetrics(track);
    setButtonVisible(carousel.querySelector('.horizontal-scroll-carousel__btn--prev'), canScrollPrev(track, metrics));
    setButtonVisible(carousel.querySelector('.horizontal-scroll-carousel__btn--next'), canScrollNext(track, metrics));
  }
  function scrollTrack(track, left) {
    track.scrollTo({ left: left, behavior: 'smooth' });
  }
  function bindCarousel(carousel) {
    var track = carousel.querySelector('.horizontal-scroll');
    var prevBtn = carousel.querySelector('.horizontal-scroll-carousel__btn--prev');
    var nextBtn = carousel.querySelector('.horizontal-scroll-carousel__btn--next');
    if (!track || !prevBtn || !nextBtn) {
      return;
    }
    function update() {
      refreshCarousel(carousel);
    }
    prevBtn.addEventListener('click', function () {
      var metrics = itemMetrics(track);
      var target = targetScrollLeft(metrics, track.scrollLeft);
      scrollTrack(track, target);
    });
    nextBtn.addEventListener('click', function () {
      var metrics = itemMetrics(track);
      var max = scrollMaximum(track);
      var target = targetScrollRight(metrics, track.scrollLeft, track.clientWidth, max);
      scrollTrack(track, target);
    });
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('scrollend', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    carouselItems(track).forEach(function (el) {
      if (el.tagName === 'IMG') {
        el.addEventListener('load', update, { passive: true });
      }
    });
    if (typeof ResizeObserver !== 'undefined') {
      var observer = new ResizeObserver(update);
      observer.observe(track);
      carouselItems(track).forEach(function (el) {
        observer.observe(el);
      });
    }
    update();
  }
  function wrapTrack(track) {
    if (track.closest('.horizontal-scroll-carousel')) {
      return;
    }
    var carousel = document.createElement('div');
    carousel.className = 'horizontal-scroll-carousel';
    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'horizontal-scroll-carousel__btn horizontal-scroll-carousel__btn--prev';
    prevBtn.setAttribute('aria-label', 'Предыдущее фото');
    prevBtn.innerHTML = '&#10094;';
    prevBtn.hidden = true;
    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'horizontal-scroll-carousel__btn horizontal-scroll-carousel__btn--next';
    nextBtn.setAttribute('aria-label', 'Следующее фото');
    nextBtn.innerHTML = '&#10095;';
    nextBtn.hidden = true;
    var parent = track.parentNode;
    parent.insertBefore(carousel, track);
    carousel.appendChild(prevBtn);
    carousel.appendChild(track);
    carousel.appendChild(nextBtn);
    bindCarousel(carousel);
  }
  function init() {
    document.querySelectorAll('.horizontal-scroll').forEach(wrapTrack);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
