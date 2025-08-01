import { getUsePoolHourDataSetsKey } from "@/hooks/chart/useChartData";
import { PoolHourDatasSets } from "@/hooks/chart/utils";
import { getUseGraphMarketKey } from "@/hooks/useMarket";
import { getUseGraphMarketsKey, useGraphMarketsQueryFn } from "@/hooks/useMarkets";
import { formatDate } from "@/lib/date";
import { fetchMarkets } from "@/lib/markets-fetch";
import { unescapeJson } from "@/lib/reality";
import { getAppUrl } from "@/lib/utils";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { Address } from "viem";

// biome-ignore lint/suspicious/noExplicitAny:
type QueryClientConfig = { queryKeyFn: () => any; data: any };
function getQueryClient(config: QueryClientConfig[]) {
  const queryClient = new QueryClient();

  for (const { queryKeyFn, data } of config) {
    queryClient.setQueryData(queryKeyFn(), data);
  }

  return queryClient;
}

async function fetchCharts(): Promise<Record<Address, PoolHourDatasSets>> {
  const response = await fetch(`${getAppUrl()}/.netlify/functions/markets-charts`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return await response.json();
}

export default async function onBeforePrerenderStart() {
  try {
    const { markets: allMarkets } = await fetchMarkets();
    const charts = await fetchCharts();
    // biome-ignore lint/suspicious/noExplicitAny:
    const data: { url: string; pageContext: any }[] = allMarkets
      .filter((market) => market.url && market.url.length < 120)
      .map((market) => {
        let description = "Efficient on-chain prediction markets.";
        try {
          description = `Answer opening date: ${`${formatDate(
            market.questions[0].opening_ts,
          )} UTC`}. Outcomes: ${market.outcomes.slice(0, -1).join(", ")}.`;
        } catch {}

        return {
          url: `/markets/${market.chainId}/${market.url}`,
          pageContext: {
            data: {
              title: `Seer | ${unescapeJson(market.marketName)}`,
              description,
            },
            dehydratedState: dehydrate(
              getQueryClient([
                {
                  queryKeyFn: () => getUseGraphMarketKey(market.id),
                  data: market,
                },
                {
                  queryKeyFn: () => getUseGraphMarketKey(market.url),
                  data: market,
                },
                {
                  queryKeyFn: () => getUsePoolHourDataSetsKey(market.chainId, market.id),
                  data: charts?.[market.id] || Array(market.wrappedTokens.length).fill([]),
                },
              ]),
            ),
          },
        };
      });
    // on the homepage we want to dehydrate the full list + the individual markets to preload each market page too
    const homeParams = {
      chainsList: [],
      marketName: "",
      categoryList: [],
      marketStatusList: [],
      verificationStatusList: [],
      showConditionalMarkets: false,
      showMarketsWithRewards: false,
      minLiquidity: 0,
      creator: "" as const,
      participant: "" as const,
      orderBy: undefined,
      orderDirection: undefined,
      marketIds: undefined,
      disabled: undefined,
      limit: 24,
      page: 1,
    };

    const homeMarketsResult = await useGraphMarketsQueryFn(homeParams);
    const homeMarkets = homeMarketsResult.markets;
    const homeMarketsConfig: QueryClientConfig[] = homeMarkets
      .filter((market) => market.url)
      .flatMap((market) => [
        {
          queryKeyFn: () => getUseGraphMarketKey(market.id),
          data: market,
        },
        {
          queryKeyFn: () => getUseGraphMarketKey(market.url),
          data: market,
        },
        {
          queryKeyFn: () => getUsePoolHourDataSetsKey(market.chainId, market.id),
          data: charts?.[market.id] || { chartData: [], timestamps: [] },
        },
      ]);

    const homePageConfig: QueryClientConfig = {
      queryKeyFn: () => getUseGraphMarketsKey(homeParams),
      data: homeMarketsResult,
    };

    data.push({
      url: "/",
      pageContext: {
        data: {},
        dehydratedState: dehydrate(getQueryClient([homePageConfig].concat(homeMarketsConfig))),
      },
    });

    return data;
    // biome-ignore lint/suspicious/noExplicitAny:
  } catch (e: any) {
    console.log(e);
    return [];
  }
}
