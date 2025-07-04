import { getConfigNumber } from "@/lib/config";
import { MarketTypes, getMarketName, getOutcomes, getQuestionParts } from "@/lib/market";
import { escapeJson } from "@/lib/reality";
import { toastifyTx } from "@/lib/toastify";
import { config } from "@/wagmi";
import { useMutation } from "@tanstack/react-query";
import { Address, TransactionReceipt } from "viem";
import { writeMarketFactory } from "./contracts/generated-market-factory";

interface CreateMarketProps {
  marketType: MarketTypes;
  marketName: string;
  parentMarket: Address;
  parentOutcome: bigint;
  outcomes: string[];
  tokenNames: string[];
  lowerBound: bigint;
  upperBound: bigint;
  unit: string;
  category: string;
  openingTime: number;
  chainId?: number;
}

const MarketTypeFunction: Record<
  string,
  "createCategoricalMarket" | "createScalarMarket" | "createMultiCategoricalMarket" | "createMultiScalarMarket"
> = {
  [MarketTypes.CATEGORICAL]: "createCategoricalMarket",
  [MarketTypes.SCALAR]: "createScalarMarket",
  [MarketTypes.MULTI_CATEGORICAL]: "createMultiCategoricalMarket",
  [MarketTypes.MULTI_SCALAR]: "createMultiScalarMarket",
} as const;

function generateTokenName(outcome: string) {
  return outcome
    .replace(/[^\w\s]/gi, "") // remove special characters
    .replaceAll("_", " ") // replace underscores with spaces
    .replace(/ {2,}/g, " ") // remove consecutive spaces
    .trim() // trim
    .replaceAll(" ", "_") // replace spaces with underscore
    .toLocaleUpperCase() // uppercase
    .substring(0, 11); // 11 characters to follow the verification policy
}

function getTokenNames(tokenNames: string[], outcomes: string[]) {
  // we loop over `outcomes` because it's the return value of getOutcomes(),
  // that already has the correct outcomes for scalar markets
  return outcomes.map((outcome, i) =>
    (tokenNames[i].trim() !== "" ? tokenNames[i].trim() : generateTokenName(outcome)).slice(0, 31),
  );
}

export function getCreateMarketParams(props: CreateMarketProps) {
  const outcomes = getOutcomes(props.outcomes, props.marketType);
  const marketName = getMarketName(props.marketType, props.marketName, props.unit);
  const questionParts = getQuestionParts(marketName, props.marketType);

  return {
    marketName,
    questionStart: escapeJson(questionParts?.questionStart || ""),
    questionEnd: escapeJson(questionParts?.questionEnd || ""),
    outcomeType: escapeJson(questionParts?.outcomeType || ""),
    parentMarket: props.parentMarket,
    parentOutcome: props.parentOutcome,
    lang: "en_US",
    category: props.category || "misc",
    outcomes: outcomes.map(escapeJson),
    tokenNames: getTokenNames(props.tokenNames, outcomes),
    lowerBound: props.lowerBound,
    upperBound: props.upperBound,
    minBond: getConfigNumber("MIN_BOND", props.chainId),
    openingTime: props.openingTime,
  };
}

async function createMarket(props: CreateMarketProps): Promise<TransactionReceipt> {
  const result = await toastifyTx(
    () =>
      writeMarketFactory(config, {
        functionName: MarketTypeFunction[props.marketType],
        args: [getCreateMarketParams(props)],
      }),
    {
      txSent: { title: "Creating market..." },
      txSuccess: { title: "Market created!" },
    },
  );

  if (!result.status) {
    throw result.error;
  }

  return result.receipt;
}

export const useCreateMarket = (onSuccess: (data: TransactionReceipt) => void) => {
  return useMutation({
    mutationFn: createMarket,
    onSuccess,
  });
};
