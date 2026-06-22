#!/usr/bin/env python3
"""Generate Show Up PWA icons (no external deps).

Draws a full-bleed dark-teal square with a bold white checkmark — "showing up".
iOS applies its own rounded mask to apple-touch-icon, so full-bleed is correct.
"""
import struct, zlib, math

# Brand colors
BG_TOP = (29, 47, 43)      # deep teal-charcoal
BG_BOT = (45, 106, 90)     # accent green
MARK = (122, 224, 191)     # bright mint check


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def dist_to_seg(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def make_png(size, path):
    s = size
    # checkmark geometry scaled to size
    p1 = (s * 0.30, s * 0.53)
    p2 = (s * 0.44, s * 0.68)
    p3 = (s * 0.72, s * 0.34)
    stroke = s * 0.072

    raw = bytearray()
    for y in range(s):
        raw.append(0)  # filter type 0 per scanline
        t_bg = y / (s - 1)
        bg = lerp(BG_TOP, BG_BOT, t_bg)
        for x in range(s):
            d = min(
                dist_to_seg(x + 0.5, y + 0.5, p1[0], p1[1], p2[0], p2[1]),
                dist_to_seg(x + 0.5, y + 0.5, p2[0], p2[1], p3[0], p3[1]),
            )
            # anti-aliased edge over ~1.5px
            a = max(0.0, min(1.0, (stroke - d) / 1.5 + 0.5))
            r = round(bg[0] + (MARK[0] - bg[0]) * a)
            g = round(bg[1] + (MARK[1] - bg[1]) * a)
            b = round(bg[2] + (MARK[2] - bg[2]) * a)
            raw += bytes((r, g, b))

    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", s, s, 8, 2, 0, 0, 0)  # 8-bit RGB
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, s)


for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    make_png(size, name)
