import { getTokenPricesMapping } from "@/hooks/portfolio/utils";
import { GetPoolsQuery, OrderDirection, Pool_OrderBy, getSdk } from "@/hooks/queries/gql-generated-swapr";
import { SupportedChain, gnosis } from "@/lib/chains";
import { COLLATERAL_TOKENS } from "@/lib/config";
import { Market, getCollateralByIndex, getMarketStatus } from "@/lib/market";
import { fetchMarkets } from "@/lib/markets-fetch";
import { swaprGraphQLClient, uniswapGraphQLClient } from "@/lib/subgraph";
import { isTwoStringsEqual } from "@/lib/utils";
import { Address } from "viem";
import { getAllTransfers, getHoldersAtTimestamp } from "./utils/airdropCalculation/getAllTransfers";
import { getsDaiPriceByChainMapping } from "./utils/getMarketsLiquidity";

async function getTopPredictors(markets: Market[], chainId: SupportedChain) {
  const transfers = await getAllTransfers(chainId);
  const resolvedMarkets = markets.filter((market) => market.payoutReported && market.finalizeTs > 0);
  // // get all transfers
  const predictorToWinningMarketsMapping: { [key: string]: { totalPredictionCount: number; markets: Market[] } } = {};
  for (const market of resolvedMarkets) {
    const timestamp = Number(market.finalizeTs);
    const winningTokens = market.wrappedTokens.filter((_, index) => Number(market.payoutNumerators[index]) > 0);
    // check who hold the most winning tokens
    const holdersAtTimestamp = getHoldersAtTimestamp(transfers, timestamp);
    Object.entries(holdersAtTimestamp).map(([holderAddress, tokenBalanceMapping]) => {
      if (!predictorToWinningMarketsMapping[holderAddress]) {
        predictorToWinningMarketsMapping[holderAddress] = {
          totalPredictionCount: 0,
          markets: [],
        };
      }
      const wrappedTokensMapping = market.wrappedTokens.reduce(
        (acc, curr) => {
          acc[curr] = tokenBalanceMapping[curr] ?? 0;
          return acc;
        },
        {} as { [key: string]: number },
      );

      //make sure they don't hold the same amount of all wrappedTokens (split only) or hold nothing
      const isHolderSplitOnly = new Set(Object.values(wrappedTokensMapping)).size === 1;
      const isHasBalance = Math.max(...Object.values(wrappedTokensMapping)) > 0;
      if (!isHolderSplitOnly && isHasBalance) {
        predictorToWinningMarketsMapping[holderAddress].totalPredictionCount++;
        //check if the token(s) they hold the most is in winning list
        let mostHoldBalance = Object.values(wrappedTokensMapping)[0];
        for (let i = 0; i < Object.values(wrappedTokensMapping).length; i++) {
          if (Object.values(wrappedTokensMapping)[i] > mostHoldBalance) {
            mostHoldBalance = Object.values(wrappedTokensMapping)[i];
          }
        }
        const mostHoldTokens = Object.keys(wrappedTokensMapping).filter(
          (_, index) => Object.values(wrappedTokensMapping)[index] === mostHoldBalance,
        );
        if (mostHoldTokens.some((token) => winningTokens.includes(token as Address))) {
          predictorToWinningMarketsMapping[holderAddress].markets.push(market);
        }
      }
    });
  }
  const finalData = [];
  for (const [predictor, { totalPredictionCount, markets }] of Object.entries(predictorToWinningMarketsMapping)) {
    if (markets.length) {
      finalData.push({
        predictor,
        totalPredictionCount,
        correctPredictionCount: markets.length,
        markets: markets.map((market) => {
          return {
            id: market.id,
            name: market.marketName,
            url: market.url,
            chainId,
            resolvedAt: new Date(market.finalizeTs * 1000),
          };
        }),
      });
    }
  }
  finalData.sort((a, b) => {
    if (b.markets.length !== a.markets.length) {
      return b.markets.length - a.markets.length;
    }
    return a.totalPredictionCount - b.totalPredictionCount;
  });
  return finalData;
}

async function getAllPools(
  tokens: {
    tokenId: `0x${string}`;
  }[],
  chainId: SupportedChain,
) {
  const subgraphClient = chainId === gnosis.id ? swaprGraphQLClient(chainId, "algebra") : uniswapGraphQLClient(chainId);
  if (!subgraphClient) {
    return [];
  }
  const maxAttempts = 20;
  let attempt = 0;
  let id = undefined;
  let total: GetPoolsQuery["pools"] = [];
  while (attempt < maxAttempts) {
    const { pools } = await getSdk(subgraphClient).GetPools({
      where: {
        and: [
          {
            or: tokens.reduce(
              (acc, { tokenId }) => {
                acc.push({ token0: tokenId.toLocaleLowerCase() }, { token1: tokenId.toLocaleLowerCase() });
                return acc;
              },
              [] as { [key: string]: string }[],
            ),
          },
          { id_lt: id },
        ],
      },
      first: 1000,
      orderBy: Pool_OrderBy.Id,
      orderDirection: OrderDirection.Desc,
    });
    total = total.concat(pools);
    if (pools[pools.length - 1]?.id === id) {
      break;
    }
    if (pools.length < 1000) {
      break;
    }
    id = pools[pools.length - 1]?.id;
    attempt++;
  }
  return total;
}

