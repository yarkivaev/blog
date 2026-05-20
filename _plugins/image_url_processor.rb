# frozen_string_literal: true

require 'json'
require 'open-uri'

module ImageUrlProcessor
  SIZES_ARTICLE = '100vw'
  SIZES_GALLERY = '(max-width: 680px) 100vw, min(100vw, 1900px)'
  SIZES_PREVIEW = '(max-width: 680px) 100vw, min(50vw, 600px)'
  MANIFEST_DERIVED_PATH = 'derived/manifest.json'

  module_function

  def doc_field(doc, key)
    if doc.respond_to?(:data)
      val = doc.data[key] || doc.data[key.to_sym]
      return val unless val.nil?
    end
    if doc.respond_to?(:[])
      val = doc[key]
      return val unless val.nil? || (val.respond_to?(:empty?) && val.empty?)
    end
    return doc.public_send(key) if doc.respond_to?(key)

    nil
  rescue NoMethodError
    nil
  end

  def doc_path(doc)
    if doc.respond_to?(:path) && !doc.path.to_s.empty?
      return doc.path
    end
    id = doc.respond_to?(:id) ? doc.id : doc_field(doc, 'id')
    return id if id.to_s.end_with?('.md')

    nil
  end

  def post_slug(doc)
    path = doc_path(doc)
    unless path
      return doc_field(doc, 'slug').to_s
    end
    base = File.basename(path, '.*')
    if base =~ /\A\d{4}-\d{2}-\d{2}-(.+)\z/
      Regexp.last_match(1)
    else
      doc_field(doc, 'slug') || base
    end
  end

  def media_prefix(_post, storage_prefix, prefixes, slug)
    configured = prefixes[storage_prefix]
    return nil if configured.nil?

    if storage_prefix == 'local' || configured.empty?
      "/travel/#{slug}/"
    else
      configured.gsub(':slug', slug)
    end
  end

  def manifest_cache
    @manifest_cache ||= {}
  end

  def manifest_cache_key(storage_prefix, slug, prefix)
    "#{storage_prefix}:#{slug}:#{prefix}"
  end

  def fetch_manifest_json(url)
    body = URI.open(url, open_timeout: 10, read_timeout: 20).read
    JSON.parse(body)
  rescue OpenURI::HTTPError => e
    Jekyll.logger.warn 'ImageUrlProcessor:', "manifest HTTP error #{url}: #{e.message}"
    nil
  rescue StandardError => e
    Jekyll.logger.warn 'ImageUrlProcessor:', "manifest fetch failed #{url}: #{e.message}"
    nil
  end

  def load_manifest_local(site_source, slug)
    path = File.join(site_source, 'travel', slug, 'derived', 'manifest.json')
    return nil unless File.file?(path)

    JSON.parse(File.read(path))
  rescue JSON::ParserError => e
    Jekyll.logger.warn 'ImageUrlProcessor:', "invalid manifest #{path}: #{e.message}"
    nil
  end

  def load_manifest_raw(site_source, slug, storage_prefix: 'local', prefix: nil)
    cache_key = manifest_cache_key(storage_prefix, slug, prefix)
    return manifest_cache[cache_key] if manifest_cache.key?(cache_key)

    data = load_manifest_local(site_source, slug)
    if data && !data.empty?
      local_path = File.join(site_source, 'travel', slug, 'derived', 'manifest.json')
      Jekyll.logger.info 'ImageUrlProcessor:', "manifest from local #{local_path} (#{data.size} keys)"
    elsif storage_prefix == 'yandex' && prefix
      remote_url = "#{prefix}#{MANIFEST_DERIVED_PATH}"
      data = fetch_manifest_json(remote_url)
      if data && !data.empty?
        Jekyll.logger.info 'ImageUrlProcessor:', "manifest from cloud #{remote_url} (#{data.size} keys)"
      end
    end
    data = {} if data.nil?
    manifest_cache[cache_key] = data
    data
  end

  def load_manifest(site_source, slug, storage_prefix: 'local', prefix: nil)
    load_manifest_raw(site_source, slug, storage_prefix: storage_prefix, prefix: prefix)
      .reject { |key, _| key == 'videos' }
  end

  def manifest_key_for_url(img_url, slug)
    key = img_url.sub(%r{\A/+}, '').split('?', 2).first
    key.sub(%r{\Atravel/#{Regexp.escape(slug)}/}, '')
  end

  def variant_url(prefix, rel_path)
    return rel_path if rel_path.match?(%r{\Ahttps?://})

    "#{prefix}#{rel_path}"
  end

  def build_srcset(prefix, variants)
    variants.sort_by { |size, _| size.to_i }.map do |_size, meta|
      url = variant_url(prefix, meta['webp'])
      "#{url} #{meta['w']}w"
    end.join(', ')
  end

  def default_src(prefix, variants)
    ordered = variants.sort_by { |size, _| size.to_i }
    pair = ordered.find { |size, _| size == '1400' } || ordered.first
    variant_url(prefix, pair.last['webp'])
  end

  def parse_img_attributes(before, after)
    attrs = "#{before}#{after}"
    {
      alt: attrs[/\balt="([^"]*)"/i, 1],
      class: attrs[/\bclass="([^"]*)"/i, 1]
    }
  end

  def preview_path?(preview)
    preview.to_s.match?(%r{\Ahttps?://}) || preview.to_s.start_with?('/assets/')
  end

  def post_media_context(doc, site)
    preview = doc_field(doc, 'preview')
    return nil if preview.nil? || preview.to_s.empty?
    return nil if preview_path?(preview)

    site_data = site.data['site']
    return nil unless site_data && site_data['image_storage'] && site_data['image_storage']['prefixes']

    storage_prefix = doc_field(doc, 'storage_prefix') || site_data.dig('image_storage', 'default_prefix') || 'local'
    prefixes = site_data['image_storage']['prefixes']
    slug = post_slug(doc)
    prefix = media_prefix(doc, storage_prefix, prefixes, slug)
    return nil if prefix.nil?

    manifest = load_manifest(site.source, slug, storage_prefix: storage_prefix, prefix: prefix)
    lookup = manifest_key_for_url(preview.to_s, slug)
    {
      preview: preview.to_s,
      prefix: prefix,
      entry: manifest[lookup]
    }
  end

  def preview_fallback_src(doc, site)
    preview = doc_field(doc, 'preview')
    return preview.to_s if preview_path?(preview)

    ctx = post_media_context(doc, site)
    return nil unless ctx

    "#{ctx[:prefix]}#{ctx[:preview]}"
  end

  def preview_absolute_url(doc, site)
    preview = doc_field(doc, 'preview')
    return preview.to_s if preview_path?(preview)

    ctx = post_media_context(doc, site)
    return preview_fallback_src(doc, site) unless ctx

    entry = ctx[:entry]
    if entry && !(entry['variants'] || {}).empty?
      default_src(ctx[:prefix], entry['variants'])
    else
      "#{ctx[:prefix]}#{ctx[:preview]}"
    end
  end

  def derivative_entry?(entry)
    return false if entry.nil?

    variants = entry['variants'] || {}
    lqip = entry['lqip']
    !variants.empty? && !lqip.nil?
  end

  def build_plain_img(prefix, img_url, parsed, gallery: false)
    src = img_url.to_s.match?(%r{\Ahttps?://}) ? img_url.to_s : "#{prefix}#{img_url}"
    gallery_attr = gallery ? ' data-image-layout="gallery"' : ''
    alt = parsed[:alt] ? %( alt="#{parsed[:alt]}") : ''
    class_attr = parsed[:class] ? %( class="#{parsed[:class]}") : ''
    %(<img#{class_attr}#{gallery_attr} src="#{src}"#{alt} loading="lazy" decoding="async">)
  end

  def preview_responsive_img(doc, site, alt: nil)
    ctx = post_media_context(doc, site)
    return nil unless ctx

    title = alt || doc_field(doc, 'title')
    parsed = { alt: title, class: nil }
    entry = ctx[:entry]
    if derivative_entry?(entry)
      responsive = build_responsive_img(ctx[:prefix], entry, parsed, gallery: false, sizes: SIZES_PREVIEW)
      return responsive if responsive
    end
    build_plain_img(ctx[:prefix], ctx[:preview], parsed, gallery: false)
  end

  def build_responsive_img(prefix, entry, parsed, gallery: false, sizes: nil)
    variants = entry['variants'] || {}
    lqip = entry['lqip']
    return nil if variants.empty? || lqip.nil?

    srcset = build_srcset(prefix, variants)
    full_src = default_src(prefix, variants)
    lqip_src = variant_url(prefix, lqip['webp'])
    sizes = sizes || (gallery ? SIZES_GALLERY : SIZES_ARTICLE)
    gallery_attr = gallery ? ' data-image-layout="gallery"' : ''
    alt = parsed[:alt] ? %( alt="#{parsed[:alt]}") : ''
    extra_class = parsed[:class] ? " #{parsed[:class]}" : ''
    %(<img class="blur-up#{extra_class}"#{gallery_attr} src="#{lqip_src}" data-src="#{full_src}" data-srcset="#{srcset}" data-sizes="#{sizes}"#{alt} loading="lazy" decoding="async">)
  end
end

Jekyll::Hooks.register :posts, :pre_render do |post|
  next unless post.url.start_with?('/travel/')
  next unless post.data['preview']
  next if post.data['image']

  url = ImageUrlProcessor.preview_absolute_url(post, post.site)
  post.data['image'] = url if url && !url.to_s.empty?
end

Jekyll::Hooks.register :posts, :post_render do |post|
  next unless post.url.start_with?('/travel/')
  next unless post.data['storage_prefix']

  storage_prefix = post.data['storage_prefix']
  site_data = post.site.data['site']
  next unless site_data && site_data['image_storage'] && site_data['image_storage']['prefixes']

  prefixes = site_data['image_storage']['prefixes']
  slug = ImageUrlProcessor.post_slug(post)
  prefix = ImageUrlProcessor.media_prefix(post, storage_prefix, prefixes, slug)
  next if prefix.nil?

  manifest = ImageUrlProcessor.load_manifest(
    post.site.source, slug, storage_prefix: storage_prefix, prefix: prefix
  )

  html = post.output.gsub(%r{<div class="horizontal-scroll"[^>]*>.*?</div>}m) do |block|
    block.gsub(/<img\s/, '<img data-image-layout="gallery" ')
  end

  post.output = html.gsub(%r{<img\s+([^>]*\s+)?src="([^"]+)"([^>]*)>}i) do |match|
    before = Regexp.last_match(1) || ''
    img_url = Regexp.last_match(2)
    after = Regexp.last_match(3) || ''

    if img_url.match?(%r{\Ahttps?://}) || img_url.start_with?('/assets/')
      match
    else
      lookup = ImageUrlProcessor.manifest_key_for_url(img_url, slug)
      entry = manifest[lookup]
      parsed = ImageUrlProcessor.parse_img_attributes(before, after)
      gallery = "#{before}#{after}".include?('data-image-layout="gallery"')

      if ImageUrlProcessor.derivative_entry?(entry)
        responsive = ImageUrlProcessor.build_responsive_img(prefix, entry, parsed, gallery: gallery)
        if responsive
          Jekyll.logger.debug 'ImageUrlProcessor:', "#{post.url}: #{lookup} -> responsive"
          responsive
        else
          Jekyll.logger.debug 'ImageUrlProcessor:', "#{post.url}: #{lookup} -> plain (incomplete derivatives)"
          ImageUrlProcessor.build_plain_img(prefix, img_url, parsed, gallery: gallery)
        end
      else
        Jekyll.logger.debug 'ImageUrlProcessor:', "#{post.url}: #{lookup || img_url} -> plain"
        ImageUrlProcessor.build_plain_img(prefix, img_url, parsed, gallery: gallery)
      end
    end
  end
end
