# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a modern Jekyll-based travel blog optimized following current best practices:

- **Blog Type**: Travel blog with multi-language content (Russian/Chinese/English)
- **Framework**: Jekyll 4.3+ with comprehensive plugin ecosystem
- **Architecture**: Modular Sass-based design system with component organization
- **Content Structure**: Travel posts organized by destination in `_posts/travel/[city]/`
- **SEO Optimized**: Comprehensive meta tags, structured data, and social media integration
- **Performance**: Compressed assets, optimized images, and efficient caching
- **Security**: Modern security headers, CSP, and HTTPS enforcement

## File Structure

```
blog/
├── _sass/                    # Modular Sass architecture
│   ├── _variables.scss      # Design system variables (colors, fonts, spacing)
│   ├── _mixins.scss         # Reusable mixins (responsive, typography, layout)
│   ├── _base.scss           # Base HTML element styles
│   ├── _posts.scss          # Post-specific styles and metadata
│   ├── _travel-home.scss    # Home page grid layout
│   ├── _images.scss         # Image galleries and responsive handling
│   ├── _archive.scss        # Category/tag archive page styles
│   └── _layouts.scss        # Layout-specific components
├── _data/                   # Structured site data
│   ├── navigation.yml       # Site navigation and destination listings
│   └── site.yml            # Site metadata, features, and statistics
├── _layouts/                # Enhanced page templates
│   ├── base.html           # Base template with SEO optimization
│   ├── post.html           # Travel post with metadata display
│   ├── travel-home.html    # Two-column grid home page
│   ├── page.html           # Static page layout
│   └── default.html        # Default fallback layout
├── _includes/               # Reusable template components
│   ├── head.html           # Enhanced SEO head with security headers
│   ├── disqus_comments.html # Comment system integration
│   └── youtube.html        # YouTube embed helper
├── categories/              # Category archive pages
├── tags/                   # Tag archive pages
└── css/
    └── main.scss           # Single CSS entry point (compiles all Sass)
```

## Design System

### Variables (`_sass/_variables.scss`)
All design tokens are centralized:
```scss
// Colors
$primary-color: #1A1919;       // Main text and borders
$background-color: #FFFFFF;    // Page background
$text-color: #1A1919;         // Body text

// Typography
$font-family-base: 'Inter', 'Helvetica Neue', 'Helvetica', sans-serif;
$font-size-base: 10px;        // Root font size
$font-size-content: 1.7rem;   // Article content
$font-size-mobile-title: 2.7rem; // Mobile title size

// Spacing
$spacing-base: 20px;           // Standard spacing unit
$spacing-small: 16px;          // Mobile spacing
$max-content-width: 700px;     // Content container width

// Breakpoints
$mobile-breakpoint: 680px;     // Mobile/desktop breakpoint
```

### Mixins (`_sass/_mixins.scss`)
Reusable patterns:
```scss
@mixin mobile {
  @media screen and (max-width: $mobile-breakpoint) {
    @content;
  }
}

@mixin centered-content($max-width: $max-content-width) {
  max-width: $max-width;
  margin: 0 auto;
}

@mixin flex-column($gap: $spacing-base) {
  display: flex;
  flex-direction: column;
  gap: $gap;
}
```

## Content Structure

### Enhanced Post Frontmatter
```yaml
---
layout: post
title: "Destination Name (Native Script, Romanization)"
preview: "https://storage.yandexcloud.net/path/to/preview.jpg"
description: "Brief description of the destination"
categories: [travel, country]              # Used for organization
tags: [keyword1, keyword2, feature, type] # Used for discovery
location:                                  # Structured location data
  city: "City Name"
  country: "Country Name"
  coordinates: [latitude, longitude]
lang: ru                                   # Content language (ru/zh/en)
---
```

### Image Handling
- **External Storage**: Yandex Cloud for performance and CDN
- **Local Fallbacks**: `2025/01/12/imgs/` structure for development
- **Link References**: `[description][ref]` and `[ref]: path/to/image.jpg`
- **Horizontal Galleries**: `<div class="horizontal-scroll">` with automatic styling
- **Responsive JavaScript**: Automatic sizing based on aspect ratio
- **Lazy Loading**: Performance optimization with `loading="lazy"`

### Gallery Syntax
```markdown
## Regular Images
![Description][image-ref]

## Horizontal Scroll Gallery
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

## Key Features

### SEO & Performance
- **jekyll-seo-tag**: Automatic meta tags and structured data
- **jekyll-sitemap**: XML sitemap generation
- **jekyll-feed**: RSS feed for content syndication
- **Sass compilation**: Compressed CSS with design system
- **HTML compression**: Minified output for faster loading
- **Security headers**: CSP, X-Frame-Options, XSS protection

### Taxonomy System
- **Categories**: Broad classification (travel, country)
- **Tags**: Specific features and keywords
- **Archive Pages**: `/categories/` and `/tags/` with post listings
- **Automatic Linking**: Category and tag links in post metadata

### Responsive Design
- **Mobile-first**: Optimized for all screen sizes
- **Touch-friendly**: Optimized interactions for mobile
- **Image Optimization**: JavaScript handles responsive image sizing
- **Gallery Scrolling**: Horizontal scroll on mobile, grid on desktop

## Development Workflow

### Local Development
```bash
# Set Ruby gem environment
export GEM_HOME=$HOME/.gem

