---
layout: default
title: Home
---
<section class="home-intro">
  <p class="home-eyebrow">ROLOGS</p>
  <h1 class="home-title">A personal log about ideas, notes, and experiments.</h1>
  <p class="home-description">
    This is the main feed of the site. New writing appears here first, and the full history lives in the archive.
  </p>
  <div class="home-actions">
    <a class="home-button" href="{{ '/archive/' | relative_url }}">Browse archive</a>
    <a class="home-link" href="{{ '/feed.xml' | relative_url }}">RSS feed</a>
  </div>
</section>

<section class="home-posts">
  <h2 class="home-section-title">Latest posts</h2>
  {%- if site.posts and site.posts.size > 0 -%}
    <ul class="home-post-list">
      {%- for post in site.posts limit: 8 -%}
        <li class="home-post-card">
          <h3 class="home-post-title">
            <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
          </h3>
          <p class="home-post-meta">{{ post.date | date: "%B %-d, %Y" }}</p>
          {%- if post.excerpt -%}
            <p class="home-post-excerpt">{{ post.excerpt | strip_html | truncate: 170 }}</p>
          {%- endif -%}
        </li>
      {%- endfor -%}
    </ul>
  {%- else -%}
    <p class="home-empty-state">No posts published yet.</p>
  {%- endif -%}
</section>
