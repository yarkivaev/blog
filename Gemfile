source "https://rubygems.org"

gem "jekyll", "~> 4.3.4"

# Plugins
group :jekyll_plugins do
  gem "jekyll-feed", "~> 0.17"
  gem "jekyll-sitemap", "~> 1.4"
  gem "jekyll-seo-tag", "~> 2.8"
  gem "jekyll-paginate", "~> 1.1"
  gem "jekyll-gist", "~> 1.5"
  gem "jekyll-github-metadata", "~> 2.16"
  gem "jekyll-responsive-image", "~> 1.6"
  gem "jekyll-minifier", "~> 0.1"
end

# Performance and optimization
gem "sassc", "~> 2.4"
gem "image_optim", "~> 0.31"
gem "image_optim_pack", "~> 0.10"

# Development and deployment
gem "jgd", "~> 1.14"
gem "json", "~> 2.7"

# Platform-specific gems
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]

# Development tools
group :development do
  gem "jekyll-admin", "~> 0.11"
  gem "jekyll-compose", "~> 0.12"
end
