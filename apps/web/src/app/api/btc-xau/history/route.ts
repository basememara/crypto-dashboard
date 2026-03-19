import { NextResponse } from "next/server";

const THREE_HOURS = 3 * 60 * 60;

const fetchMarketChart = async (coinId: string) => {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=365&interval=daily`,
    { next: { revalidate: THREE_HOURS } }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json() as Promise<{ prices: [number, number][] }>;
};

export async function GET() {
  try {
    const [btcHist, goldHist] = await Promise.all([
      fetchMarketChart("bitcoin"),
      fetchMarketChart("tether-gold"),
    ]);

    if (!btcHist?.prices?.length || !goldHist?.prices?.length) {
      throw new Error("Incomplete history data from CoinGecko");
    }

    const toDateKey = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const goldByDate = new Map(goldHist.prices.map(([ts, price]) => [toDateKey(ts), price]));

    const series = btcHist.prices
      .map(([ts, btcUsd]) => {
        const date = toDateKey(ts);
        const xauUsd = goldByDate.get(date);
        if (!xauUsd || xauUsd <= 0) return null;
        return { date, ratio: btcUsd / xauUsd, btcUsd, xauUsd };
      })
      .filter(Boolean) as Array<{ date: string; ratio: number; btcUsd: number; xauUsd: number }>;

    return NextResponse.json({ series });
  } catch (err) {
    console.error("BTC/XAU history:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
