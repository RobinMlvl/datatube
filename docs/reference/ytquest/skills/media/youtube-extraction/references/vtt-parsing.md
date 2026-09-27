# VTT Parser for YouTube Auto-Generated Captions

## Format

YouTube auto-captions use word-level timing tags:
```
00:00:01.950 --> 00:00:01.960 align:start position:0%
This mission control dashboard is

00:00:01.960 --> 00:00:04.270 align:start position:0%
This mission control dashboard is
watching<00:00:02.560><c> five</c><00:00:03.080><c> agents</c>
```

## Strategy

The **clean text** is on 1-frame segments (duration < 0.02s).
These segments have the **accumulated** full text without word-level timing tags.

## Parser (Python)

```python
import re

with open('transcript.en.vtt') as f:
    vtt = f.read()

segments = []
lines = vtt.split('\n')
i = 0

while i < len(lines):
    line = lines[i].strip()
    m = re.match(r'(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*\d{2}:\d{2}:(\d{2}\.\d{3})', line)
    if m:
        h, mi, s_start, s_end = int(m.group(1)), int(m.group(2)), float(m.group(3)), float(m.group(4))
        # 1-frame segments = clean text
        if s_end - s_start < 0.02:
            ts = f"{h:02d}:{mi:02d}"
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                text = lines[j].strip()
                text = re.sub(r'<[^>]+>', '', text)
                text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                if text.strip():
                    segments.append((ts, text))
    i += 1

# Deduplicate consecutive identical segments
unique = []
prev = None
for ts, text in segments:
    if text != prev:
        unique.append(f"[{ts}] {text}")
        prev = text

with open('transcript_clean.txt', 'w') as f:
    f.write('\n'.join(unique))
```

## Edge cases

- Segments with raw timestamp lines (parser didn't match): skip
- Empty `textContent` after stripping tags: skip
- `[music]` tags: keep as-is, they indicate background music
- Segments spanning multiple lines in the VTT: the 1-frame trick naturally handles this because each line segment has its own timestamp block
