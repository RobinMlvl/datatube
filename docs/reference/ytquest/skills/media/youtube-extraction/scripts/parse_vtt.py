#!/usr/bin/env python3
"""Parse YouTube auto-generated VTT into clean timestamped text.

YouTube auto-captions use word-level timing with <c> tags.
Clean text is on 1-frame segments (<0.02s duration).
This parser extracts those, strips HTML, and deduplicates.

Usage: python3 parse_vtt.py input.vtt output.txt
"""

import re
import sys

def parse_vtt(vtt_path, output_path):
    with open(vtt_path) as f:
        vtt = f.read()

    segments = []
    lines = vtt.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i].strip()
        m = re.match(
            r'(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*\d{2}:\d{2}:(\d{2}\.\d{3})',
            line
        )
        if m:
            h, mi, s_start, s_end = (
                int(m.group(1)), int(m.group(2)),
                float(m.group(3)), float(m.group(4))
            )
            # 1-frame segments (<0.02s) contain clean accumulated text
            if s_end - s_start < 0.02:
                ts = f"{h:02d}:{mi:02d}"
                j = i + 1
                while j < len(lines) and not lines[j].strip():
                    j += 1
                if j < len(lines):
                    text = lines[j].strip()
                    # Strip word-level timing tags: <00:00:00.400><c> word</c>
                    text = re.sub(r'<[^>]+>', '', text)
                    # Decode HTML entities
                    text = text.replace('&amp;', '&').replace('&lt;', '<')
                    text = text.replace('&gt;', '>').replace('&quot;', '"')
                    text = text.replace('&#39;', "'")
                    if text.strip() and '-->' not in text:
                        segments.append((ts, text.strip()))
        i += 1

    # Remove consecutive duplicates
    unique = []
    prev = None
    for ts, text in segments:
        if text != prev:
            unique.append(f"[{ts}] {text}")
            prev = text

    with open(output_path, 'w') as f:
        f.write('\n'.join(unique))

    print(f"Parsed {len(unique)} clean segments → {output_path}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} input.vtt output.txt")
        sys.exit(1)
    parse_vtt(sys.argv[1], sys.argv[2])
