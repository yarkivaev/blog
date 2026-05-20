# frozen_string_literal: true

require 'fileutils'

module SyncDerivedAssets
  module_function

  def sync_travel_derived(site)
    dest_root = site.dest
    return unless dest_root && File.directory?(dest_root)

    pattern = File.join(site.source, 'travel', '*', 'derived', '**', '*')
    Dir.glob(pattern, File::FNM_DOTMATCH).each do |src|
      next unless File.file?(src)

      rel = src.delete_prefix("#{site.source}/")
      dest = File.join(dest_root, rel)
      src_size = File.size(src)
      if File.file?(dest) && File.size(dest) == src_size && File.mtime(dest) >= File.mtime(src)
        next
      end

      FileUtils.mkdir_p(File.dirname(dest))
      FileUtils.cp(src, dest)
    end
  end
end

Jekyll::Hooks.register :site, :post_write do |site|
  SyncDerivedAssets.sync_travel_derived(site)
end
