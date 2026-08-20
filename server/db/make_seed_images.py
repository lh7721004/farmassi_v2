"""더미 농가/상품 이미지 생성.

사진을 구할 수 없으니 색과 글자로 알아볼 수 있게만 만든다.
실제 사진이 준비되면 같은 경로에 덮어쓰면 된다.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
OUT = Path('/opt/homebrew/var/www/shop-uploads')

HANEUL = 'b0000000-0000-4000-8000-000000000001'
BARAM = 'b0000000-0000-4000-8000-000000000002'


def font(size, index=0):
    return ImageFont.truetype(FONT, size, index=index)


def gradient(size, top, bottom):
    w, h = size
    img = Image.new('RGB', size)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        draw.line([(0, y), (w, y)],
                  fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def speckle(img, color, count, radius_range):
    """과수원 느낌의 점들. 사진 대용이라 정확할 필요는 없고 단조로움만 깬다."""
    draw = ImageDraw.Draw(img, 'RGBA')
    w, h = img.size
    rnd = 0
    for i in range(count):
        rnd = (rnd * 1103515245 + 12345 + i * 7919) % 2147483648
        x = rnd % w
        rnd = (rnd * 1103515245 + 12345) % 2147483648
        y = rnd % h
        rnd = (rnd * 1103515245 + 12345) % 2147483648
        r = radius_range[0] + rnd % max(radius_range[1] - radius_range[0], 1)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)
    return img


def make(path, size, top, bottom, title, subtitle, dot=None):
    img = gradient(size, top, bottom)
    if dot:
        img = speckle(img, dot, 60, (10, 46))
    draw = ImageDraw.Draw(img)
    w, h = size

    # 아래쪽을 어둡게 깔아 글자가 읽히게
    overlay = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rectangle([0, int(h * 0.55), w, h], fill=(0, 0, 0, 90))
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(img)

    big, small = font(int(h * 0.085)), font(int(h * 0.05))
    draw.text((int(w * 0.06), int(h * 0.70)), title, font=big, fill=(255, 255, 255))
    draw.text((int(w * 0.06), int(h * 0.70) + int(h * 0.10)), subtitle, font=small,
              fill=(255, 255, 255, 220))

    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'JPEG', quality=88)
    return path


APPLE = ((214, 92, 76), (120, 36, 40))
ORCHARD = ((122, 158, 92), (44, 74, 46))
SWEET = ((196, 124, 86), (104, 58, 44))
FIELD = ((150, 168, 106), (58, 82, 54))

jobs = [
    (HANEUL, 'landing-1.jpg', (1200, 800), ORCHARD, '해발 400m 청송 과수원', '일교차 15도가 만드는 단단함', (255, 90, 70, 70)),
    (HANEUL, 'landing-2.jpg', (1200, 800), APPLE, '한 알씩 손으로 확인합니다', '당도계로 재고 14brix 미만은 뺍니다', None),
    (HANEUL, 'landing-3.jpg', (1200, 800), ORCHARD, '주문 받은 다음날 땁니다', '창고에 쌓아두지 않습니다', (255, 120, 80, 60)),
    (HANEUL, 'landing-4.jpg', (1200, 800), APPLE, '흠집 난 것은 따로 팝니다', '맛은 같고 값은 낮게', None),
    (HANEUL, 'product-apple-5kg.jpg', (900, 900), APPLE, '꿀사과 5kg', '13~15과', None),
    (HANEUL, 'product-apple-10kg.jpg', (900, 900), APPLE, '꿀사과 10kg', '26~30과', None),
    (HANEUL, 'product-apple-ugly.jpg', (900, 900), ORCHARD, '못난이 사과 5kg', '주스·잼용', None),
    (HANEUL, 'product-plum.jpg', (900, 900), ((146, 96, 150), (66, 40, 78)), '햇자두 3kg', '7월 한정', None),
    (BARAM, 'landing-1.jpg', (1200, 800), FIELD, '해남 황토밭', '바닷바람 맞고 자랍니다', (200, 150, 90, 70)),
    (BARAM, 'landing-2.jpg', (1200, 800), SWEET, '캐고 나서 30일 숙성', '전분이 당으로 바뀌는 시간', None),
    (BARAM, 'landing-3.jpg', (1200, 800), FIELD, '흙만 털어 보냅니다', '물로 씻으면 금방 상합니다', (190, 140, 90, 60)),
    (BARAM, 'landing-4.jpg', (1200, 800), SWEET, '크기별로 나눠 담습니다', '한 상자 안에서 굽는 시간이 같도록', None),
    (BARAM, 'product-sweet-5kg.jpg', (900, 900), SWEET, '밤고구마 5kg', '중·소 혼합', None),
    (BARAM, 'product-sweet-10kg.jpg', (900, 900), SWEET, '밤고구마 10kg', '중·소 혼합', None),
    (BARAM, 'product-onion.jpg', (900, 900), ((198, 176, 108), (110, 92, 48)), '햇양파 10kg', '망 포장', None),
]

for farm, name, size, colors, title, subtitle, dot in jobs:
    make(OUT / farm / name, size, colors[0], colors[1], title, subtitle, dot)

print(f'이미지 {len(jobs)}장 생성')
