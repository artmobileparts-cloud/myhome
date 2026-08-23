#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПРОВЕРКА XML-РЕСУРСОВ ANDROID.

Сборка ресурсов падает на мелочах, которые глазом не видны: например, двойной
дефис внутри комментария (а имена дизайн-токенов начинаются именно с него —
«--accent»). Такая опечатка стоит полного круга сборки в CI, поэтому ловим её
здесь, за секунду, до пуша.
"""
import glob
import sys
import xml.dom.minidom

bad = []
files = sorted(glob.glob('android/app/src/main/**/*.xml', recursive=True))

for f in files:
    try:
        xml.dom.minidom.parse(f)
    except Exception as e:
        bad.append((f, e))

for f, e in bad:
    print('СЛОМАН %s: %s' % (f, e), file=sys.stderr)

print('XML проверено: %d, сломано: %d' % (len(files), len(bad)))
sys.exit(1 if bad else 0)
