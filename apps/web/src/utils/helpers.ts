import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export type Range = "30d" | "90d" | "1y";

// Base type used by the chart — only needs date + ratio
export type ChartPoint = {
  date: string;
  ratio: number;
};

export type RatioPoint = ChartPoint & {
  btcUsd: number;
  xauUsd: number;
};

export type EthBtcPoint = ChartPoint & {
  ethUsd: number;
  btcUsd: number;
};

export type UsdSatPoint = ChartPoint & {
  btcUsd: number;
};

export const formatRatio = (v: number): string =>
  v >= 100 ? v.toFixed(0) : v.toFixed(1);

export const formatInverse = (v: number): string =>
  v < 0.001 ? v.toFixed(6) : v < 0.01 ? v.toFixed(5) : v.toFixed(4);

export const sliceForRange = <T extends ChartPoint>(series: T[], range: Range): T[] => {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  return series.slice(-days);
};

export const getYDomain = (data: ChartPoint[]): [number, number] => {
  if (data.length === 0) return [0, 1];
  const ratios = data.map((d) => d.ratio);
  const min = Math.min(...ratios);
  const max = Math.max(...ratios);
  const padding = (max - min) * 0.08;
  return [Math.max(0, min - padding), max + padding];
};

const chartDateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const formatChartDate = (dateStr: string): string => chartDateFmt.format(new Date(dateStr));

const chartDateShortFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
export const formatChartDateShort = (dateStr: string): string =>
  chartDateShortFmt.format(new Date(dateStr)).replace(" ", " '");
