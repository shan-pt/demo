import { iswxsDAI } from "@/hooks/trade";
import { useConvertToAssets } from "@/hooks/trade/handleSDAI";
import { useGetTradeInfo } from "@/hooks/trade/useGetTradeInfo";
import { COLLATERAL_TOKENS } from "@/lib/config";
import { RightArrow } from "@/lib/icons";
import { Token } from "@/lib/tokens";
import { isTwoStringsEqual } from "@/lib/utils";
import { CoWTrade, SwaprV3Trade, UniswapTrade } from "@swapr/sdk";
import { useState } from "react";
import { formatUnits } from "viem";
import { Alert } from "../../Alert";
import Button from "../../Form/Button";
import { Spinner } from "../../Spinner";
import { SwapTokensConfirmationInSteps } from "./SwapTokensConfirmationInSteps";

interface SwapTokensConfirmationProps {
  closeModal: () => void;
  reset: () => void;
  trade: CoWTrade | SwaprV3Trade | UniswapTrade | undefined;
  isLoading: boolean;
  onSubmit: (trade: CoWTrade | SwaprV3Trade | UniswapTrade) => Promise<void>;
  collateral: Token;
  originalAmount: string;
}

export function SwapTokensConfirmation({
  closeModal,
  reset,
  trade,
  isLoading,
  onSubmit,
  collateral,
  originalAmount,
}: SwapTokensConfirmationProps) {
  const [isInvertedPrice, toggleInvertedPrice] = useState(false);
  const tradeInfo = useGetTradeInfo(trade);
  const { data: outputToAssets } = useConvertToAssets(
    BigInt(trade?.outputAmount?.raw?.toString() ?? "0"),
    trade?.chainId ?? 0,
  );
  if (!tradeInfo) {
    return (
      <div className="flex flex-col justify-center items-center">
        <div className="w-[400px] h-[150px] flex items-center justify-center">
          <Spinner />
        </div>

        <div className="flex justify-center space-x-[24px] text-center mt-[32px]">
          <Button type="button" variant="secondary" text="Return" onClick={closeModal} />
        </div>
      </div>
    );
  }
  let {
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    price,
    minimumReceive,
    maximumSlippage,
    invertedPrice,
    inputAddress,
    outputAddress,
  } = tradeInfo;
  const sDAI = trade ? COLLATERAL_TOKENS[trade.chainId].primary.address : undefined;

  const needsToConvertCollateralToShares = iswxsDAI(collateral, trade?.chainId || 0);
  const isMultiStepsBuy =
    isTwoStringsEqual(inputAddress, sDAI) &&
    !isTwoStringsEqual(collateral.address, sDAI) &&
    needsToConvertCollateralToShares;
  const isMultiStepsSell =
    isTwoStringsEqual(outputAddress, sDAI) &&
    !isTwoStringsEqual(collateral.address, sDAI) &&
    needsToConvertCollateralToShares;

  inputAmount = isMultiStepsBuy ? Number(originalAmount).toFixed(6) : inputAmount;
  inputToken = isMultiStepsBuy ? collateral.symbol : inputToken;

  outputAmount = isMultiStepsSell
    ? Number(formatUnits(outputToAssets ?? 0n, collateral.decimals)).toFixed(6)
    : outputAmount;

  outputToken = (isMultiStepsSell ? collateral.symbol : outputToken)?.slice(0, 31);

  price = !isTwoStringsEqual(collateral.address, sDAI)
    ? (Number(outputAmount) / Number(inputAmount)).toFixed(6)
    : price;
  invertedPrice = !isTwoStringsEqual(collateral.address, sDAI) ? (1 / Number(price)).toFixed(6) : invertedPrice;

  return (
    <div className="flex flex-col justify-center items-center">
      {isMultiStepsBuy && (
        <div className="w-full mb-10 text-[14px]">
          Your {collateral.symbol} will be converted to sDAI before buying outcome tokens. This conversion may incur
          fees and affect the final amount you receive. You also need to approve the conversion transaction.
        </div>
      )}
      {isMultiStepsSell && (
        <div className="w-full mb-10 text-[14px]">
          sDAI you received after selling outcome tokens will be converted to {collateral.symbol}. This conversion may
          incur fees and affect the final amount you receive. You also need to approve the conversion transaction.
        </div>
      )}
      <div className="min-w-[400px] min-h-[150px]">
        <div className="flex items-center justify-between mb-5 gap-2">
          <p className="text-2xl break-words">
            {inputAmount} {inputToken}
          </p>
          <RightArrow />
          <p className="text-2xl break-words">
            {outputAmount} {outputToken}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p>Price</p>
          <p>
            {isInvertedPrice ? (
              <>
                {invertedPrice} {inputToken}/{outputToken}{" "}
              </>
            ) : (
              <>
                {price} {outputToken}/{inputToken}{" "}
              </>
            )}
            <span className="cursor-pointer" onClick={() => toggleInvertedPrice((state) => !state)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6 inline"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </span>
          </p>
        </div>
        <div className="flex items-center justify-between">
          <p>Minimum received</p>
          <p>
            {minimumReceive} {outputToken}
          </p>
        </div>
      </div>
      <Alert type="warning">
        Current slippage tolerance is {maximumSlippage}%. You will receive at least{" "}
        <span className="font-bold">
          {minimumReceive} {outputToken}
        </span>{" "}
        or the transaction will revert.
      </Alert>

      <div className="flex justify-center space-x-[24px] text-center mt-[32px]">
        <Button type="button" variant="secondary" text="Return" onClick={closeModal} />
        {isMultiStepsBuy || isMultiStepsSell ? (
          <SwapTokensConfirmationInSteps
            trade={trade!}
            isLoading={isLoading}
            collateral={collateral}
            originalAmount={originalAmount}
            onSubmit={onSubmit}
            swapType={isMultiStepsBuy ? "buy" : "sell"}
            closeModalAndReset={() => {
              closeModal();
              reset();
            }}
          />
        ) : (
          <Button
            variant="primary"
            type="submit"
            isLoading={isLoading}
            text="Continue"
            onClick={() => onSubmit(trade!)}
          />
        )}
      </div>
    </div>
  );
}
