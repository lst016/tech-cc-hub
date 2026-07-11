#!/usr/bin/env python3
"""Compose Codex-Canvas Quick Edit annotations onto a temporary PNG input."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Source image path.")
    parser.add_argument("--annotations", required=True, help="Annotation JSON path.")
    parser.add_argument("--out", required=True, help="Output annotated PNG path.")
    parser.add_argument("--force", action="store_true", help="Overwrite an existing output file.")
    return parser.parse_args()


def die(message: str) -> None:
    raise SystemExit(message)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def parse_color(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    text = str(value or "").strip()
    if text.startswith("#") and len(text) in (4, 7):
        if len(text) == 4:
            red = int(text[1] * 2, 16)
            green = int(text[2] * 2, 16)
            blue = int(text[3] * 2, 16)
        else:
            red = int(text[1:3], 16)
            green = int(text[3:5], 16)
            blue = int(text[5:7], 16)
        return red, green, blue, alpha
    return 32, 33, 36, alpha


def load_font(size: int, text: str = ""):
    from PIL import ImageFont

    font_candidates = [
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
        "DejaVuSans.ttf",
        "Arial.ttf",
        "LiberationSans-Regular.ttf",
    ]

    for name in font_candidates:
        try:
            font = ImageFont.truetype(name, size)
            if font_supports_text(font, text):
                return font
        except Exception:
            pass
    return ImageFont.load_default()


def font_supports_text(font, text: str) -> bool:
    if not text:
        return True
    try:
        missing = font.getmask("\u25a1").getbbox()
        for char in text:
            if char.isspace():
                continue
            if font.getmask(char).getbbox() != missing:
                return True
    except Exception:
        return True
    return False


def scale_point(point: dict, scale_x: float, scale_y: float, offset_x: float = 0, offset_y: float = 0) -> tuple[float, float]:
    return float(point.get("x", 0)) * scale_x + offset_x, float(point.get("y", 0)) * scale_y + offset_y


def draw_drawing(draw, item: dict, scale_x: float, scale_y: float, offset_x: float = 0, offset_y: float = 0) -> None:
    points = [scale_point(point, scale_x, scale_y, offset_x, offset_y) for point in item.get("points", []) if isinstance(point, dict)]
    if len(points) < 2:
        return

    color = parse_color(item.get("stroke"), 245)
    stroke_width = max(1, round(float(item.get("strokeWidth", 4)) * (scale_x + scale_y) / 2))
    draw.line(points, fill=color, width=stroke_width, joint="curve")

    radius = max(1, stroke_width / 2)
    for x, y in points:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)


def draw_annotation_arrow(draw, item: dict, scale_x: float, scale_y: float, offset_x: float = 0, offset_y: float = 0) -> None:
    points = [scale_point(point, scale_x, scale_y, offset_x, offset_y) for point in item.get("points", []) if isinstance(point, dict)]
    if len(points) != 2:
        return

    start, end = points
    color = parse_color(item.get("stroke"), 255)
    stroke_width = max(1, round(float(item.get("strokeWidth", 4)) * (scale_x + scale_y) / 2))
    control_input = item.get("control")
    control = scale_point(control_input, scale_x, scale_y, offset_x, offset_y) if isinstance(control_input, dict) else None
    if item.get("curve") == "quadratic" and control:
        distance = math.hypot(end[0] - start[0], end[1] - start[1])
        steps = max(12, min(64, round(distance / 8)))
        line_points = []
        for index in range(steps + 1):
            t = index / steps
            inverse = 1 - t
            line_points.append((
                inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
                inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1]
            ))
        draw.line(line_points, fill=color, width=stroke_width, joint="curve")
    else:
        draw.line((start, end), fill=color, width=stroke_width)

    tangent = control or (end if item.get("arrowhead") == "start" else start)
    tail, tip = (tangent, start) if item.get("arrowhead") == "start" else (tangent, end)
    dx = tip[0] - tail[0]
    dy = tip[1] - tail[1]
    distance = math.hypot(dx, dy)
    if distance < 0.001:
        return
    angle = math.atan2(dy, dx)
    head_length = max(10, stroke_width * 3)
    wing = math.pi / 6
    first = (tip[0] - math.cos(angle - wing) * head_length, tip[1] - math.sin(angle - wing) * head_length)
    second = (tip[0] - math.cos(angle + wing) * head_length, tip[1] - math.sin(angle + wing) * head_length)
    draw.line((first, tip, second), fill=color, width=stroke_width, joint="curve")


def draw_text(draw, item: dict, scale_x: float, scale_y: float, image_size: tuple[int, int], offset_x: float = 0, offset_y: float = 0) -> None:
    text = str(item.get("text") or "").strip()
    if not text:
        return

    image_width, image_height = image_size
    x = clamp(float(item.get("x", 0)) * scale_x + offset_x, 0, image_width)
    y = clamp(float(item.get("y", 0)) * scale_y + offset_y, 0, image_height)
    width = max(1, float(item.get("width", 1)) * scale_x)
    height = max(1, float(item.get("height", 1)) * scale_y)
    font_size = max(8, round(float(item.get("fontSize", 28)) * scale_y))
    color = parse_color(item.get("color"), 245)
    font = load_font(font_size, text)

    padding = max(4, round(font_size * 0.2))
    rect = (x, y, min(image_width, x + width), min(image_height, y + height))
    draw.rounded_rectangle(rect, radius=max(2, padding // 2), fill=(255, 255, 255, 210), outline=color, width=max(1, font_size // 12))
    draw.multiline_text((x + padding, y + padding), text, fill=color, font=font, spacing=max(1, font_size // 8))


def main() -> None:
    args = parse_args()
    source_path = Path(args.source)
    annotations_path = Path(args.annotations)
    output_path = Path(args.out)

    if not source_path.exists():
        die(f"Source image not found: {source_path}")
    if not annotations_path.exists():
        die(f"Annotation JSON not found: {annotations_path}")
    if output_path.exists() and not args.force:
        die(f"Output already exists: {output_path}")

    try:
        from PIL import Image, ImageDraw
    except ImportError as error:
        die(f"Pillow is required for Quick Edit annotation composition: {error}")

    payload = json.loads(annotations_path.read_text(encoding="utf-8"))
    items = payload.get("items") if isinstance(payload, dict) else []
    if not isinstance(items, list):
        items = []

    source_image = Image.open(source_path).convert("RGBA")
    source_size = payload.get("sourceSize") if isinstance(payload, dict) else {}
    source_rect = payload.get("sourceRect") if isinstance(payload, dict) else None
    output_bounds = payload.get("outputBounds") if isinstance(payload, dict) else None
    use_canvas_bounds = isinstance(source_rect, dict) and isinstance(output_bounds, dict)

    if use_canvas_bounds:
        source_rect_width = float(source_rect.get("width") or source_image.width)
        source_rect_height = float(source_rect.get("height") or source_image.height)
        scale_x = source_image.width / max(1.0, source_rect_width)
        scale_y = source_image.height / max(1.0, source_rect_height)
        output_width = max(1, round(float(output_bounds.get("width") or source_rect_width) * scale_x))
        output_height = max(1, round(float(output_bounds.get("height") or source_rect_height) * scale_y))
        image = Image.new("RGBA", (output_width, output_height), (255, 255, 255, 255))
        source_offset_x = (float(source_rect.get("x", 0)) - float(output_bounds.get("x", 0))) * scale_x
        source_offset_y = (float(source_rect.get("y", 0)) - float(output_bounds.get("y", 0))) * scale_y
        image.alpha_composite(source_image, (round(source_offset_x), round(source_offset_y)))
        offset_x = -float(output_bounds.get("x", 0)) * scale_x
        offset_y = -float(output_bounds.get("y", 0)) * scale_y
    else:
        image = source_image
        basis_width = float(source_size.get("width") or image.width)
        basis_height = float(source_size.get("height") or image.height)
        scale_x = image.width / max(1.0, basis_width)
        scale_y = image.height / max(1.0, basis_height)
        offset_x = 0
        offset_y = 0

    overlay = Image.new("RGBA", image.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "drawing":
            draw_drawing(draw, item, scale_x, scale_y, offset_x, offset_y)
        elif item.get("type") == "annotation-arrow":
            draw_annotation_arrow(draw, item, scale_x, scale_y, offset_x, offset_y)
        elif item.get("type") == "text":
            draw_text(draw, item, scale_x, scale_y, image.size, offset_x, offset_y)

    image.alpha_composite(overlay)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)


if __name__ == "__main__":
    main()
