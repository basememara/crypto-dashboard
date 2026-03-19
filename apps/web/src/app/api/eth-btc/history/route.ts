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
    const [ethHist, btcHist] = await Promise.all([
      fetchMarketChart("ethereum"),
      fetchMarketChart("bitcoin"),
    ]);

    if (!ethHist?.prices?.length || !btcHist?.prices?.length) {
      throw new Error("Incomplete history data from CoinGecko");
    }

    const toDateKey = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const btcByDate = new Map(btcHist.prices.map(([ts, price]) => [toDateKey(ts), price]));

    const series = ethHist.prices
      .map(([ts, ethUsd]) => {
        const date = toDateKey(ts);
        const btcUsd = btcByDate.get(date);
        if (!btcUsd || btcUsd <= 0) return null;
        return { date, ratio: ethUsd / btcUsd, ethUsd, btcUsd };
      })
      .filter(Boolean) as Array<{ date: string; ratio: number; ethUsd: number; btcUsd: number }>;

    return NextResponse.json({ series });
  } catch (err) {
    console.error("ETH/BTC history:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
