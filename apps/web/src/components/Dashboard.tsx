"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useBtcXauCurrent, useBtcXauHistory } from "@/hooks/useBtcXauData";
import { useEthBtcCurrent, useEthBtcHistory } from "@/hooks/useEthBtcData";
import { formatUsd, formatPercent, formatUsdCents } from "@dashboard/utils";
import {
  formatRatio,
  formatInverse,
  sliceForRange,
  getYDomain,
  formatChartDate,
  formatChartDateShort,
  type Range,
  type ChartPoint,
  type RatioPoint,
  type EthBtcPoint,
  type UsdSatPoint,
} from "@/utils/helpers";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import type { ContentType } from "recharts/types/component/Tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, Check } from "lucide-react";

// ─── Widget config ────────────────────────────────────────────────────────────

type WidgetId = "btc-xau" | "eth-btc" | "usd-sat";

const WIDGETS: { id: WidgetId; label: string; logoText: string }[] = [
  { id: "btc-xau", label: "BTC / XAU", logoText: "₿/Au" },
  { id: "eth-btc", label: "ETH / BTC", logoText: "Ξ/₿" },
  { id: "usd-sat", label: "USD / SAT", logoText: "S/$" },
];

const RANGES: { label: string; value: Range }[] = [
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "1Y", value: "1y" },
];

// ─── Shared components ────────────────────────────────────────────────────────

const LogoMark = ({ text }: { text: string }) => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
    aria-hidden
    className="shrink-0"
  >
    <rect x="2" y="2" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <text x="14" y="18" textAnchor="middle" fontFamily="inherit" fontWeight="700" fontSize="11" fill="currentColor">
      {text}
    </text>
  </svg>
);

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
};

const MetricCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="bg-muted/50 rounded-lg px-3 py-2.5">
    <div className="text-xs text-muted-foreground font-medium mb-0.5">{label}</div>
    <div className="text-sm font-semibold tabular-nums">{value}</div>
    {sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>}
  </div>
);

const RangeSwitch = ({ range, onChange }: { range: Range; onChange: (r: Range) => void }) => (
  <div className="flex gap-1 bg-muted/60 rounded-lg p-0.5">
    {RANGES.map((r) => (
      <button
        key={r.value}
        onClick={() => onChange(r.value)}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          range === r.value
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {r.label}
      </button>
    ))}
  </div>
);

