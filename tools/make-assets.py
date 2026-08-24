#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ГЕНЕРАТОР ЗНАЧКОВ ПРИЛОЖЕНИЯ.

В сборочном окружении нет ни ImageMagick, ни Pillow, а тянуть их ради пяти
картинок незачем: значок — это домик из трёх фигур на фирменном фоне.
Пишем PNG руками (zlib + struct) и рисуем со сглаживанием через 4-кратную
передискретизацию. Скрипт идемпотентный: запустил — перезаписал всё заново.

Цвета сняты с живого экрана приложения, а не из :root прототипа: TOK
накладывает оверрайды на .screen, и в :root лежат совсем другие значения.
Знак дома — коралловый, как логотип внутри приложения; фон — #EDEDF3, тот
же, что у экрана. Иначе заставка мигнёт одним цветом, а приложение
откроется другим.
"""
import os
import struct
import zlib

ACCENT = (0xFF, 0x6A, 0x4D)      # знак дома — такой же, как внутри приложения
SURFACE = (0xFF, 0xFF, 0xFF)
BG = (0xED, 0xED, 0xF3)          # фон экрана приложения после applyTok()

SS = 4  # передискретизация: рисуем в 4 раза крупнее и усредняем


def write_png(path, w, h, pixels):
    """pixels — плоский bytearray RGBA длиной w*h*4."""
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # фильтр строки: none
        raw += pixels[y * w * 4:(y + 1) * w * 4]

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)


class Canvas:
    """Холст RGBA в увеличенном масштабе; координаты фигур — доли от 0 до 1."""

    def __init__(self, size):
        self.n = size * SS
        self.buf = bytearray(self.n * self.n * 4)

    def _blend(self, x, y, color):
        i = (y * self.n + x) * 4
        self.buf[i:i + 4] = bytes((color[0], color[1], color[2], 255))

    def fill(self, color):
        row = bytes((color[0], color[1], color[2], 255)) * self.n
        for y in range(self.n):
            self.buf[y * self.n * 4:(y + 1) * self.n * 4] = row

    def rounded_rect(self, x0, y0, x1, y1, r, color):
        n = self.n
        X0, Y0, X1, Y1 = x0 * n, y0 * n, x1 * n, y1 * n
        R = r * n
        for y in range(max(0, int(Y0)), min(n, int(Y1) + 1)):
            for x in range(max(0, int(X0)), min(n, int(X1) + 1)):
                cx = min(max(x + .5, X0 + R), X1 - R)
                cy = min(max(y + .5, Y0 + R), Y1 - R)
                dx, dy = x + .5 - cx, y + .5 - cy
                if dx * dx + dy * dy <= R * R + 1e-9:
                    self._blend(x, y, color)

    def circle(self, cx, cy, r, color):
        n = self.n
        CX, CY, R = cx * n, cy * n, r * n
        for y in range(max(0, int(CY - R)), min(n, int(CY + R) + 1)):
            for x in range(max(0, int(CX - R)), min(n, int(CX + R) + 1)):
                dx, dy = x + .5 - CX, y + .5 - CY
                if dx * dx + dy * dy <= R * R:
                    self._blend(x, y, color)

    def polygon(self, pts, color):
        n = self.n
        P = [(px * n, py * n) for px, py in pts]
        ys = [p[1] for p in P]
        for y in range(max(0, int(min(ys))), min(n, int(max(ys)) + 1)):
            yc = y + .5
            xs = []
            for i in range(len(P)):
                ax, ay = P[i]
                bx, by = P[(i + 1) % len(P)]
                if (ay <= yc < by) or (by <= yc < ay):
                    xs.append(ax + (yc - ay) * (bx - ax) / (by - ay))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(max(0, int(xs[i])), min(n, int(xs[i + 1]) + 1)):
                    if xs[i] <= x + .5 <= xs[i + 1]:
                        self._blend(x, y, color)

    def downsample(self, size):
        """Усреднение блоков SS×SS — отсюда берутся мягкие края."""
        out = bytearray(size * size * 4)
        n, s2 = self.n, SS * SS
        for y in range(size):
            for x in range(size):
                r = g = b = a = 0
                for dy in range(SS):
                    base = ((y * SS + dy) * n + x * SS) * 4
                    for dx in range(SS):
                        i = base + dx * 4
                        r += self.buf[i]; g += self.buf[i + 1]
                        b += self.buf[i + 2]; a += self.buf[i + 3]
                o = (y * size + x) * 4
                out[o] = r // s2; out[o + 1] = g // s2
                out[o + 2] = b // s2; out[o + 3] = a // s2
        return out


def house(c, scale, cx=.5, cy=.5, color=ACCENT):
    """Домик: крыша-треугольник, корпус и вырезанная дверь."""
    def px(v): return cx + (v - .5) * scale
    def py(v): return cy + (v - .5) * scale

    c.polygon([(px(.5), py(.14)), (px(.94), py(.52)), (px(.06), py(.52))], color)
    c.rounded_rect(px(.19), py(.46), px(.81), py(.88), .05 * scale, color)
    # дверь — «дыра» цвета фона под домиком
    return px, py


def make_icon(size, shape):
    """shape: 'square' — фон скруглённым квадратом, 'round' — кругом,
       'fg' — только домик на прозрачном (передний слой адаптивного значка)."""
    c = Canvas(size)
    if shape == 'square':
        c.rounded_rect(.02, .02, .98, .98, .22, SURFACE)
        scale, door = .62, SURFACE
    elif shape == 'round':
        c.circle(.5, .5, .49, SURFACE)
        scale, door = .58, SURFACE
    else:
        scale, door = .40, None  # безопасная зона адаптивного значка — центр 66%

    px, py = house(c, scale)
    if door is None:
        # на прозрачном слое дверь вырезать нечем — рисуем её белой
        door = SURFACE
    c.rounded_rect(px(.41), py(.60), px(.59), py(.88), .03 * scale, door)
    return c.downsample(size)


DENSITIES = [('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)]
RES = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')


def main():
    for name, mult in DENSITIES:
        d = os.path.join(RES, 'mipmap-' + name)
        for fname, shape, dp in (('ic_launcher.png', 'square', 48),
                                 ('ic_launcher_round.png', 'round', 48),
                                 ('ic_launcher_foreground.png', 'fg', 108)):
            size = int(dp * mult)
            write_png(os.path.join(d, fname), size, size, make_icon(size, shape))
            print('%-28s %s %dx%d' % (fname, name, size, size))


if __name__ == '__main__':
    main()
