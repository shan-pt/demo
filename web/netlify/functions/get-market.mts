import { SupportedChain, gnosis, mainnet, sepolia } from "@/lib/chains";
import { serializeMarket } from "@/lib/market";
import { http } from "@wagmi/core";
import { getSubgraphVerificationStatusList } from "./utils/curate";
import {
  SubgraphMarket,
  getDatabaseMarket,
  getMarketId,
  getSubgraphMarket,
  mapGraphMarketFromDbResult,
} from "./utils/markets";

/**
 * For individual market fetches, we prioritize real-time accuracy by querying both the database and subgraph.
 * This dual-source approach ensures we get the most up-to-date market data, as the database may contain
 * cached information that hasn't been refreshed recently. The subgraph provides the current on-chain state.
 */
export default async (req: Request) => {
  const body = await req.json();

  if (!body) {
    return new Response(JSON.stringify({ error: "Missing request body" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  if (!body.chainId || (!body.id && !body.url)) {
    return new Response(JSON.stringify({ error: "Missing required parameters: chainId and (id or url)" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  try {
    // Market URLs are stored in Supabase rather than on-chain. If a URL parameter is provided,
    // we first look up the corresponding market ID in Supabase before querying the subgraph.
    const id = await getMarketId(body.id, body.url);

    const [dbResult, subgraphMarket, verificationStatusList] = await Promise.allSettled([
      getDatabaseMarket(id),
      getSubgraphMarket(Number(body.chainId) as SupportedChain, id),
      getSubgraphVerificationStatusList(Number(body.chainId) as SupportedChain),
    ]);

    if (dbResult.status === "rejected") {
      throw new Error(`Market fetch failed: ${id}`);
    }

    if (subgraphMarket.status === "rejected") {
      console.log("Subgraph query failed");
    }

    const result = dbResult.value;

    const verification =
      verificationStatusList.status === "fulfilled" && verificationStatusList.value?.[id as `0x${string}`];
    if (verification !== undefined) {
      result.verification = verification;
    }

    const market = serializeMarket(
      mapGraphMarketFromDbResult(
        subgraphMarket.status === "fulfilled" ? subgraphMarket.value! : (result.subgraph_data as SubgraphMarket),
        result,
      ),
    );

    return new Response(JSON.stringify(market), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    console.log(e);
    return new Response(JSON.stringify({ error: e.message || "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
