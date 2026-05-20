# XiongXiaomao Travel Blog

A modern Jekyll-based travel blog documenting adventures around the world. 一边 программируем 一边 путешествуем - Programming while traveling.

## 🌟 Features

- **Modern Jekyll Architecture** - Optimized for performance and maintainability
- **Multi-language Content** - Support for Russian, Chinese, and English posts
- **Responsive Design** - Optimized for all devices and screen sizes
- **SEO Optimized** - Comprehensive meta tags, structured data, and social media integration
- **Fast Loading** - Compressed assets, optimized images, and efficient caching
- **Travel-focused** - Custom layouts for travel posts with image galleries and optional HLS video (see `CLAUDE.md`)
- **Taxonomy System** - Organized by categories and tags with archive pages
- **Security Enhanced** - Modern security headers and HTTPS enforcement

## 🚀 Quick Start

### Prerequisites

- Ruby 3.0+ 
- Bundler gem
- Jekyll 4.3+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/catdog905/blog.git
   cd blog
   ```

2. **Set up Ruby gem environment**
   ```bash
   export GEM_HOME=$HOME/.gem
   ```

3. **Install dependencies**
   ```bash
   bundle install
   ```

4. **Start local development server**
   ```bash
   bundle exec jekyll serve
   ```

5. **Visit your site**
   ```
   http://localhost:4000
   ```

### Production Build

```bash
bundle exec jekyll build
```

Built site will be in the `_site` directory.

## 📁 Project Structure

```
blog/
├── _sass/                    # Modular Sass architecture
│   ├── _variables.scss      # Design system variables
│   ├── _mixins.scss         # Reusable mixins
│   ├── _base.scss           # Base HTML styles
│   ├── _posts.scss          # Post-specific styles
│   ├── _travel-home.scss    # Home page styles
│   ├── _images.scss         # Image galleries & handling
│   ├── _archive.scss        # Category/tag archive pages
│   └── _layouts.scss        # Layout-specific styles
├── _data/                   # Structured site data
│   ├── navigation.yml       # Site navigation structure
│   └── site.yml            # Site metadata and settings
├── _includes/               # Reusable template parts
│   ├── head.html           # Enhanced SEO head section
│   ├── disqus_comments.html # Comment system
│   └── youtube.html        # YouTube embed helper
├── _layouts/                # Page templates
│   ├── base.html           # Base template with compression
│   ├── post.html           # Travel post layout
│   ├── travel-home.html    # Home page layout
│   ├── page.html           # Static page layout
│   └── default.html        # Default layout
├── _posts/travel/           # Travel blog posts
│   ├── beijing/
│   ├── chengdu/
│   ├── zhangjiajie/
│   └── ...                 # Organized by destination
├── categories/              # Category archive pages
├── tags/                   # Tag archive pages
├── css/
│   └── main.scss           # Single CSS entry point
├── utils/
│   ├── list-post-media.sh              # List media paths referenced by a post
│   ├── process-post-images.sh          # WebP derivatives + LQIP + manifest.json
│   ├── process-post-videos.sh          # Adaptive HLS into derived/ (no upscale)
│   └── download_photos.sh              # Image management utility
├── _config.yml             # Jekyll configuration
├── Gemfile                 # Ruby dependencies
├── CLAUDE.md              # AI assistant instructions
├── OPTIMIZATION.md        # Technical documentation
└── README.md              # This file
```

## ✍️ Writing Posts

### Creating a New Travel Post

1. **Create post file**
   ```bash
   # Format: YYYY-MM-DD-destination.md
   _posts/travel/paris/2024-03-15-paris.md
   ```

2. **Add frontmatter**
   ```yaml
   ---
   layout: post
   title: "Paris Adventure"
   preview: "https://storage.yandexcloud.net/path/to/preview.jpg"
   description: "Exploring the City of Light"
   categories: [travel, europe]
   tags: [paris, france, museums, food, architecture]
   location:
     city: "Paris"
     country: "France"
     coordinates: [48.8566, 2.3522]
   lang: en
   ---
   ```

3. **Write content with images**
   ```markdown
   Your travel story here...

   ![Image description][image-ref]

   ## Horizontal Gallery
   <div class="horizontal-scroll">
     ![Gallery image 1][img1]
     ![Gallery image 2][img2]
     ![Gallery image 3][img3]
   </div>

   [image-ref]: /path/to/image.jpg
   [img1]: /path/to/gallery1.jpg
   [img2]: /path/to/gallery2.jpg
   [img3]: /path/to/gallery3.jpg
   ```

### Image Management

- **External hosting** via Yandex Cloud for performance
- **Local fallbacks** supported in `2025/01/12/imgs/` structure
- **Automatic optimization** via JavaScript for responsive display
- **Lazy loading** enabled for better performance
- **Horizontal galleries** with smooth scrolling

### Supported Languages

- **Russian (ru)** - Primary language for travel content
- **Chinese (zh)** - For China-focused posts
- **English (en)** - International audience

## 🎨 Customization

### Design System

All colors, fonts, and spacing are controlled via Sass variables in `_sass/_variables.scss`:

```scss
// Colors
$primary-color: #1A1919;
$background-color: #FFFFFF;
$text-color: #1A1919;

// Typography
$font-family-base: 'Inter', 'Helvetica Neue', 'Helvetica', sans-serif;
$font-size-base: 10px;
$font-size-content: 1.7rem;

// Spacing
$spacing-base: 20px;
$max-content-width: 700px;

