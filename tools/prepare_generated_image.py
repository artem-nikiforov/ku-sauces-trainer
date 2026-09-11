"""Resize/crop a generated PNG and encode a course-ready WebP."""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("width", type=int)
    parser.add_argument("height", type=int)
    parser.add_argument("--max-bytes", type=int, default=120_000)
    args = parser.parse_args()

    with Image.open(args.source) as opened:
        image = ImageOps.fit(
            opened.convert("RGB"),
            (args.width, args.height),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )

    encoded = None
    used_quality = None
    for quality in range(82, 43, -2):
        buffer = BytesIO()
        image.save(buffer, "WEBP", quality=quality, method=6)
        encoded = buffer.getvalue()
        used_quality = quality
        if len(encoded) <= args.max_bytes:
            break

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_bytes(encoded or b"")
    print(
        f"{args.destination}: {args.width}x{args.height}, "
        f"quality={used_quality}, bytes={len(encoded or b'')}"
    )


if __name__ == "__main__":
    main()
