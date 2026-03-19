import { useQuery } from "@tanstack/react-query";

type CurrentData = {
  ratio: number;
  inverse: number;
  btcUsd: number;
  xauUsd: number;
  btcChange24h: number;
  ratioChange24h: number;
  updatedAt: string;
};

type HistoryData = {
  series: Array<{ date: string; ratio: number; btcUsd: number; xauUsd: number }>;
};

const apiFetch = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((data) => { if (data.error) throw new Error(data.error); return data; });

export const useBtcXauCurrent = () =>
  useQuery<CurrentData>({
    queryKey: ["ratio-current"],
    queryFn: () => apiFetch("/api/btc-xau/current"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

export const useBtcXauHistory = () =>
  useQuery<HistoryData>({
    queryKey: ["ratio-history"],
    queryFn: () => apiFetch("/api/btc-xau/history"),
    staleTime: 3 * 60 * 60 * 1000,
  });
