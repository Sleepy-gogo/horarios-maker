export const HEX_RE = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value)
}

/** Accepts #rgb, #rrggbb, #rrggbbaa and returns #RRGGBB(AA) uppercase, or null. */
export function normalizeHex(input: string): string | null {
  const text = input.trim().replace(/^#?/, "#")
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    return `#${text.slice(1).split("").map((c) => c + c).join("")}`.toUpperCase()
  }
  if (/^#[0-9a-f]{4}$/i.test(text)) {
    return `#${text.slice(1).split("").map((c) => c + c).join("")}`.toUpperCase()
  }
  if (HEX_RE.test(text)) return text.toUpperCase()
  return null
}

export function hexToRgb(hex: string) {
  const value = normalizeHex(hex) ?? "#000000"
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
    a: value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1,
  }
}

const toHex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0").toUpperCase()

export function rgbToHex(r: number, g: number, b: number, a = 1) {
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}${a < 0.999 ? toHex2(a * 255) : ""}`
}

function channel(value: number) {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Composites a translucent color over an opaque background. */
export function flatten(hex: string, background: string) {
  const top = hexToRgb(hex)
  if (top.a >= 0.999) return rgbToHex(top.r, top.g, top.b)
  const bottom = hexToRgb(background)
  return rgbToHex(
    top.r * top.a + bottom.r * (1 - top.a),
    top.g * top.a + bottom.g * (1 - top.a),
    top.b * top.a + bottom.b * (1 - top.a),
  )
}

export function contrastRatio(a: string, b: string) {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Picks near-black or white text, whichever reads better on the background. */
export function readableText(background: string) {
  const dark = "#14141A"
  const light = "#FFFFFF"
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light
}

export function mix(a: string, b: string, amount: number) {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return rgbToHex(x.r + (y.r - x.r) * amount, x.g + (y.g - x.g) * amount, x.b + (y.b - x.b) * amount)
}

export function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r, g, b, alpha)
}

export function darken(hex: string, amount: number) {
  return mix(hex, "#000000", amount)
}

/** Splits #RRGGBBAA into an SVG color and opacity. */
export function svgPaint(hex: string): { color: string; opacity: number } {
  const value = normalizeHex(hex) ?? "#000000"
  if (value.length === 9) {
    return { color: value.slice(0, 7), opacity: Math.round((parseInt(value.slice(7, 9), 16) / 255) * 1000) / 1000 }
  }
  return { color: value, opacity: 1 }
}