async function getMarketsVolume(markets: Market[], chainId: SupportedChain, sDaiPrice: number) {
  const marketIdToMarket = markets.reduce(
    (acum, market) => {
      acum[market.id] = {
        ...market,
        marketStatus: getMarketStatus(market),
      };
      return acum;
    },
    {} as Record<Address, Market & { marketStatus: string }>,
  );
  const tokenToMarket = markets.reduce(
    (acum, market) => {
      for (let i = 0; i < market.wrappedTokens.length; i++) {
        const tokenId = market.wrappedTokens[i];
        acum[tokenId] = market;
      }
      return acum;
    },
    {} as Record<Address, Market>,
  );

  const allTokensIds = Object.keys(tokenToMarket) as Address[];
  const tokens = allTokensIds.map((tokenId) => {
    const market = tokenToMarket[tokenId];
    const parentMarket = marketIdToMarket[market.parentMarket.id];
    const tokenIndex = market.wrappedTokens.indexOf(tokenId);
    return {
      tokenId,
      parentMarketId: parentMarket?.id,
      collateralToken: getCollateralByIndex(market, tokenIndex),
      tokenIndex,
    };
  });
  const pools = await getAllPools(tokens, chainId);

  const tokenPriceMapping = getTokenPricesMapping(tokens, pools, chainId);
  const marketsVolume = markets.map((market) => {
    let totalVolume = 0;
    for (const tokenId of market.wrappedTokens) {
      const market = tokenToMarket[tokenId];
      const parentMarket = marketIdToMarket[market.parentMarket.id];
      const parentTokenId = parentMarket
        ? parentMarket.wrappedTokens[Number(market.parentOutcome)]
        : COLLATERAL_TOKENS[chainId].primary.address.toLocaleLowerCase();
      const tokenPools = pools.filter(
        (pool) =>
          isTwoStringsEqual(pool.token0.id, tokenId > parentTokenId ? parentTokenId : tokenId) &&
          isTwoStringsEqual(pool.token1.id, tokenId > parentTokenId ? tokenId : parentTokenId),
      );
      for (const pool of tokenPools) {
        const [volumeToken, volumeCollateral] =
          tokenId > parentTokenId
            ? [Number(pool.volumeToken1), Number(pool.volumeToken0)]
            : [Number(pool.volumeToken0), Number(pool.volumeToken1)];
        const tokenPriceInSDai = tokenPriceMapping[tokenId] || 1 / (market.wrappedTokens.length - 1);
        const collateralPriceInSDai = isTwoStringsEqual(parentTokenId, COLLATERAL_TOKENS[chainId].primary.address)
          ? 1
          : tokenPriceMapping[parentTokenId] || (parentMarket ? 1 / (parentMarket.wrappedTokens.length - 1) : 0);
        const volumeUSD =
          (tokenPriceInSDai * volumeToken + collateralPriceInSDai * volumeCollateral) * (sDaiPrice ?? 1.13);
        totalVolume += volumeUSD;
      }
    }
    return {
      id: market.id,
      marketName: market.marketName,
      totalVolume,
      url: market.url,
      chainId: market.chainId,
      resolved: market.payoutReported && market.finalizeTs > 0,
      createdAt: market.blockTimestamp ? new Date(market.blockTimestamp * 1000) : undefined,
    };
  });
  marketsVolume.sort((a, b) => b.totalVolume - a.totalVolume);
  return marketsVolume.filter((x) => x.totalVolume > 0 && !x.resolved);
}

async function writeToSheet(data: string) {
  const googleAppScriptUrl = process.env.GOOGLE_APP_SCRIPT_URL;
  if (!googleAppScriptUrl) {
    return;
  }
  try {
    const response = await fetch(googleAppScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Data written successfully:", result);
  } catch (error) {
    console.error("Error writing to sheet:", error);
  }
}

export default async () => {
  const { markets } = await fetchMarkets();
  const sDaiPriceByChainMapping = await getsDaiPriceByChainMapping();
  const predictors = await getTopPredictors(
    markets.filter((x) => x.chainId === gnosis.id),
    gnosis.id,
  );
  const marketsVolume = await getMarketsVolume(
    markets.filter((x) => x.chainId === gnosis.id),
    gnosis.id,
    sDaiPriceByChainMapping[gnosis.id],
  );

  const predictorsToRows = [
    ["User", "Total Predict", "Correct Predict"],
    ...predictors.map((x) => [x.predictor, x.totalPredictionCount, x.correctPredictionCount]),
  ];
  const predictorsMarketsToRows = [
    ["User", "Market Id", "Market Name", "Market Url", "Market Resolved Date"],
    ...predictors.flatMap((x) =>
      x.markets.map((market) => [
        x.predictor,
        market.id,
        market.name,
        `https://app.seer.pm/markets/${market.chainId}/${market.url}`,
        market.resolvedAt,
      ]),
    ),
  ];
  const trendingMarkets = [
    ["Market Id", "Market Name", "Created At", "Market Url", "Volume USD"],
    ...marketsVolume.map((market) => [
      market.id,
      market.marketName,
      market.createdAt,
      `https://app.seer.pm/markets/${market.chainId}/${market.url}`,
      market.totalVolume,
    ]),
  ];
  await writeToSheet(
    JSON.stringify({ predictors: predictorsToRows, predictorsMarkets: predictorsMarketsToRows, trendingMarkets }),
  );
};
