<script lang="ts">
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  export let content = '';
  // Strip YAML frontmatter so it isn't rendered as body prose in the preview.
  $: body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  $: rawHtml = marked.parse(body || '') as string;
  $: html = typeof window !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
</script>

<div class="preview">{@html html}</div>
