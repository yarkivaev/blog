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

Среда, в которой собирался репозиторий, не имела доступа к файлу в `~/Downloads`, поэтому ниже временно стоит короткий тестовый ролик (цветные полосы и тон). Чтобы встроить ваш файл `doc_2026-05-09_20-52-15.mp4`, выполните в корне проекта:

`./utils/encode-mp4-to-assets-hls.sh "/Users/yarkivaev/Downloads/doc_2026-05-09_20-52-15.mp4" test-doc-2026-05-09`

После этого те же URL в этом посте начнут указывать на ваше видео.

{% assign test_hls = '/assets/hls/test-doc-2026-05-09/master.m3u8' | relative_url %}
{% assign test_poster = '/assets/hls/test-doc-2026-05-09/poster.jpg' | relative_url %}
{% include video.html src=test_hls poster=test_poster %}

Круглый кадр (как видеокружок):

{% include video.html src=test_hls poster=test_poster round=true %}
