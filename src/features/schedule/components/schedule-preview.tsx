import { DAYS, type ScheduleItem, type ScheduleSettings, type TimelineMetrics } from "@/features/schedule/types"
import {
  clamp,
  computeLayout,
  fitTextInBlock,
  getLegend,
  getMinutePosition,
  timeToMinutes,
} from "@/features/schedule/utils"

type SchedulePreviewProps = {
  svgRef: React.RefObject<SVGSVGElement | null>
  frame: { label: string; width: number; height: number }
  settings: ScheduleSettings
  items: ScheduleItem[]
  theme: {
    page: string
    pageEnd: string
    ink: string
    panel: string
    panelStrong: string
    grid: string
    muted: string
    accent: string
    panelRadius: number
    blockRadius: number
    strokeWidth: number
  }
  timeline: TimelineMetrics
  densityFactor: number
}

export function SchedulePreview({
  svgRef,
  frame,
  settings,
  items,
  theme,
  timeline,
  densityFactor,
}: SchedulePreviewProps) {
  const legend = getLegend(items)
  const layout = computeLayout(frame.width, frame.height, settings, legend.length)
  const effectiveBlockRadius = Math.min(theme.blockRadius, layout.columnWidth * 0.08)
  const preferredTitleSize = clamp(frame.width * 0.016 * densityFactor, 8, 22)
  const minTitleSize = Math.max(frame.width * 0.007, 6)
  const preferredMetaSize = clamp(frame.width * 0.012 * densityFactor, 6, 16)
  const minMetaSize = Math.max(frame.width * 0.005, 5)

  return (
    <section className="canvas-area">
      <div className="canvas-frame">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          role="img"
          aria-label="Vista previa del horario"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.page} />
              <stop offset="100%" stopColor={theme.pageEnd} />
            </linearGradient>
            <filter id="panelShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="16" stdDeviation="24" floodOpacity="0.12" />
            </filter>
          </defs>

          <rect width={frame.width} height={frame.height} fill="url(#bg)" />
          <circle
            cx={frame.width * 0.88}
            cy={frame.height * 0.1}
            r={frame.width * 0.1}
            fill={theme.accent}
            opacity="0.1"
          />
          <circle
            cx={frame.width * 0.1}
            cy={frame.height * 0.88}
            r={frame.width * 0.08}
            fill={theme.accent}
            opacity="0.08"
          />

          <rect
            x={layout.outerPad}
            y={layout.outerPad}
            width={frame.width - layout.outerPad * 2}
            height={frame.height - layout.outerPad * 2}
            rx={theme.panelRadius}
            fill={theme.panel}
            filter="url(#panelShadow)"
          />

          <text
            x={frame.width / 2}
            y={layout.titleBaseY}
            textAnchor="middle"
            fontSize={layout.titleFontSize}
            fontFamily="'Bebas Neue', sans-serif"
            letterSpacing={settings.uppercaseTitle ? frame.width * 0.006 : frame.width * 0.002}
            fill={theme.ink}
          >
            {settings.uppercaseTitle ? settings.title.toUpperCase() : settings.title}
          </text>

          <text
            x={frame.width / 2}
            y={layout.subtitleBaseY}
            textAnchor="middle"
            fontSize={layout.subtitleFontSize}
            fontFamily="'DM Sans', sans-serif"
            letterSpacing={frame.width * 0.001}
            fill={theme.muted}
          >
            {settings.subtitle}
          </text>

          {DAYS.map((day, index) => {
            const x = layout.timeLabelWidth + index * layout.columnWidth

            return (
              <g key={day}>
                <rect
                  x={x}
                  y={layout.gridTop}
                  width={layout.columnWidth}
                  height={layout.dayRowHeight}
                  fill={theme.panelStrong}
                  stroke={theme.grid}
                  strokeWidth={theme.strokeWidth}
                />
                <text
                  x={x + layout.columnWidth / 2}
                  y={layout.gridTop + layout.dayRowHeight * 0.65}
                  textAnchor="middle"
                  fontSize={layout.dayFontSize}
                  fontFamily="'DM Sans', sans-serif"
                  fontWeight="700"
                  fill={theme.ink}
                >
                  {day}
                </text>
              </g>
            )
          })}

          <rect
            x={layout.timeLabelWidth}
            y={layout.gridStartY}
            width={layout.columnWidth * DAYS.length}
            height={layout.timelineHeight}
            fill={theme.panelStrong}
            stroke={theme.grid}
            strokeWidth={theme.strokeWidth}
          />

          {Array.from({ length: timeline.endHour - timeline.startHour + 1 }, (_, index) => {
            const hour = timeline.startHour + index
            const y =
              layout.gridStartY +
              getMinutePosition(hour * 60, timeline, layout.timelineHeight)

            return (
              <g key={hour}>
                <line
                  x1={layout.timeLabelWidth}
                  x2={layout.timeLabelWidth + layout.columnWidth * DAYS.length}
                  y1={y}
                  y2={y}
                  stroke={theme.grid}
                  strokeWidth={theme.strokeWidth}
                />
                {settings.showTimeLabels ? (
                  <text
                    x={layout.timeLabelWidth - 8}
                    y={y + layout.timeLabelFontSize * 0.35}
                    textAnchor="end"
                    fontSize={layout.timeLabelFontSize}
                    fontFamily="'DM Sans', sans-serif"
                    fontWeight="600"
                    fill={theme.ink}
                  >
                    {`${hour}:00`}
                  </text>
                ) : null}
              </g>
            )
          })}

          {DAYS.map((day, index) => (
            <line
              key={day}
              x1={layout.timeLabelWidth + index * layout.columnWidth}
              x2={layout.timeLabelWidth + index * layout.columnWidth}
              y1={layout.gridStartY}
              y2={layout.gridStartY + layout.timelineHeight}
              stroke={theme.grid}
              strokeWidth={theme.strokeWidth}
            />
          ))}

          {items.map((item) => {
            const dayIndex = DAYS.indexOf(item.day)
            const colX = layout.timeLabelWidth + dayIndex * layout.columnWidth
            const x = colX + layout.blockInset
            const width = layout.columnWidth - layout.blockInset * 2

            const rawY = layout.gridStartY + getMinutePosition(timeToMinutes(item.start), timeline, layout.timelineHeight) + layout.blockGapV
            const rawEndY = layout.gridStartY + getMinutePosition(timeToMinutes(item.end), timeline, layout.timelineHeight) - layout.blockGapV
            const height = Math.max(rawEndY - rawY, 28)
            const y = rawY

            const bRadius = Math.min(effectiveBlockRadius, height * 0.2)

            // Inner padding
            const padH = Math.max(4, Math.round(width * 0.06))
            const padV = Math.max(4, Math.round(height * 0.06))
            const innerW = width - padH * 2
            const innerH = height - padV * 2

            if (innerH < 6 || innerW < 10) {
              return <rect key={item.id} x={x} y={y} width={width} height={height} rx={bRadius} fill={item.color} stroke={theme.grid} strokeWidth={theme.strokeWidth} />
            }

            // Meta text
            const metaParts = [
              settings.showRoom && item.room ? item.room : "",
              settings.showDetails && item.details ? item.details : "",
            ].filter(Boolean)
            const metaText = metaParts.join(" · ")
            const hasMeta = metaText.length > 0

            // Fit title — reserve space for meta if present
            const titleMaxH = hasMeta ? innerH * 0.6 : innerH
            const titleFit = fitTextInBlock(
              settings.uppercaseTitle ? item.subject.toUpperCase() : item.subject,
              innerW, titleMaxH, preferredTitleSize, minTitleSize,
            )

            // Fit meta in remaining space
            const metaGap = hasMeta ? Math.max(2, titleFit.fontSize * 0.3) : 0
            const metaMaxH = innerH - titleFit.totalHeight - metaGap
            let metaFit: ReturnType<typeof fitTextInBlock> | null = null
            if (hasMeta && metaMaxH > minMetaSize * 1.3) {
              metaFit = fitTextInBlock(metaText, innerW, metaMaxH, preferredMetaSize, minMetaSize)
            }

            // Vertical centering
            const totalTextH = titleFit.totalHeight + (metaFit ? metaGap + metaFit.totalHeight : 0)
            const textTopY = y + padV + (innerH - totalTextH) / 2
            const titleBaseY = textTopY + titleFit.fontSize * 0.82
            const metaBaseY = metaFit ? textTopY + titleFit.totalHeight + metaGap + metaFit.fontSize * 0.82 : 0

            return (
              <g key={item.id}>
                <rect x={x} y={y} width={width} height={height} rx={bRadius} fill={item.color} stroke={theme.grid} strokeWidth={theme.strokeWidth} />
                <text
                  x={x + width / 2} y={titleBaseY}
                  textAnchor="middle"
                  fontSize={titleFit.fontSize}
                  fontFamily="'DM Sans', sans-serif"
                  fontWeight="700"
                  fill={item.textColor}
                >
                  {titleFit.lines.map((line, i) => (
                    <tspan key={i} x={x + width / 2} dy={i === 0 ? 0 : titleFit.lineHeight}>{line}</tspan>
                  ))}
                </text>
                {metaFit && (
                  <text
                    x={x + width / 2} y={metaBaseY}
                    textAnchor="middle"
                    fontSize={metaFit.fontSize}
                    fontFamily="'DM Sans', sans-serif"
                    fontWeight="500"
                    fill={item.textColor}
                    opacity="0.78"
                  >
                    {metaFit.lines.map((line, i) => (
                      <tspan key={i} x={x + width / 2} dy={i === 0 ? 0 : metaFit!.lineHeight}>{line}</tspan>
                    ))}
                  </text>
                )}
              </g>
            )
          })}

          {settings.showLegend ? (
            <g>
              {(() => {
                const footerY = frame.height - layout.footerHeight + layout.footerPad
                const labelY = footerY + layout.legendLabelSize * 0.85
                const chipY0 = footerY + layout.legendLabelSize * 1.3 + 6
                const chipWidth =
                  (frame.width - layout.timeLabelWidth - layout.rightMargin) /
                    layout.legendCols -
                  10

                return (
                  <>
                    <text
                      x={layout.timeLabelWidth}
                      y={labelY}
                      fontSize={layout.legendLabelSize}
                      fontFamily="'DM Sans', sans-serif"
                      fontWeight="700"
                      fill={theme.ink}
                    >
                      Referencias
                    </text>
                    {legend.map((item, index) => {
                      const column = index % layout.legendCols
                      const row = Math.floor(index / layout.legendCols)
                      const x = layout.timeLabelWidth + column * (chipWidth + 10)
                      const y = chipY0 + row * layout.legendRowHeight
                      const dotRadius = layout.legendChipHeight * 0.22
                      const textSize = Math.round(layout.legendChipHeight * 0.5)

                      return (
                        <g key={`legend-${item.subject}`}>
                          <rect
                            x={x}
                            y={y}
                            width={chipWidth}
                            height={layout.legendChipHeight}
                            rx={layout.legendChipHeight / 2}
                            fill={theme.panelStrong}
                            stroke={theme.grid}
                            strokeWidth={theme.strokeWidth}
                          />
                          <circle
                            cx={x + layout.legendChipHeight * 0.55}
                            cy={y + layout.legendChipHeight / 2}
                            r={dotRadius}
                            fill={item.color}
                          />
                          <text
                            x={x + layout.legendChipHeight * 1.1}
                            y={y + layout.legendChipHeight * 0.65}
                            fontSize={textSize}
                            fontFamily="'DM Sans', sans-serif"
                            fontWeight="600"
                            fill={theme.ink}
                          >
                            {item.subject}
                          </text>
                        </g>
                      )
                    })}
                  </>
                )
              })()}
            </g>
          ) : null}
        </svg>
      </div>
    </section>
  )
}
