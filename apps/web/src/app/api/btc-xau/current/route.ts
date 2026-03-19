import { NextResponse } from "next/server";

type CoinGeckoPrice = {
  bitcoin: { usd: number; usd_24h_change: number };
  "tether-gold": { usd: number; usd_24h_change: number };
};

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tether-gold&vs_currencies=usd&include_24hr_change=true",
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const prices = await res.json() as CoinGeckoPrice;

    const btcUsd = prices?.bitcoin?.usd;
    const btc24hChange = prices?.bitcoin?.usd_24h_change;
    const xauUsd = prices?.["tether-gold"]?.usd;
    const xau24hChange = prices?.["tether-gold"]?.usd_24h_change;

    if (!btcUsd || !xauUsd) throw new Error("Incomplete price data from CoinGecko");

    const ratio = btcUsd / xauUsd;
    const inverse = 1 / ratio;
    const btcUsd24hAgo = btcUsd / (1 + (btc24hChange ?? 0) / 100);
    const xauUsd24hAgo = xauUsd / (1 + (xau24hChange ?? 0) / 100);
    const ratioChange24h = ((ratio - btcUsd24hAgo / xauUsd24hAgo) / (btcUsd24hAgo / xauUsd24hAgo)) * 100;

    return NextResponse.json({ ratio, inverse, btcUsd, xauUsd, btcChange24h: btc24hChange ?? 0, ratioChange24h, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("BTC/XAU current:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
