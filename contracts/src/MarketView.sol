// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Market} from "./Market.sol";
import {IConditionalTokens} from "./Interfaces.sol";

interface IMarketFactory {
    function allMarkets() external view returns (address[] memory);

    function conditionalTokens() external view returns (IConditionalTokens);

    function realitio() external view returns (IRealityETH_v3_0);
}

interface IRealityETH_v3_0 {
    struct Question {
        bytes32 content_hash;
        address arbitrator;
        uint32 opening_ts;
        uint32 timeout;
        uint32 finalize_ts;
        bool is_pending_arbitration;
        uint256 bounty;
        bytes32 best_answer;
        bytes32 history_hash;
        uint256 bond;
        uint256 min_bond;
    }

    function questions(bytes32 question_id) external view returns (Question memory);
}

contract MarketView {
    struct MarketInfo {
        address id;
        string marketName;
        string[] outcomes;
        uint256 lowerBound;
        uint256 upperBound;
        bytes32 conditionId;
        bytes32 questionId;
        uint256 templateId;
        IRealityETH_v3_0.Question[] questions;
        bool payoutReported;
    }

    function getMarket(
        IConditionalTokens conditionalTokens,
        IRealityETH_v3_0 realitio,
        address marketId
    ) public view returns (MarketInfo memory) {
        Market market = Market(marketId);

        bytes32 conditionId = market.conditionId();

        uint256 outcomeSlotCount = conditionalTokens.getOutcomeSlotCount(
            conditionId
        );

        string[] memory outcomes = new string[](outcomeSlotCount);

        uint256 lowerBound = market.lowerBound();
        uint256 upperBound = market.upperBound();

        for (uint256 i = 0; i < outcomeSlotCount; i++) {
            outcomes[i] = market.outcomes(i);
        }

        uint256 questionsCount = market.getQuestionsCount();
        IRealityETH_v3_0.Question[] memory questions = new IRealityETH_v3_0.Question[](questionsCount);
        for (uint256 i = 0; i < questionsCount; i++) {
            questions[i] = realitio.questions(market.questionsIds(i));
        }

        return
            MarketInfo({
                id: marketId,
                marketName: market.marketName(),
                outcomes: outcomes,
                lowerBound: lowerBound,
                upperBound: upperBound,
                conditionId: conditionId,
                questionId: market.questionId(),
                templateId: market.templateId(),
                questions: questions,
                payoutReported: conditionalTokens.payoutDenominator(conditionId) > 0
            });
    }

    function getMarkets(
        uint256 count,
        IMarketFactory marketFactory
    ) external view returns (MarketInfo[] memory) {
        address[] memory allMarkets = marketFactory.allMarkets();

        MarketInfo[] memory marketsInfo = new MarketInfo[](count);

        if (allMarkets.length == 0) {
            return marketsInfo;
        }

        uint256 lastIndex = allMarkets.length - 1;
        uint256 startIndex = allMarkets.length > count
            ? allMarkets.length - count
            : 0;
        uint256 currentIndex = 0;

        for (uint256 j = lastIndex; j >= startIndex; j--) {
            marketsInfo[currentIndex++] = getMarket(
                marketFactory.conditionalTokens(),
                marketFactory.realitio(),
                allMarkets[j]
            );

            if (j == 0) {
                break;
            }
        }

        return marketsInfo;
    }
}
