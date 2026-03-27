import type { Point } from "../types/lines";

const round = (value: number) => Number(value.toFixed(2));

export function pointsToPathData(points: Point[], closed = false): string {
  if (points.length === 0) {
    return "";
  }

  const [first, ...rest] = points;
  const commands = [`M ${round(first.x)} ${round(first.y)}`];

  for (const point of rest) {
    commands.push(`L ${round(point.x)} ${round(point.y)}`);
  }

  if (closed && points.length > 2) {
    commands.push("Z");
  }

  return commands.join(" ");
}
