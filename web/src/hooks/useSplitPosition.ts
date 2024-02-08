import { RouterAbi } from "@/abi/RouterAbi";
import { generateBasicPartition } from "@/lib/conditional-tokens";
import { queryClient } from "@/lib/query-client";
import { config } from "@/wagmi";
import { useMutation } from "@tanstack/react-query";
import { readContract, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { Address, TransactionReceipt, parseUnits, stringToHex } from "viem";
import { erc20Abi } from "viem";

interface SplitPositionProps {
  account: Address;
  router: Address;
  conditionId: `0x${string}`;
  collateralToken: Address;
  collateralDecimals: number;
  outcomeSlotCount: number;
  amount: number;
}

async function splitPosition(props: SplitPositionProps): Promise<TransactionReceipt> {
  const allowance = await readContract(config, {
    abi: erc20Abi,
    address: props.collateralToken,
    functionName: "allowance",
    args: [props.account, props.router],
  });

  const parsedAmount = parseUnits(String(props.amount), props.collateralDecimals);

  if (allowance < parsedAmount) {
    const hash = await writeContract(config, {
      address: props.collateralToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [props.router, parsedAmount],
    });

    await waitForTransactionReceipt(config, {
      confirmations: 0,
      hash,
    });
  }

  const hash = await writeContract(config, {
    address: props.router,
    abi: RouterAbi,
    functionName: "splitPosition",
    args: [
      props.collateralToken,
      stringToHex("", { size: 32 }),
      props.conditionId,
      generateBasicPartition(props.outcomeSlotCount),
      BigInt(parsedAmount),
    ],
  });

  const transactionReceipt = await waitForTransactionReceipt(config, {
    confirmations: 0,
    hash,
  });

  return transactionReceipt as TransactionReceipt;
}

export const useSplitPosition = (onSuccess: (data: TransactionReceipt) => unknown) => {
  return useMutation({
    mutationFn: splitPosition,
    onSuccess: (data: TransactionReceipt) => {
      queryClient.invalidateQueries({ queryKey: ["usePositions"] });
      queryClient.invalidateQueries({ queryKey: ["useERC20Balance"] });
      onSuccess(data);
    },
  });
};