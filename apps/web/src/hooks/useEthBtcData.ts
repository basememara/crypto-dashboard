import { useQuery } from "@tanstack/react-query";

type EthBtcCurrentData = {
  ratio: number;
  inverse: number;
  ethUsd: number;
  btcUsd: number;
  ratioChange24h: number;
  updatedAt: string;
};

type EthBtcHistoryData = {
  series: Array<{ date: string; ratio: number; ethUsd: number; btcUsd: number }>;
};

const apiFetch = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((data) => { if (data.error) throw new Error(data.error); return data; });

export const useEthBtcCurrent = () =>
  useQuery<EthBtcCurrentData>({
    queryKey: ["eth-btc-current"],
    queryFn: () => apiFetch("/api/eth-btc/current"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

export const useEthBtcHistory = () =>
  useQuery<EthBtcHistoryData>({
    queryKey: ["eth-btc-history"],
    queryFn: () => apiFetch("/api/eth-btc/history"),
    staleTime: 3 * 60 * 60 * 1000,
  });