// Breakpoints
$mobile-breakpoint: 680px;
```

### Adding New Features

The modular Sass architecture makes it easy to:
- Add new color schemes
- Implement dark mode
- Create new layout components
- Extend responsive behavior

## 🔧 Configuration

### Site Settings (`_config.yml`)

Key configuration options:

```yaml
# Basic settings
title: "XiongXiaomao blog"
description: "Travel blog documenting adventures around the world"
url: "https://2xiaomao.ru"

# SEO and social
author:
  name: "Yaroslav Kivaev"
  github: "yarkivaev"

# Content
paginate: 5
show_excerpts: true

# Performance
sass:
  style: compressed
compress_html:
  clippings: all
```

### Navigation (`_data/navigation.yml`)

Customize site navigation and destination listings:

```yaml
main:
  - title: "Home"
    url: /
  - title: "Categories"
    url: /categories/
  - title: "Tags"
    url: /tags/

destinations:
  - name: "Beijing"
    slug: "beijing"
    country: "China"
    featured: true
```

## 🚀 Performance Features

- **Sass compilation** with compression
- **HTML minification** removes whitespace
- **Image optimization** with lazy loading
- **Font preloading** for faster text rendering
- **Single CSS file** reduces HTTP requests
- **Gzip compression** ready for production

## 🔒 Security Features

- **Content Security Policy** prevents XSS attacks
- **Security headers** protect against common vulnerabilities
- **HTTPS enforcement** ensures secure connections
- **Input sanitization** via Jekyll's built-in protections

## 📈 SEO Features

- **Automatic meta tags** via jekyll-seo-tag
- **XML sitemap** generation
- **RSS feed** for content syndication
- **Structured data** for rich search results
- **Social media optimization** (Open Graph, Twitter Cards)
- **Canonical URLs** prevent duplicate content issues

## 🔗 Integrations

- **Disqus Comments** - Configured for `xiaomao-blog`
- **Google Analytics** - Ready for tracking ID
- **GitHub Integration** - Automatic metadata
- **Social Sharing** - Optimized for all major platforms

## 📱 Responsive Design

- **Mobile-first** approach with progressive enhancement
- **Flexible grid** system for different screen sizes
- **Touch-optimized** interactions for mobile devices
- **Fast loading** on slow connections

## 🛠️ Development

### Local Development

```bash
# Start with live reload
bundle exec jekyll serve --livereload

# Build for production
bundle exec jekyll build

# Check for issues
bundle exec jekyll doctor
```

### Image Management

Requires GNU bash 5 and ImageMagick (`brew install bash imagemagick`). Scripts use `/opt/homebrew/bin/bash`.

```bash
export PATH="/opt/homebrew/bin:$PATH"

# Download images from Yandex Cloud
./utils/download_photos.sh

# List all local media for a travel post (images + expanded HLS trees)
./utils/list-post-media.sh --check _posts/travel/italy/2026-04-10-italy.md

# Generate WebP 1400/2400 + LQIP blur placeholders → travel/<slug>/derived/ (gitignored)
./utils/list-post-media.sh _posts/travel/italy/2026-04-10-italy.md \
  | ./utils/process-post-images.sh --post _posts/travel/italy/2026-04-10-italy.md

# Only a subdir or single file (relative to travel/<slug>/)
./utils/list-post-media.sh --prefix rome/from_kate _posts/travel/italy/2026-04-10-italy.md \
  | ./utils/process-post-images.sh --post _posts/travel/italy/2026-04-10-italy.md
./utils/list-post-media.sh --prefix rome/from_kate/19.jpg _posts/travel/italy/2026-04-10-italy.md \
  | ./utils/process-post-images.sh --post _posts/travel/italy/2026-04-10-italy.md

./utils/list-post-media.sh _posts/travel/italy/2026-04-10-italy.md \
  | ./utils/process-post-videos.sh --post _posts/travel/italy/2026-04-10-italy.md

bundle exec jekyll build

# Upload travel/<slug>/ (originals + derived/) to Yandex Object Storage (AWS CLI + credentials)
aws s3 sync travel/italy/ s3://yarkivaev-blog/italy/ \
  --endpoint-url=https://storage.yandexcloud.net \
  --exclude ".DS_Store"
```

**CORS** (required for HLS via hls.js from `localhost:4000` or `2xiaomao.ru`): apply `config/yandex-bucket-cors.json` on bucket `yarkivaev-blog` in the Yandex Cloud console (bucket → Security → CORS), or via `aws s3api put-bucket-cors --bucket yarkivaev-blog --cors-configuration file://config/yandex-bucket-cors.json --endpoint-url=https://storage.yandexcloud.net`.

`travel/<slug>/derived/manifest.json` drives responsive `<img>` output (srcset, LQIP, lazy) via `_plugins/image_url_processor.rb`. Upload it with `aws s3 sync` to `italy/derived/manifest.json` on the bucket. With `storage_prefix: "yandex"`, Jekyll fetches that file from Object Storage at build time (falls back to the local copy if the download fails). Video `{% include video.html %}` paths still need full cloud URLs unless you extend the Jekyll plugin.

### Deployment

The site is configured for GitHub Pages deployment using the `jgd` gem:

```bash
# Deploy to GitHub Pages
bundle exec jgd
```

## 📚 Documentation

- **[OPTIMIZATION.md](OPTIMIZATION.md)** - Detailed technical documentation
- **[CLAUDE.md](CLAUDE.md)** - AI assistant development guidelines
- **Jekyll Documentation** - https://jekyllrb.com/docs/

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `bundle exec jekyll serve`
5. Submit a pull request

## 📄 License

This project is open source. Feel free to use it as inspiration for your own travel blog.

## 🌐 Live Site

Visit the live blog at: **https://2xiaomao.ru**

---

*Built with ❤️ using Jekyll and modern web technologies*