# Install dependencies
bundle install

# Start development server with live reload
bundle exec jekyll serve --livereload

# Build for production
bundle exec jekyll build
```

### Making Style Changes
1. **Global Changes**: Edit `_sass/_variables.scss`
2. **Component Changes**: Edit specific `_sass/_component.scss` files
3. **New Components**: Add new files to `_sass/` and import in `css/main.scss`
4. **Jekyll automatically recompiles** Sass to CSS

### Adding Content
1. **New Posts**: Create in `_posts/travel/[destination]/YYYY-MM-DD-destination.md`
2. **Categories/Tags**: Add to frontmatter, archive pages update automatically
3. **Navigation**: Update `_data/navigation.yml` for new destinations
4. **Images**: Upload to Yandex Cloud or use local fallback structure

### Performance Testing
```bash
# Build and serve production version locally
JEKYLL_ENV=production bundle exec jekyll build
bundle exec jekyll serve --skip-initial-build
```

## Configuration

### Site Settings (`_config.yml`)
Key sections:
- **SEO**: Author info, social links, analytics
- **Performance**: Sass compilation, HTML compression
- **Plugins**: Essential Jekyll plugins for modern features
- **Security**: HTTPS enforcement, security headers
- **Pagination**: 5 posts per page with `/page:num/` URLs

### Navigation (`_data/navigation.yml`)
- **Main Menu**: Top-level navigation links
- **Social Links**: GitHub, email, social media
- **Destinations**: Travel destination metadata with featured status

## Image Management

### JavaScript Optimization (`_layouts/post.html`)
```javascript
// Automatic image sizing and optimization
Array.from(document.getElementsByTagName("img")).forEach(function(img) {
  let p = img.parentNode;
  p.className = "figure";
  img.loading = "lazy";
  img.style.maxWidth = '700px';
  img.style.width = '100%';

  img.onload = function() {
    if (img.clientHeight > img.clientWidth) {
      // Vertical images get fixed width
      img.style.width = '700px';
      img.style.aspectRatio = 'auto 700 / 1050';
    }
  }
});
```

### Gallery Styles (`_sass/_images.scss`)
- **Horizontal Scroll**: Smooth scrolling with gap spacing
- **Responsive Images**: Max height 95vh, auto width
- **Object Fit**: `contain` to preserve aspect ratios
- **Border Radius**: 8px for modern appearance

## Security & Performance

### Security Headers (`_includes/head.html`)
- **Content Security Policy**: Prevents XSS attacks
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **HTTPS Enforcement**: Redirects HTTP to HTTPS

### Performance Optimizations
- **Font Preloading**: Critical fonts loaded early
- **CSS Compression**: Minified Sass output
- **HTML Compression**: Whitespace and comment removal
- **Image Lazy Loading**: Deferred image loading
- **Single CSS File**: Reduced HTTP requests

## Deployment

### GitHub Pages
```bash
# Deploy using jgd gem
bundle exec jgd
```

### Custom Domain
- **Domain**: `2xiaomao.ru`
- **HTTPS**: Enforced via configuration
- **CDN**: Yandex Cloud for image delivery

## Troubleshooting

### Common Issues
1. **Bundle Install Errors**: Ensure `export GEM_HOME=$HOME/.gem`
2. **Sass Compilation**: Check `_sass/` file syntax and imports
3. **Build Failures**: Run `bundle exec jekyll doctor` for diagnostics
4. **Image Loading**: Verify Yandex Cloud URLs and local fallbacks

### Development Tools
- **Jekyll Doctor**: `bundle exec jekyll doctor` - Checks for common issues
- **Sass Debugging**: Use `--verbose` flag for detailed compilation info
- **Live Reload**: `--livereload` for automatic browser refresh during development

## Best Practices

### Code Organization
- **One concern per file**: Each Sass file handles specific functionality
- **Design system**: Use variables and mixins consistently
- **Component-based**: Organize styles by component, not page
- **Mobile-first**: Write responsive styles from mobile up

### Content Guidelines
- **Consistent frontmatter**: Use all required fields for SEO
- **Descriptive images**: Include alt text via image descriptions
- **Structured content**: Use headings, lists, and galleries appropriately
- **Performance**: Optimize images before upload to Yandex Cloud

### Maintenance
- **Regular updates**: Keep Jekyll and gems updated
- **Security monitoring**: Check for security vulnerabilities
- **Performance testing**: Monitor Core Web Vitals and loading times
- **Content backup**: Ensure Yandex Cloud images are backed up