import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HorizontalBarItem, HorizontalBarPanel } from "@/lib/charts.types";

interface HorizontalBarChartProps {
  panels: HorizontalBarPanel[];
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
}

/** Keep PDF captures compact so slices pack onto pages without large blank gaps. */
const PDF_ROWS_PER_BLOCK = 24;

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function HorizontalBarRows({
  items,
  axisMax,
}: {
  items: HorizontalBarItem[];
  axisMax: number;
}) {
  const effectiveMax = axisMax > 0 ? axisMax : 1;

  return (
    <div className="horizontal-bar-rows">
      {items.map((item) => {
        const widthPercent = Math.max(0, Math.min((item.value / effectiveMax) * 100, 100));

        return (
          <React.Fragment key={item.id}>
            <span
              className="horizontal-bar-label text-left text-sm leading-snug"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="horizontal-bar-track bg-muted/25 h-8 overflow-hidden rounded-sm">
              <div
                className="bg-chart-1 h-full rounded-sm"
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <span className="text-muted-foreground min-w-[4.5rem] text-right text-sm tabular-nums">
              {item.valueText}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export const HorizontalBarChart = React.memo(function HorizontalBarChart({
  panels,
  title,
  description,
  isLoading = false,
  error = null,
}: HorizontalBarChartProps) {
  const visiblePanels = panels.filter((panel) => panel.items.length > 0);
  const showPanelTitles = visiblePanels.length > 1;

  return (
    <Card className="horizontal-bar-chart">
      <CardHeader className="[.pdf-export-mode_&]:hidden">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="text-muted-foreground flex min-h-40 items-center justify-center text-sm">
            Loading chart data...
          </div>
        ) : visiblePanels.length === 0 ? (
          <div className="text-muted-foreground flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm">
            No data available for the selected time range and metrics.
          </div>
        ) : (
          <div className="space-y-8">
            {visiblePanels.map((panel, panelIndex) => {
              const panelAxisMax = panel.items.reduce(
                (max, item) => Math.max(max, item.value),
                0,
              );
              const rowChunks = chunkItems(panel.items, PDF_ROWS_PER_BLOCK);

              return (
                <div key={panel.id}>
                  {showPanelTitles ? (
                    <h4 className="text-muted-foreground mb-4 text-sm font-medium">
                      {panel.title}
                    </h4>
                  ) : null}

                  <div className="space-y-4">
                    {rowChunks.map((chunk, chunkIndex) => (
                      <div
                        key={`${panel.id}-${chunkIndex}`}
                        data-pdf-block="chart"
                        className="space-y-3"
                      >
                        {panelIndex === 0 && chunkIndex === 0 ? (
                          <div className="horizontal-bar-pdf-header hidden space-y-1 [.pdf-export-mode_&]:block">
                            <h3 className="text-base font-semibold">{title}</h3>
                            {description ? (
                              <p className="text-muted-foreground text-sm">{description}</p>
                            ) : null}
                          </div>
                        ) : null}

                        {chunk.length > 0 ? (
                          <HorizontalBarRows items={chunk} axisMax={panelAxisMax} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
