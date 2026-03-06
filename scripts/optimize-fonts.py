#!/usr/bin/env python3
"""
Optimize fonts by subsetting and converting to WOFF2.
"""
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
fonts_dir = project_root / "public" / "fonts"

try:
    from fontTools.ttLib import TTFont
    from fontTools.subset import Subsetter, Options
except ImportError:
    print("Error: fonttools not installed. Run: pip install fonttools brotli")
    sys.exit(1)


def load_characters(char_file="/tmp/chars_final.txt"):
    """Load characters to keep from file."""
    with open(char_file, "r", encoding="utf-8") as f:
        chars = set(line.strip() for line in f if line.strip())
    # Add common punctuation and symbols
    chars.update("，。！？：；、""''（）【】《》·…—")
    return "".join(sorted(chars))


def optimize_font(input_path, output_path, chars_to_keep):
    """Subset and convert font to WOFF2."""
    print(f"Processing: {input_path.name}")

    # Load font
    font = TTFont(str(input_path))

    # Get original size
    original_size = input_path.stat().st_size

    # Create subsetter with options
    options = Options()
    options.flavor = "woff2"
    options.drop_tables = ["GSUB", "GPOS", "GDEF", "BASE", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gasp", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "rclt", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"]
    options.layout_features = ["*"]  # Keep all layout features
    options.name_IDs = ["*"]  # Keep all name IDs
    options.legacy_kern = False
    options.hinting = False  # Drop hinting for smaller size

    subsetter = Subsetter(options=options)
    subsetter.populate(text=chars_to_keep)
    subsetter.subset(font)

    # Save
    font.save(str(output_path))
    font.close()

    # Get new size
    new_size = output_path.stat().st_size
    reduction = (1 - new_size / original_size) * 100

    print(f"  Original: {original_size / 1024 / 1024:.2f} MB")
    print(f"  Optimized: {new_size / 1024:.2f} KB ({reduction:.1f}% reduction)")
    print()

    return new_size


def main():
    # Load characters
    chars = load_characters()
    print(f"Keeping {len(chars)} unique characters\n")

    # Create output directory
    optimized_dir = fonts_dir / "optimized"
    optimized_dir.mkdir(exist_ok=True)

    # Font mappings: (input_file, output_file)
    fonts = [
        ("lxgw-wenkai-light.ttf", "lxgw-wenkai-light.woff2"),
        ("lxgw-wenkai-regular.ttf", "lxgw-wenkai-regular.woff2"),
        ("lxgw-wenkai-medium.ttf", "lxgw-wenkai-medium.woff2"),
        ("NotoSerifCJKsc-ExtraLight.otf", "noto-serif-sc-extralight.woff2"),
        ("NotoSerifCJKsc-Light.otf", "noto-serif-sc-light.woff2"),
        ("NotoSerifCJKsc-Regular.otf", "noto-serif-sc-regular.woff2"),
        ("NotoSerifCJKsc-Medium.otf", "noto-serif-sc-medium.woff2"),
        ("NotoSerifCJKsc-SemiBold.otf", "noto-serif-sc-semibold.woff2"),
    ]

    total_size = 0
    for input_name, output_name in fonts:
        input_path = fonts_dir / input_name
        output_path = optimized_dir / output_name

        if input_path.exists():
            size = optimize_font(input_path, output_path, chars)
            total_size += size
        else:
            print(f"Warning: {input_name} not found, skipping\n")

    print(f"Total optimized size: {total_size / 1024:.2f} KB")


if __name__ == "__main__":
    main()
