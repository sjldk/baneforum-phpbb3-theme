#!/usr/bin/env python3
"""Make baneforum/theme/dark_colours.css from prosilver's colours.css.

prosilver sets many colours as fixed values: dark text (#333, #28313f), light backgrounds (#efefef),
light borders (#ccc). They are made for a light page and fail on the dark theme. For every rule of
colours.css that sets one of these to a fixed value, this writes the same rule for the dark theme with
a colour from palette.css:

  text:        dark or muted grey and blue-grey -> var(--color-text) or var(--color-muted)
               blue (links)                     -> var(--accent)
               red                              -> var(--color-danger)
               green                            -> var(--color-success)
  background:  white and very light             -> var(--color-paper)
               light                            -> var(--color-surface)
               pale                             -> var(--color-tint)
  border:      anything not dark                -> var(--color-line)

White text, dark and strong colours and everything with an image or gradient are left alone.
The rules use :where(), so they are as weak as the prosilver rule they copy. The style's own rules,
which come later in stylesheet.css, still win. Run it again after a new prosilver release:

  docker exec docker-web-1 cat styles/prosilver/theme/colours.css > "$TMPDIR/colours.css"
  scripts/dark-colours.py "$TMPDIR/colours.css" baneforum/theme/dark_colours.css
"""
import colorsys
import re
import sys

SCOPE = ':where(:root[data-theme="dark"]) '
HEX = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b')


def parse_hex(value):
    value = value.lstrip('#')
    if len(value) == 3:
        value = ''.join(c * 2 for c in value)
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


def luminance(rgb):
    def lin(v):
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def text_token(value):
    """The palette colour that replaces a fixed text colour on the dark theme, or None."""
    rgb = parse_hex(value)
    hue, sat, _ = colorsys.rgb_to_hsv(*rgb)
    hue *= 360
    light = luminance(rgb)

    if sat < 0.50:
        # Grey and blue-grey text. Light ones are text on a dark fill, so they stay.
        if light < 0.08:
            return 'var(--color-text)'
        if light < 0.45:
            return 'var(--color-muted)'
        return None
    if 170 <= hue <= 260:
        return 'var(--accent)'
    if hue < 20 or hue > 330:
        return 'var(--color-danger)'
    if 80 <= hue <= 160:
        return 'var(--color-success)'
    return None


def background_token(value):
    light = luminance(parse_hex(value))
    if light >= 0.97:
        return 'var(--color-paper)'
    if light >= 0.85:
        return 'var(--color-surface)'
    if light >= 0.60:
        return 'var(--color-tint)'
    return None


def border_token(value):
    return 'var(--color-line)' if luminance(parse_hex(value)) >= 0.25 else None


def has_light_colour(value):
    """True if the value has a fixed light colour (#hex or rgb()), such as the light stops of a gradient."""
    colours = [parse_hex(c) for c in HEX.findall(value)]
    colours += [tuple(int(n) / 255 for n in m.groups()) for m in re.finditer(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)', value)]
    return any(luminance(c) >= 0.25 for c in colours)


def split_blocks(css):
    """Yield (prelude, body) for the top-level blocks of css. At-rule bodies are kept as text."""
    depth = 0
    start = 0
    prelude = ''
    for i, ch in enumerate(css):
        if ch == '{':
            if depth == 0:
                prelude = css[start:i].strip()
                start = i + 1
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                yield prelude, css[start:i]
                start = i + 1


def dark_declarations(body):
    """The dark replacements for the fixed colours of one rule body. The last value of a property counts."""
    found = {}
    for declaration in body.split(';'):
        if ':' not in declaration:
            continue

        prop, value = (part.strip() for part in declaration.split(':', 1))
        prop = prop.lower()
        important = '!important' in value
        value = value.replace('!important', '').strip()
        colour = HEX.search(value)

        if prop in ('background', 'background-image') and 'gradient(' in value and has_light_colour(value):
            # A light gradient on top of the dark background colour would hide it.
            found['background-image'] = ('none', important)
            continue

        if prop in ('color',) and re.fullmatch(HEX, value):
            token, name = text_token(value), 'color'
        elif prop in ('background', 'background-color') and colour and 'url(' not in value and 'gradient(' not in value:
            token, name = background_token(colour.group()), 'background-color'
        elif prop.startswith('border') and colour and prop != 'border-radius':
            # border, border-top, border-color, border-bottom-color ...: only the colour is replaced.
            token = border_token(colour.group())
            name = re.sub(r'^(border(?:-(?:top|right|bottom|left))?).*$', r'\1', prop) + '-color'
        else:
            continue

        found[name] = (token, important)

    return ['%s: %s%s;' % (name, token, ' !important' if important else '')
            for name, (token, important) in found.items() if token]


def dark_rule(selector, body):
    declarations = dark_declarations(body)
    if not declarations:
        return ''

    selectors = ',\n'.join(SCOPE + s.strip() for s in selector.split(',') if s.strip())
    return '%s {\n\t%s\n}\n\n' % (selectors, '\n\t'.join(declarations))


def convert(css):
    out = []
    for prelude, body in split_blocks(css):
        if prelude.startswith('@'):
            if prelude.startswith('@media'):
                inner = convert(body)
                if inner:
                    out.append('%s {\n%s}\n\n' % (prelude, inner))
            continue
        out.append(dark_rule(prelude, body))
    return ''.join(out)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)

    with open(sys.argv[1], encoding='utf-8') as source:
        css = re.sub(r'/\*.*?\*/', '', source.read(), flags=re.S)

    header = ('/* Generated by scripts/dark-colours.py from prosilver colours.css. Do not edit by hand.\n'
              '   Colours that prosilver fixes in the stylesheet, mapped to the palette for the dark theme. */\n\n')
    with open(sys.argv[2], 'w', encoding='utf-8') as target:
        target.write(header + convert(css))


if __name__ == '__main__':
    main()
