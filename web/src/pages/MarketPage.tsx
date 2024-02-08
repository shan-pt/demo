import { Card } from "@/components/Card";
import { AnswerFormLink } from "@/components/Market/AnswerForm";
import { MergeForm } from "@/components/Market/MergeForm";
import { Positions } from "@/components/Market/Positions";
import { SplitForm } from "@/components/Market/SplitForm";
import { Market, useMarket } from "@/hooks/useMarket";
import { useMarketFactory } from "@/hooks/useMarketFactory";
import { MarketStatus, useMarketStatus } from "@/hooks/useMarketStatus";
import { getConfigAddress } from "@/lib/config";
import { getAnswerText, getCurrentBond } from "@/lib/reality";
import { displayBalance } from "@/lib/utils";
import { useParams } from "react-router-dom";
import { Address } from "viem";
import { useAccount } from "wagmi";

function MarketInfo({ market, marketStatus }: { market: Market; marketStatus: MarketStatus }) {
  if (marketStatus === MarketStatus.OPEN) {
    return <div>Closes on {new Date(market.question.opening_ts * 1000).toUTCString()}</div>;
  }

  if (marketStatus === MarketStatus.CLOSED) {
    return <div>CLOSED</div>;
  }

  if (marketStatus === MarketStatus.WAITING_RESULTS) {
    return (
      <div>
        <div>
          This market is not resolved yet. You can provide an answer below, depositing a bond of{" "}
          {displayBalance(getCurrentBond(market.question.bond, market.question.min_bond), 18)} DAI.
        </div>
        <div>
          Current answer: {getAnswerText(market)}. Closes on{" "}
          {new Date(market.question.finalize_ts * 1000).toUTCString()}
        </div>
        <div>
          <AnswerFormLink market={market} />
        </div>
      </div>
    );
  }

  return null;
}

function MarketPage() {
  const { chainId, address } = useAccount();
  const { id } = useParams();
  const { data: market, isError: isMarketError, isPending: isMarketPending } = useMarket(id as Address);
  const { data: marketFactory, isError: isFactoryError, isPending: isFactoryPending } = useMarketFactory(chainId);
  const { data: marketStatus } = useMarketStatus(market);

  const router = getConfigAddress("ROUTER", chainId);

  if (isMarketError || isFactoryError) {
    return (
      <div className="py-10 px-10">
        <div className="alert alert-error mb-5">Market not found</div>
      </div>
    );
  }

  if (isMarketPending || isFactoryPending || !router || !market || !marketFactory) {
    return (
      <div className="py-10 px-10">
        <span className="loading loading-spinner"></span>
      </div>
    );
  }

  return (
    <div className="py-10 px-10">
      <div className="space-y-5">
        <div className="text-4xl font-bold">{market.marketName}</div>
        {market && marketStatus && <MarketInfo market={market} marketStatus={marketStatus} />}

        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-8 space-y-5">
            {address && market && marketFactory && (
              <>
                <Positions address={address} router={router} market={market} marketFactory={marketFactory} />
                {/* show tokens, liquidity, etc */}
              </>
            )}
          </div>
          <div className="col-span-4 space-y-5">
            {marketStatus === MarketStatus.OPEN && (
              <>
                <Card title="Split Position">
                  <SplitForm
                    account={address}
                    router={router}
                    collateralToken={marketFactory.collateralToken}
                    collateralDecimals={marketFactory.collateralDecimals}
                    conditionId={market.conditionId}
                    outcomeSlotCount={market.outcomes.length}
                  />
                </Card>
                <Card title="Merge Positions">
                  <MergeForm
                    account={address}
                    router={router}
                    conditionalTokens={marketFactory.conditionalTokens}
                    collateralToken={marketFactory.collateralToken}
                    collateralDecimals={marketFactory.collateralDecimals}
                    conditionId={market.conditionId}
                    outcomeSlotCount={market.outcomes.length}
                  />
                </Card>
              </>
            )}
            {marketStatus === MarketStatus.CLOSED && <div>Redeem</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketPage;