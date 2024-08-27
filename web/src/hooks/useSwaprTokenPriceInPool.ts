import { SupportedChain } from "@/lib/chains";
import { COLLATERAL_TOKENS } from "@/lib/config";
import { swaprGraphQLClient } from "@/lib/subgraph";
import { useQuery } from "@tanstack/react-query";
import { OrderDirection, PoolHourData_OrderBy, getSdk } from "./queries/generated";

async function getHistoryTokensPrices(tokens: string[] | undefined, chainId: SupportedChain, startTime: number) {
  if (!tokens) return {};
  const algebraClient = swaprGraphQLClient(chainId, "algebra");
  if (!algebraClient) {
    throw new Error("Subgraph not available");
  }
  const poolHourDatas = await Promise.all(
    tokens.map(async (token) => {
      const { poolHourDatas: data } = await getSdk(algebraClient).GetPoolHourDatas({
        first: 1,
        orderBy: PoolHourData_OrderBy.PeriodStartUnix,
        orderDirection: OrderDirection.Desc,
        where: {
          pool_:
            token.toLocaleLowerCase() > COLLATERAL_TOKENS[chainId].primary.address
              ? { token1: token.toLocaleLowerCase(), token0: COLLATERAL_TOKENS[chainId].primary.address }
              : { token0: token.toLocaleLowerCase(), token1: COLLATERAL_TOKENS[chainId].primary.address },
          periodStartUnix_lte: startTime,
        },
      });
      return data[0];
    }),
  );

  return poolHourDatas
    .filter((x) => x)
    .reduce(
      (acc, curr) => {
        const isToken0SDAI = curr.pool.token0.id === COLLATERAL_TOKENS[chainId].primary.address;
        const outcomeTokenAddress = isToken0SDAI ? curr.pool.token1.id : curr.pool.token0.id;
        const outcomeTokenPrice = isToken0SDAI
          ? Number(curr.token1Price) / Number(curr.token0Price)
          : Number(curr.token0Price) / Number(curr.token1Price);
        acc[outcomeTokenAddress] = outcomeTokenPrice;
        return acc;
      },
      {} as { [key: string]: number },
    );
}

async function getCurrentTokensPrices(tokens: string[] | undefined, chainId: SupportedChain) {
  if (!tokens) return {};
  const algebraClient = swaprGraphQLClient(chainId, "algebra");
  if (!algebraClient) {
    throw new Error("Subgraph not available");
  }

  const { pools } = await getSdk(algebraClient).GetPools({
    where: {
      or: tokens.map((token) =>
        token.toLocaleLowerCase() > COLLATERAL_TOKENS[chainId].primary.address
          ? { token1: token.toLocaleLowerCase(), token0: COLLATERAL_TOKENS[chainId].primary.address }
          : { token0: token.toLocaleLowerCase(), token1: COLLATERAL_TOKENS[chainId].primary.address },
      ),
    },
  });

  return pools.reduce(
    (acc, curr) => {
      const isToken0SDAI = curr.token0.id.toLocaleLowerCase() === COLLATERAL_TOKENS[chainId].primary.address;
      const outcomeTokenAddress = isToken0SDAI ? curr.token1.id : curr.token0.id;
      const outcomeTokenPrice = isToken0SDAI
        ? Number(curr.token1Price) / Number(curr.token0Price)
        : Number(curr.token0Price) / Number(curr.token1Price);
      acc[outcomeTokenAddress] = outcomeTokenPrice;
      return acc;
    },
    {} as { [key: string]: number },
  );
}

export const useHistoryTokensPrices = (tokens: string[] | undefined, chainId: SupportedChain, startTime: number) => {
  return useQuery<{ [key: string]: number } | undefined, Error>({
    enabled: !!tokens?.length,
    queryKey: ["useHistoryTokensPrice", tokens, chainId, startTime],
    retry: false,
    queryFn: async () => await getHistoryTokensPrices(tokens, chainId, startTime),
  });
};

export const useCurrentTokensPrices = (tokens: string[] | undefined, chainId: SupportedChain) => {
  return useQuery<{ [key: string]: number } | undefined, Error>({
    enabled: !!tokens?.length,
    queryKey: ["useCurrentTokensPrice", tokens, chainId],
    retry: false,
    queryFn: async () => await getCurrentTokensPrices(tokens, chainId),
  });
};
