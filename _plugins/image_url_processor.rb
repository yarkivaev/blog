# frozen_string_literal: true

require 'json'

module ImageUrlProcessor
  SIZES_ARTICLE = '100vw'
  SIZES_GALLERY = '(max-width: 680px) 100vw, min(100vw, 1900px)'

  module_function

  def post_slug(post)
    base = File.basename(post.path, '.*')
    if base =~ /\A\d{4}-\d{2}-\d{2}-(.+)\z/
      Regexp.last_match(1)
    else
      post.data['slug'] || base
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

  def load_manifest(site_source, slug)
    path = File.join(site_source, 'travel', slug, 'derived', 'manifest.json')
    return {} unless File.file?(path)

    data = JSON.parse(File.read(path))
    data.reject { |key, _| key == 'videos' }
  rescue JSON::ParserError => e
    Jekyll.logger.warn 'ImageUrlProcessor:', "invalid manifest #{path}: #{e.message}"
    {}
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

  def build_responsive_img(prefix, entry, parsed, gallery:)
    variants = entry['variants'] || {}
    lqip = entry['lqip']
    return nil if variants.empty? || lqip.nil?

    srcset = build_srcset(prefix, variants)
    full_src = default_src(prefix, variants)
    lqip_src = variant_url(prefix, lqip['webp'])
    sizes = gallery ? SIZES_GALLERY : SIZES_ARTICLE
    gallery_attr = gallery ? ' data-image-layout="gallery"' : ''
    alt = parsed[:alt] ? %( alt="#{parsed[:alt]}") : ''
    extra_class = parsed[:class] ? " #{parsed[:class]}" : ''
    %(<img class="blur-up#{extra_class}"#{gallery_attr} src="#{lqip_src}" data-src="#{full_src}" data-srcset="#{srcset}" data-sizes="#{sizes}"#{alt} loading="lazy" decoding="async">)
  end
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

  manifest = ImageUrlProcessor.load_manifest(post.site.source, slug)

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

      if entry
        responsive = ImageUrlProcessor.build_responsive_img(prefix, entry, parsed, gallery: gallery)
        if responsive
          Jekyll.logger.debug 'ImageUrlProcessor:', "#{post.url}: #{lookup} -> responsive"
          responsive
        else
          "<img #{before}src=\"#{prefix}#{img_url}\"#{after} loading=\"lazy\" decoding=\"async\">"
        end
      else
        Jekyll.logger.debug 'ImageUrlProcessor:', "#{post.url}: #{img_url} -> #{prefix}#{img_url}"
        "<img #{before}src=\"#{prefix}#{img_url}\"#{after}>"
      end
    end
  end
end
