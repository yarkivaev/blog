---
layout: post
title: "Тест HLS-плеера"
preview: "/assets/hls/test-doc-2026-05-09/poster.jpg"
description: "Служебная страница для проверки встроенного HLS-видео и кастомного плеера"
countries: []
tags: [test, hls, video]
lang: ru
published: false
---

Ниже — короткий тестовый ролик из `assets/hls/test-doc-2026-05-09/` (цветные полосы и тон).

{% assign test_hls = '/assets/hls/test-doc-2026-05-09/master.m3u8' | relative_url %}
{% assign test_poster = '/assets/hls/test-doc-2026-05-09/poster.jpg' | relative_url %}
{% include video.html src=test_hls poster=test_poster %}

Круглый кадр (как видеокружок):

{% include video.html src=test_hls poster=test_poster round=true %}
