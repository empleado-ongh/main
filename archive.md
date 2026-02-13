---
layout: page
title: Archive
permalink: /archive/
---

{%- if site.posts and site.posts.size > 0 -%}
  <ul class="archive-list">
    {%- for post in site.posts -%}
      <li class="archive-item">
        <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
        <span class="archive-date">{{ post.date | date: "%Y-%m-%d" }}</span>
      </li>
    {%- endfor -%}
  </ul>
{%- else -%}
  <p>No posts published yet.</p>
{%- endif -%}