const ChangeBadge = ({ value }: { value: number }) => (
  <span
    className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums px-2 py-0.5 rounded-md ${
      value >= 0
        ? "text-[hsl(var(--gain))] bg-[hsl(var(--gain)/0.1)]"
        : "text-[hsl(var(--loss))] bg-[hsl(var(--loss)/0.1)]"
    }`}
  >
    {value >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
    {formatPercent(value)}
  </span>
);

const RatioChart = <T extends ChartPoint>({
  data,
  range,
  formatY = formatRatio,
  tooltip,
}: {
  data: T[];
  range: Range;
  formatY?: (v: number) => string;
  tooltip?: React.ComponentType<{ active?: boolean; payload?: ReadonlyArray<{ payload?: T }> }>;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sliced = sliceForRange(data, range);
  const [yMin, yMax] = getYDomain(sliced);
  const tickFormatter = range === "1y" ? formatChartDateShort : formatChartDate;

  return (
    <div ref={containerRef} className="w-full h-70 sm:h-85">
      {dims && (
        <AreaChart data={sliced} width={dims.width} height={dims.height} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="ratioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={tickFormatter}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={formatY}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          {/* Recharts ContentType doesn't align with generic tooltip props — cast justified at library boundary */}
          {tooltip && <RechartsTooltip content={tooltip as ContentType} cursor={{ stroke: "hsl(var(--border))" }} />}
          <Area
            type="monotone"
            dataKey="ratio"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#ratioGrad)"
            animationDuration={600}
            dot={false}
            activeDot={{ r: 4, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
          />
        </AreaChart>
      )}
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="space-y-3">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
    <Skeleton className="h-70 w-full rounded-lg" />
  </div>
);

const ErrorState = ({ error }: { error: Error }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
    <AlertCircle className="w-8 h-8 mb-3 text-[hsl(var(--loss))]" />
    <p className="text-sm font-medium mb-1">Failed to load data</p>
    <p className="text-xs">{error.message}</p>
  </div>
);

// ─── BTC / XAU widget ─────────────────────────────────────────────────────────

const BtcXauTooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: RatioPoint }> }) => {
  if (!active || !payload?.[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-popover-border rounded-lg px-3 py-2 shadow-md text-xs">
      <div className="font-medium text-foreground mb-1">{d.date}</div>
      <div className="tabular-nums text-muted-foreground">
        <span className="text-foreground font-semibold">{formatRatio(d.ratio)} oz</span> gold / BTC
      </div>
      <div className="flex gap-3 mt-1 tabular-nums text-muted-foreground">
        <span>BTC {formatUsd(d.btcUsd)}</span>
        <span>Gold {formatUsd(d.xauUsd)}</span>
      </div>
    </div>
  );
};

const BtcXauWidget = ({ range, onRangeChange }: { range: Range; onRangeChange: (r: Range) => void }) => {
  const current = useBtcXauCurrent();
  const history = useBtcXauHistory();
  const isLoading = current.isLoading || history.isLoading;
  const error = current.error || history.error;

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error as Error} />;
  if (!current.data || !history.data) return null;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-foreground">
            {formatRatio(current.data.ratio)}
          </span>
          <span className="text-base text-muted-foreground font-medium">oz gold / BTC</span>
          <ChangeBadge value={current.data.ratioChange24h} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard label="1 oz Gold" value={`${formatInverse(current.data.inverse)} BTC`} />
          <MetricCard label="BTC/USD" value={formatUsd(current.data.btcUsd)} />
          <MetricCard label="XAU/USD" value={formatUsd(current.data.xauUsd)} sub="via XAUT" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">BTC/XAU Ratio</span>
          <RangeSwitch range={range} onChange={onRangeChange} />
        </div>
        <RatioChart
          data={history.data.series}
          range={range}
          formatY={formatRatio}
          tooltip={BtcXauTooltip}
        />
      </div>
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        BTC and gold prices via CoinGecko (live). Gold tracked via XAUT (Tether Gold, 1 token = 1 troy oz).
        Ratio = BTC/USD &divide; XAU/USD. Refreshes every 30s.
      </p>
    </>
  );
};

// ─── ETH / BTC widget ─────────────────────────────────────────────────────────

const EthBtcTooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: EthBtcPoint }> }) => {
  if (!active || !payload?.[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-popover-border rounded-lg px-3 py-2 shadow-md text-xs">
      <div className="font-medium text-foreground mb-1">{d.date}</div>
      <div className="tabular-nums text-muted-foreground">
        <span className="text-foreground font-semibold">{formatInverse(d.ratio)} BTC</span> / ETH
      </div>
      <div className="flex gap-3 mt-1 tabular-nums text-muted-foreground">
        <span>ETH {formatUsd(d.ethUsd)}</span>
        <span>BTC {formatUsd(d.btcUsd)}</span>
      </div>
    </div>
  );
};

const EthBtcWidget = ({ range, onRangeChange }: { range: Range; onRangeChange: (r: Range) => void }) => {
  const current = useEthBtcCurrent();
  const history = useEthBtcHistory();
  const isLoading = current.isLoading || history.isLoading;
  const error = current.error || history.error;

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error as Error} />;
  if (!current.data || !history.data) return null;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-foreground">
            {formatInverse(current.data.ratio)}
          </span>
          <span className="text-base text-muted-foreground font-medium">BTC / ETH</span>
          <ChangeBadge value={current.data.ratioChange24h} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard label="1 BTC" value={`${formatRatio(current.data.inverse)} ETH`} />
          <MetricCard label="ETH/USD" value={formatUsd(current.data.ethUsd)} />
          <MetricCard label="BTC/USD" value={formatUsd(current.data.btcUsd)} />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">ETH/BTC Ratio</span>
          <RangeSwitch range={range} onChange={onRangeChange} />
        </div>
        <RatioChart
          data={history.data.series}
          range={range}
          formatY={formatInverse}
          tooltip={EthBtcTooltip}
        />
      </div>
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        ETH and BTC prices via CoinGecko (live). Ratio = ETH/USD &divide; BTC/USD. Refreshes every 30s.
      </p>
    </>
  );
};

// ─── USD / SAT widget ─────────────────────────────────────────────────────────

const UsdSatTooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: UsdSatPoint }> }) => {
  if (!active || !payload?.[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-popover-border rounded-lg px-3 py-2 shadow-md text-xs">
      <div className="font-medium text-foreground mb-1">{d.date}</div>
      <div className="tabular-nums text-muted-foreground">
        <span className="text-foreground font-semibold">{Math.round(d.ratio).toLocaleString()} sats</span> / $1
      </div>
      <div className="mt-1 tabular-nums text-muted-foreground">
        <span>BTC {formatUsd(d.btcUsd)}</span>
      </div>
    </div>
  );
};

const UsdSatWidget = ({ range, onRangeChange }: { range: Range; onRangeChange: (r: Range) => void }) => {
  // Derived from BTC/XAU data — no extra API calls needed
  const current = useBtcXauCurrent();
  const history = useBtcXauHistory();
  const isLoading = current.isLoading || history.isLoading;
  const error = current.error || history.error;

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error as Error} />;
  if (!current.data || !history.data) return null;

  const btcUsd = current.data.btcUsd;
  const satRatio = 100_000_000 / btcUsd;
  const satInverse = btcUsd / 100_000_000;
  // sats/dollar change is inverse of BTC price change
  const ratioChange24h = (1 / (1 + current.data.btcChange24h / 100) - 1) * 100;

  const series = history.data.series.map((d) => ({
    date: d.date,
    ratio: 100_000_000 / d.btcUsd,
    btcUsd: d.btcUsd,
  }));

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-foreground">
            {Math.round(satRatio).toLocaleString()}
          </span>
          <span className="text-base text-muted-foreground font-medium">sats / $1</span>
          <ChangeBadge value={ratioChange24h} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard label="1 sat" value={`$${formatInverse(satInverse)}`} />
          <MetricCard label="BTC/USD" value={formatUsd(btcUsd)} />
          <MetricCard label="1,000 sats" value={formatUsdCents(satInverse * 1_000)} />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Sats per Dollar</span>
          <RangeSwitch range={range} onChange={onRangeChange} />
        </div>
        <RatioChart
          data={series}
          range={range}
          formatY={(v) => Math.round(v).toLocaleString()}
          tooltip={UsdSatTooltip}
        />
      </div>
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        Derived from BTC price via CoinGecko (live). Ratio = 100,000,000 &divide; BTC/USD. Fewer sats per dollar means stronger BTC. Refreshes every 30s.
      </p>
    </>
  );
};

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const widgetId = (searchParams.get("widget") as WidgetId) ?? "btc-xau";
  const range = (searchParams.get("range") as Range) ?? "90d";

  const setWidget = (w: WidgetId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("widget", w);
    router.replace(`/?${params}`, { scroll: false });
  };

  const setRange = (r: Range) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", r);
    router.replace(`/?${params}`, { scroll: false });
  };

  const activeWidget = WIDGETS.find((w) => w.id === widgetId) ?? WIDGETS[0];

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <LogoMark text={activeWidget.logoText} />
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-1 text-base font-semibold text-foreground tracking-tight hover:text-muted-foreground transition-colors"
              >
                {activeWidget.label}
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 bg-popover border border-popover-border rounded-lg shadow-lg py-1 min-w-35 z-10">
                  {WIDGETS.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => { setWidget(w.id); setDropdownOpen(false); }}
                      className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                          w.id === widgetId ? "opacity-100 text-primary" : "opacity-0"
                        }`}
                      />
                      <span className={w.id === widgetId ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {w.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <ThemeToggle />
        </header>

        <Card className="border-card-border bg-card shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-5">
            {widgetId === "btc-xau" && <BtcXauWidget range={range} onRangeChange={setRange} />}
            {widgetId === "eth-btc" && <EthBtcWidget range={range} onRangeChange={setRange} />}
            {widgetId === "usd-sat" && <UsdSatWidget range={range} onRangeChange={setRange} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
