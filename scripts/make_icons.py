"""Vẽ icon PNG (giống icons/icon.svg) bằng thư viện chuẩn – không cần Pillow."""
import struct, zlib, sys, os

def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def inside_rr(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1: return False
    cx = min(max(x, x0 + r), x1 - r); cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def render(n):
    s = n / 128.0
    shapes = [  # (x0,y0,x1,y1,r,color) trong hệ 128
        (30, 34, 98, 94, 8, (255, 255, 255)),
        (38, 46, 90, 53, 3.5, (79, 70, 229)),
        (38, 60, 76, 66, 3, (199, 196, 247)),
        (38, 72, 82, 78, 3, (199, 196, 247)),
    ]
    SS = 4  # khử răng cưa
    px = []
    for y in range(n):
        for x in range(n):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    X = (x + (sx + .5) / SS) / s; Y = (y + (sy + .5) / SS) / s
                    if not inside_rr(X, Y, 0, 0, 128, 128, 28): continue
                    t = (X + Y) / 256
                    col = (int(79 + (14 - 79) * t), int(70 + (165 - 70) * t), int(229 + (164 - 229) * t))
                    for x0, y0, x1, y1, r, c in shapes:
                        if inside_rr(X, Y, x0, y0, x1, y1, r): col = c
                    acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255
            k = SS * SS
            a = acc[3] // k
            px += [acc[0] // max(1, acc[3] // 255), acc[1] // max(1, acc[3] // 255), acc[2] // max(1, acc[3] // 255), a] if a else [0, 0, 0, 0]
    return px

out = sys.argv[1]
for n in map(int, sys.argv[2:]):
    png(os.path.join(out, f'icon-{n}.png'), n, n, render(n))
    print('icon', n)
