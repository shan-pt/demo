import { Market } from "@/hooks/useMarket";
import { MarketStatus, useMarketStatus } from "@/hooks/useMarketStatus";
import { useResolveMarket } from "@/hooks/useResolveMarket";
import { SupportedChain } from "@/lib/chains";
import { CalendarIcon, CategoryIcon, CheckCircleIcon, DaiLogo, HourGlassIcon, RightArrow } from "@/lib/icons";
import { getMarketType, getOpeningTime } from "@/lib/market";
import { getAnswerText, getRealityLink } from "@/lib/reality";
import { getTimeLeft } from "@/lib/utils";
import clsx from "clsx";
import { TransactionReceipt } from "viem";

interface MarketHeaderProps {
  market: Market;
  chainId: SupportedChain;
}

const STATUS_TEXTS: Record<MarketStatus, string> = {
  [MarketStatus.NOT_OPEN]: "Market not open yet",
  [MarketStatus.OPEN]: "Market open",
  [MarketStatus.ANSWER_NOT_FINAL]: "Waiting for answer",
  [MarketStatus.PENDING_EXECUTION]: "Pending execution",
  [MarketStatus.CLOSED]: "Closed",
};

export const COLORS: Record<MarketStatus, { border: string; bg: string; text: string; dot: string }> = {
  [MarketStatus.NOT_OPEN]: {
    border: "border-t-black-secondary",
    bg: "bg-black-light",
    text: "text-black-secondary",
    dot: "bg-black-secondary",
  },
  [MarketStatus.OPEN]: {
    border: "border-t-purple-primary",
    bg: "bg-purple-medium",
    text: "text-purple-primary",
    dot: "bg-purple-primary",
  },
  [MarketStatus.ANSWER_NOT_FINAL]: {
    border: "border-t-warning-primary",
    bg: "bg-warning-light",
    text: "text-warning-primary",
    dot: "bg-warning-primary",
  },
  [MarketStatus.PENDING_EXECUTION]: {
    border: "border-t-tint-blue-primary",
    bg: "bg-tint-blue-light",
    text: "text-tint-blue-primary",
    dot: "bg-tint-blue-primary",
  },
  [MarketStatus.CLOSED]: {
    border: "border-t-success-primary",
    bg: "bg-success-light",
    text: "text-success-primary",
    dot: "bg-success-primary",
  },
};

function MarketInfo({
  market,
  marketStatus,
  chainId,
}: { market: Market; marketStatus: MarketStatus; chainId: SupportedChain }) {
  const resolveMarket = useResolveMarket((_receipt: TransactionReceipt) => {
    alert("Market resolved!");
  });

  const resolveHandler = async () => {
    resolveMarket.mutateAsync({
      marketId: market.id,
    });
  };

  if (marketStatus === MarketStatus.NOT_OPEN) {
    return (
      <div className="flex items-center space-x-2">
        <CalendarIcon /> <div>Opening at {getOpeningTime(market)}</div>
      </div>
    );
  }

  if (marketStatus === MarketStatus.OPEN) {
    return (
      <div className="flex items-center space-x-2">
        <a
          className="text-purple-primary"
          href={getRealityLink(chainId, market.questionId)}
          target="_blank"
          rel="noreferrer"
        >
          Answer on Reality.eth
        </a>
        <RightArrow />
      </div>
    );
  }

  if (marketStatus === MarketStatus.ANSWER_NOT_FINAL) {
    return (
      <div className="flex items-center space-x-[12px]">
        <div className="flex items-center space-x-2">
          <HourGlassIcon />
          <div>Answer: {getAnswerText(market.questions[0], market.outcomes, market.templateId)}</div>
        </div>
        <div className="text-black-medium">|</div>
        <div className="flex items-center space-x-2">
          <div className="text-black-secondary">
            If this is not correct, you can correct it within {getTimeLeft(market.questions[0].finalize_ts)} on{" "}
            <a
              className="text-purple-primary"
              href={getRealityLink(chainId, market.questionId)}
              target="_blank"
              rel="noreferrer"
            >
              Reality.eth
            </a>
          </div>
          <RightArrow />
        </div>
      </div>
    );
  }

  //marketStatus === MarketStatus.PENDING_EXECUTION || marketStatus === MarketStatus.CLOSED
  return (
    <div className="flex items-center space-x-[12px]">
      <div className="flex items-center space-x-2">
        {marketStatus === MarketStatus.PENDING_EXECUTION && <HourGlassIcon />}
        {marketStatus === MarketStatus.CLOSED && <CheckCircleIcon />}
        <div>Answer: {getAnswerText(market.questions[0], market.outcomes, market.templateId)}</div>
      </div>
      <div className="text-black-medium">|</div>
      <div className="flex items-center space-x-2">
        {marketStatus === MarketStatus.PENDING_EXECUTION && (
          <div className="text-purple-primary" onClick={resolveHandler}>
            Report Answer
          </div>
        )}
        {marketStatus === MarketStatus.CLOSED && (
          <a
            className="text-purple-primary"
            href={getRealityLink(chainId, market.questionId)}
            target="_blank"
            rel="noreferrer"
          >
            Check it on Reality.eth
          </a>
        )}
        <RightArrow />
      </div>
    </div>
  );
}

export function MarketHeader({ market, chainId }: MarketHeaderProps) {
  const { data: marketStatus } = useMarketStatus(market, chainId);

  const colors = marketStatus && COLORS[marketStatus];

  return (
    <div className="bg-white rounded-[3px] drop-shadow">
      <div
        className={clsx(
          "flex justify-between border-t border-t-[5px] text-[14px] px-[25px] h-[45px] items-center",
          colors?.border,
          colors?.bg,
          colors?.text,
        )}
      >
        <div className="flex items-center space-x-2">
          <div className={clsx("w-[8px] h-[8px] rounded-full", colors?.dot)}></div>
          {marketStatus && <div>{STATUS_TEXTS[marketStatus]}</div>}
        </div>
        <div>#57</div>
      </div>
      <div className="flex space-x-3 p-[24px]">
        <div>
          <div className="w-[70px] h-[70px] rounded-full bg-purple-primary"></div>
        </div>
        <div>
          <div className="text-[24px] font-semibold mb-1">{market.marketName}</div>
          <div className={clsx("text-[14px]", colors?.text)}>
            {market && marketStatus && <MarketInfo market={market} marketStatus={marketStatus} chainId={chainId} />}
          </div>
        </div>
      </div>
      <div className="border-t border-[#E5E5E5] px-[25px] h-[45px] flex items-center justify-between text-[14px]">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <CategoryIcon /> <div>{getMarketType(market)}</div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[#999999]">Open interest:</span> <div>15M DAI</div> <DaiLogo />
          </div>
        </div>
        <div className="text-[#00C42B] flex items-center space-x-2">
          <CheckCircleIcon />
          <div>Verified</div>
        </div>
      </div>
    </div>
  );
}