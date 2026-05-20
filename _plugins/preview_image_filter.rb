# frozen_string_literal: true

module PreviewImageFilter
  def preview_responsive(post, alt = nil)
    site = @context.registers[:site]
    html = ImageUrlProcessor.preview_responsive_img(post, site, alt: alt)
    return '' if html.nil? || html.empty?

    html
  end

  def preview_absolute_url(post)
    site = @context.registers[:site]
    url = ImageUrlProcessor.preview_absolute_url(post, site)
    return '' if url.nil? || url.empty?

    url
  end

end

Liquid::Template.register_filter(PreviewImageFilter)
