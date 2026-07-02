# Repetition Algorithm

## Word mode

1. Strip frontmatter.
2. Remove code blocks.
3. Split paragraphs.
4. Tokenize Korean text.
5. Remove stopwords.
6. Count term frequency.
7. Compute distribution buckets.
8. Emit locations and preview snippets.

## Phrase mode

- Generate 2-gram to 5-gram character or token sequences.
- Exclude punctuation-only and too-short phrases.
- Merge near-duplicates if configured.

## Sentence ending mode

Regex examples:

```text
(했다|였다|한다|있었다|없었다|말했다|물었다)[.!?。]?
```

## Judgment

```python
if intentional:
    judgment = "intentional"
elif count >= hard_limit:
    judgment = "overused"
elif count >= soft_limit:
    judgment = "review"
else:
    judgment = "ok"
```
