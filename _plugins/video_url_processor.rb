# frozen_string_literal: true

require 'json'

module VideoUrlProcessor
  module_function

  def post_slug(post)
    ImageUrlProcessor.post_slug(post)
  end

  def media_prefix(post, storage_prefix, prefixes, slug)
    ImageUrlProcessor.media_prefix(post, storage_prefix, prefixes, slug)
  end

  def load_manifest(site_source, slug)
    path = File.join(site_source, 'travel', slug, 'derived', 'manifest.json')
    return {} unless File.file?(path)

    data = JSON.parse(File.read(path))
    data['videos'] || {}
  rescue JSON::ParserError => e
    Jekyll.logger.warn 'VideoUrlProcessor:', "invalid manifest #{path}: #{e.message}"
    {}
  end

  def hls_key_for_src(src, slug)
    key = src.sub(%r{\A/+}, '').split('?', 2).first
    key.sub(%r{\Atravel/#{Regexp.escape(slug)}/}, '').sub(%r{/master\.m3u8\z}, '')
  end

  def poster_key_for_src(poster, slug)
    key = poster.sub(%r{\A/+}, '').split('?', 2).first
    key.sub(%r{\Atravel/#{Regexp.escape(slug)}/}, '')
  end

  def media_url(prefix, rel_path)
    return rel_path if rel_path.match?(%r{\Ahttps?://})

    "#{prefix}#{rel_path}"
  end

  def image_entry_for(manifest_images, poster_key)
    manifest_images[poster_key]
  end

  def derived_media_path(site_source, slug, rel)
    File.join(site_source, 'travel', slug, rel.sub(%r{\A/?}, ''))
  end

  def derived_file?(site_source, slug, rel)
    path = derived_media_path(site_source, slug, rel)
    File.file?(path)
  end

  def poster_url(prefix, manifest_images, poster_key, site_source, slug)
    entry = image_entry_for(manifest_images, poster_key)
    return nil unless entry

    variants = entry['variants'] || {}
    lqip = entry['lqip']
    unless variants.empty?
      ordered = variants.sort_by { |size, _| size.to_i }
      pair = ordered.find { |size, _| size == '1400' } || ordered.first
      rel = pair.last['webp']
      return media_url(prefix, rel) if derived_file?(site_source, slug, rel)

      return nil
    end
    if lqip
      rel = lqip['webp']
      return media_url(prefix, rel) if derived_file?(site_source, slug, rel)
    end

    nil
  end
end

Jekyll::Hooks.register :posts, :post_render do |post|
  next unless post.url.start_with?('/travel/')
  next unless post.data['storage_prefix']

  storage_prefix = post.data['storage_prefix']
  site_data = post.site.data['site']
  next unless site_data && site_data['image_storage'] && site_data['image_storage']['prefixes']

  prefixes = site_data['image_storage']['prefixes']
  slug = VideoUrlProcessor.post_slug(post)
  prefix = VideoUrlProcessor.media_prefix(post, storage_prefix, prefixes, slug)
  next if prefix.nil?

  manifest_path = File.join(post.site.source, 'travel', slug, 'derived', 'manifest.json')
  manifest_images = {}
  manifest_videos = VideoUrlProcessor.load_manifest(post.site.source, slug)
  if File.file?(manifest_path)
    begin
      manifest_images = JSON.parse(File.read(manifest_path))
      manifest_images = manifest_images.reject { |k, _| k == 'videos' }
    rescue JSON::ParserError
      manifest_images = {}
    end
  end

  html = post.output

  html = html.gsub(/data-hls-src="([^"]+)"/) do
    src = Regexp.last_match(1)
    if src.match?(%r{\Ahttps?://})
      "data-hls-src=\"#{src}\""
    else
      key = VideoUrlProcessor.hls_key_for_src(src, slug)
      entry = manifest_videos[key]
      if entry && entry['master']
        derived = VideoUrlProcessor.media_url(prefix, entry['master'])
        Jekyll.logger.debug 'VideoUrlProcessor:', "#{post.url}: #{key} -> #{derived}"
        "data-hls-src=\"#{derived}\""
      else
        "data-hls-src=\"#{prefix}#{src}\""
      end
    end
  end

  html = html.gsub(/(\bposter=")([^"]+)(")/) do
    before = Regexp.last_match(1)
    poster = Regexp.last_match(2)
    after = Regexp.last_match(3)
    if poster.match?(%r{\Ahttps?://})
      "#{before}#{poster}#{after}"
    else
      key = VideoUrlProcessor.poster_key_for_src(poster, slug)
      derived_poster = VideoUrlProcessor.poster_url(prefix, manifest_images, key, post.site.source, slug)
      if derived_poster
        Jekyll.logger.debug 'VideoUrlProcessor:', "#{post.url}: poster #{key} -> derived"
        "#{before}#{derived_poster}#{after}"
      else
        "#{before}#{prefix}#{poster}#{after}"
      end
    end
  end

  post.output = html
end
