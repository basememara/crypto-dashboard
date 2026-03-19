import { NextResponse } from "next/server";

type CoinGeckoPrice = {
  ethereum: { usd: number; usd_24h_change: number };
  bitcoin: { usd: number; usd_24h_change: number };
};

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd&include_24hr_change=true",
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const prices = await res.json() as CoinGeckoPrice;

    const ethUsd = prices?.ethereum?.usd;
    const eth24hChange = prices?.ethereum?.usd_24h_change;
    const btcUsd = prices?.bitcoin?.usd;
    const btc24hChange = prices?.bitcoin?.usd_24h_change;

    if (!ethUsd || !btcUsd) throw new Error("Incomplete price data from CoinGecko");

    const ratio = ethUsd / btcUsd;
    const inverse = btcUsd / ethUsd;
    const ethUsd24hAgo = ethUsd / (1 + (eth24hChange ?? 0) / 100);
    const btcUsd24hAgo = btcUsd / (1 + (btc24hChange ?? 0) / 100);
    const ratioChange24h = ((ratio - ethUsd24hAgo / btcUsd24hAgo) / (ethUsd24hAgo / btcUsd24hAgo)) * 100;

    return NextResponse.json({ ratio, inverse, ethUsd, btcUsd, ratioChange24h, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("ETH/BTC current:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
