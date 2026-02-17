from PIL import Image, ImageDraw, ImageFont
import os

ASSETS = os.path.join(os.path.dirname(__file__), "assets")

def create_icon(size, filename, add_padding=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if add_padding:
        margin = int(size * 0.17)
        cx, cy = size // 2, size // 2
        r = size // 2 - margin
        for i in range(r, 0, -1):
            ratio = i / r
            red = int(118 * ratio + 29 * (1 - ratio))
            green = int(75 * ratio + 155 * (1 - ratio))
            blue = int(162 * ratio + 240 * (1 - ratio))
            draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(red, green, blue, 255))
        font_size = int(size * 0.35)
    else:
        for y in range(size):
            ratio = y / size
            red = int(118 + (29 - 118) * ratio)
            green = int(75 + (155 - 75) * ratio)
            blue = int(162 + (240 - 162) * ratio)
            draw.line([(0, y), (size - 1, y)], fill=(red, green, blue, 255))
        corner_r = size // 5
        mask = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner_r, fill=255)
        img.putalpha(mask)
        draw = ImageDraw.Draw(img)
        font_size = int(size * 0.55)

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except Exception:
        font = ImageFont.load_default()

    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2
    ty = (size - th) // 2 - bbox[1]
    draw.text((tx + 2, ty + 2), text, fill=(0, 0, 0, 60), font=font)
    draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)

    filepath = os.path.join(ASSETS, filename)
    img.save(filepath, "PNG")
    print(f"Created {filename} ({size}x{size}) - {os.path.getsize(filepath)} bytes")


def create_splash(width, height, filename):
    img = Image.new("RGBA", (width, height), (118, 75, 162, 255))
    draw = ImageDraw.Draw(img)

    for y in range(height):
        ratio = y / height
        r = int(118 + (29 - 118) * ratio * 0.5)
        g = int(75 + (155 - 75) * ratio * 0.5)
        b = int(162 + (240 - 162) * ratio * 0.5)
        draw.line([(0, y), (width - 1, y)], fill=(r, g, b, 255))

    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 120)
        font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
    except Exception:
        font_large = ImageFont.load_default()
        font_small = font_large

    cx, cy = width // 2, height // 2 - 40
    r = 80
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 200), width=3)

    text = "P"
    bbox = draw.textbbox((0, 0), text, font=font_large)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw // 2, cy - th // 2 - bbox[1]), text, fill=(255, 255, 255), font=font_large)

    text2 = "Pulse"
    bbox2 = draw.textbbox((0, 0), text2, font=font_small)
    tw2 = bbox2[2] - bbox2[0]
    draw.text((cx - tw2 // 2, cy + r + 30), text2, fill=(255, 255, 255, 230), font=font_small)

    filepath = os.path.join(ASSETS, filename)
    img.save(filepath, "PNG")
    print(f"Created {filename} ({width}x{height}) - {os.path.getsize(filepath)} bytes")


if __name__ == "__main__":
    os.makedirs(ASSETS, exist_ok=True)
    create_icon(1024, "icon.png", add_padding=False)
    create_icon(1024, "adaptive-icon.png", add_padding=True)
    create_icon(48, "favicon.png", add_padding=False)
    create_splash(1284, 2778, "splash-icon.png")
    print("All icons generated!")
