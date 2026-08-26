import test from 'node:test'
import assert from 'node:assert/strict'
import { contrastTokens } from '../client/src/contrast-tokens.js'

function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255)
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

export function contrastRatio(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

for (const [theme, pairs] of Object.entries(contrastTokens)) {
  test(`${theme} semantic color pairs meet WCAG AA`, (t) => {
    for (const [name, [foreground, background, minimum]] of Object.entries(pairs)) {
      const ratio = contrastRatio(foreground, background)
      t.diagnostic(`${name}: ${foreground} on ${background} = ${ratio.toFixed(2)}:1 (minimum ${minimum}:1)`)
      assert.ok(ratio >= minimum, `${theme}.${name} is ${ratio.toFixed(2)}:1; expected >= ${minimum}:1`)
    }
  })
}
