import { darken, mix } from "@/domain/color"
import type { Appearance } from "@/domain/types"
import { cn } from "@/lib/utils"

const BLOCKS: [column: number, top: number, height: number][] = [
  [0, 27, 11],
  [1, 31, 15],
  [2, 25, 9],
  [3, 36, 12],
  [0, 43, 10],
  [2, 39, 14],
]

/** A miniature of a look, drawn from its real values: page, title, grid header and lines, and blocks in its palette and block style. */
export function ThemeSwatch({ appearance: look, className }: { appearance: Appearance; className?: string }) {
  const surface = look.sheet.show ? look.sheet.fill : look.page.background
  const grid = { x: 10, y: 18, w: 100, h: 44 }
  const columnW = grid.w / 4
  const titleW = 38
  const titleX = look.header.align === "center" ? (120 - titleW) / 2 : grid.x
  const radius = Math.min(look.blocks.radius / 4, 3)
  return (
    <svg viewBox="0 0 120 64" aria-hidden="true" className={cn("block w-full", className)} preserveAspectRatio="xMidYMid slice">
      <rect width="120" height="64" fill={look.page.background} />
      {look.sheet.show ? <rect x="5" y="5" width="110" height="64" rx={Math.min(look.sheet.radius / 4, 4)} fill={surface} /> : null}
      <rect x={titleX} y="8" width={titleW} height="4" rx="1" fill={look.colors.ink} />
      <rect x={grid.x} y={grid.y} width={grid.w} height={grid.h} fill={look.grid.bodyFill} />
      <rect x={grid.x} y={grid.y} width={grid.w} height="5" fill={look.grid.headerFill} />
      {[1, 2, 3].map((index) => (
        <line key={index} x1={grid.x + columnW * index} x2={grid.x + columnW * index} y1={grid.y} y2={grid.y + grid.h} stroke={look.grid.lineColor} strokeWidth={Math.max(0.4, look.grid.lineWidth / 2)} />
      ))}
      {BLOCKS.map(([column, top, height], index) => {
        const color = look.palette[index % look.palette.length]!
        const x = grid.x + columnW * column + 1.5
        const w = columnW - 3
        const style = look.blocks.style
        const fill = style === "solid" ? color : style === "soft" ? mix(look.grid.bodyFill, color, 0.3) : look.grid.bodyFill
        const stroke = style === "outline" ? color : look.blocks.borderWidth > 0 ? (look.blocks.borderColor === "auto" ? darken(color, 0.28) : look.blocks.borderColor) : undefined
        return (
          <g key={index}>
            <rect x={x} y={top} width={w} height={height} rx={radius} fill={fill} stroke={stroke} strokeWidth={stroke ? 0.75 : 0} />
            {look.blocks.showAccentBar ? <rect x={x} y={top} width="1.6" height={height} fill={style === "solid" ? darken(color, 0.3) : color} /> : null}
          </g>
        )
      })}
    </svg>
  )
}
