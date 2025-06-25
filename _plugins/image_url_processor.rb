Jekyll::Hooks.register :posts, :post_render do |post|
  # Only process travel posts that have storage_prefix
  if post.url.start_with?('/travel/') && post.data['storage_prefix']
    
    storage_prefix = post.data['storage_prefix']
    site_data = post.site.data['site']
    
    if site_data && site_data['image_storage'] && site_data['image_storage']['prefixes']
      prefixes = site_data['image_storage']['prefixes']
      
      if prefixes[storage_prefix] && !prefixes[storage_prefix].empty?
        prefix = prefixes[storage_prefix].gsub(':slug', post.data['slug'] || '')
        
        # Process HTML content
        post.output = post.output.gsub(/<img\s+([^>]*\s+)?src="([^"]+)"([^>]*)>/i) do |match|
          before = $1 || ''
          img_url = $2
          after = $3 || ''
          
          # Skip if already absolute URL or assets
          if img_url.match?(/^https?:\/\//) || img_url.start_with?('/assets/')
            match
          else
            # Keep the full path, don't strip subdirectories
            # This preserves paths like "08/DSC_0972.JPG"
            new_url = prefix + img_url
            
            puts "Processing image in #{post.url}: #{img_url} -> #{new_url}"
            
            "<img #{before}src=\"#{new_url}\"#{after}>"
          end
        end
      end
    end
  end
end