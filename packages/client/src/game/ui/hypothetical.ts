// In shared replays, players can enter a hypotheticals where can perform arbitrary actions in order
// to see what will happen.

import type {
  CardOrder,
  ColorIndex,
  PlayerIndex,
  RankClueNumber,
} from "@hanabi/data";
import { ClueType } from "@hanabi/game";
import { assertDefined, eRange } from "@hanabi/utils";
import * as playStacksRules from "../rules/playStacks";
import { ActionType } from "../types/ActionType";
import type { ClientAction } from "../types/ClientAction";
import type { MsgClue } from "../types/MsgClue";
import { ReplayActionType } from "../types/ReplayActionType";
import type { ActionIncludingHypothetical } from "../types/actions";
import type { HanabiCard } from "./HanabiCard";
import { setEmpathyOnHand } from "./HanabiCardMouse";
import { globals } from "./UIGlobals";
import { getTouchedCardsFromClue } from "./clues";
import { getCardOrStackBase } from "./getCardOrStackBase";

export function start(): void {
  if (globals.state.replay.hypothetical !== null) {
    return;
  }

  if (
    globals.state.replay.shared !== null &&
    globals.state.replay.shared.amLeader
  ) {
    globals.lobby.conn!.send("replayAction", {
      tableID: globals.lobby.tableID,
      type: ReplayActionType.HypoStart,
    });
  }

  globals.elements.toggleDrawnCardsButton!.setEnabled(true);

  globals.store!.dispatch({
    type: "hypoStart",
    showDrawnCards: false,
    actions: [],
  });
}

export function end(): void {
  if (globals.state.replay.hypothetical === null) {
    return;
  }

  if (
    globals.state.replay.shared !== null &&
    globals.state.replay.shared.amLeader
  ) {
    globals.lobby.conn!.send("replayAction", {
      tableID: globals.lobby.tableID,
      type: ReplayActionType.HypoEnd,
    });
  }

  globals.store!.dispatch({
    type: "hypoEnd",
  });
}

export function send(hypoAction: ClientAction): void {
  const gameState = globals.state.replay.hypothetical!.ongoing;

  let type: string;
  switch (hypoAction.type) {
    case ActionType.Play: {
      type = "play";
      break;
    }

    case ActionType.Discard: {
      type = "discard";
      break;
    }

    case ActionType.ColorClue:
    case ActionType.RankClue: {
      type = "clue";
      break;
    }

    default: {
      throw new Error(`Unknown hypothetical action of: ${hypoAction.type}`);
    }
  }

  switch (type) {
    case "play":
    case "discard": {
      const card = getCardOrStackBase(hypoAction.target as CardOrder);
      if (!card) {
        return;
      }

      const { suitIndex, rank } = card.getMorphedIdentity();
      if (suitIndex === null || rank === null) {
        // Play or discard action could have been initiated from the keyboard.
        return;
      }

      // Find out if this card misplays.
      let failed = false;
      let newType = type;
      if (type === "play") {
        const nextRanks = playStacksRules.nextPlayableRanks(
          suitIndex,
          gameState.playStacks[suitIndex]!,
          gameState.playStackDirections[suitIndex]!,
          gameState.playStackStarts,
          globals.variant,
          gameState.deck,
        );
        if (!nextRanks.includes(rank)) {
          newType = "discard";
          failed = true;
        }
      }

      switch (newType) {
        case "play": {
          sendHypoAction({
            type: "play",
            playerIndex: gameState.turn.currentPlayerIndex!,
            order: hypoAction.target as CardOrder,
            suitIndex,
            rank,
          });
          break;
        }

        case "discard": {
          sendHypoAction({
            type: "discard",
            playerIndex: gameState.turn.currentPlayerIndex!,
            order: hypoAction.target as CardOrder,
            suitIndex,
            rank,
            failed,
          });
          break;
        }
      }

      if (failed) {
        sendHypoAction({
          type: "strike",
          num: (gameState.strikes.length + 1) as 1 | 2 | 3,
          turn: gameState.turn.segment!,
          order: hypoAction.target as CardOrder,
        });
      }

      // Check if all the cards have already been drawn.
      if (gameState.deck.length < globals.state.cardIdentities.length) {
        // Draw
        const nextCardOrder = gameState.deck.length as CardOrder;
        const nextCard = globals.state.cardIdentities[nextCardOrder];
        sendHypoAction({
          type: "draw",
          order: nextCardOrder,
          playerIndex: gameState.turn.currentPlayerIndex!,
          // Always send the correct suitIndex and rank if known; the blanking of the card will be
          // performed on the client.
          suitIndex: nextCard?.suitIndex ?? -1,
          rank: nextCard?.rank ?? -1,
        });
      }

      break;
    }

    case "clue": {
      const clue = hypoActionToMsgClue(hypoAction);
      const list = getTouchedCardsFromClue(hypoAction.target, clue);
      sendHypoAction({
        type,
        clue,
        giver: gameState.turn.currentPlayerIndex!,
        list,
        target: hypoAction.target as PlayerIndex,
        turn: gameState.turn.turnNum,
        ignoreNegative: false,
      });

      break;
    }

    default: {
      throw new Error(`Unknown hypothetical type of: ${type}`);
    }
  }

  // Finally, send a turn action. Even though this action is unnecessary from the point of the
  // client, for now we must send it to the server so that it can correctly shave off the last
  // action during a "hypoBack".
  let nextPlayerIndex = gameState.turn.currentPlayerIndex! + 1;
  if (nextPlayerIndex === globals.options.numPlayers) {
    nextPlayerIndex = 0;
  }
  sendHypoAction({
    type: "turn",
    num: gameState.turn.turnNum + 1,
    currentPlayerIndex: nextPlayerIndex as PlayerIndex,
  });
}

function hypoActionToMsgClue(hypoAction: ClientAction): MsgClue {
  assertDefined(
    hypoAction.value,
    "The hypothetical action was a clue but it did not include a value.",
  );

  switch (hypoAction.type) {
    case ActionType.ColorClue: {
      return {
        type: ClueType.Color,
        value: hypoAction.value as ColorIndex,
      };
    }

    case ActionType.RankClue: {
      return {
        type: ClueType.Rank,
        value: hypoAction.value as RankClueNumber,
      };
    }

    default: {
      throw new Error(`Unknown hypothetical clue action: ${hypoAction.type}`);
    }
  }
}

export function sendHypoAction(hypoAction: ActionIncludingHypothetical): void {
  if (globals.state.replay.shared === null) {
    globals.store!.dispatch({
      type: "hypoAction",
      action: hypoAction,
    });
  } else {
    globals.lobby.conn!.send("replayAction", {
      tableID: globals.lobby.tableID,
      type: ReplayActionType.HypoAction,
      actionJSON: JSON.stringify(hypoAction),
    });
  }
}

export function sendBack(): void {
  if (
    globals.state.replay.hypothetical === null ||
    globals.state.replay.hypothetical.states.length <= 1
  ) {
    return;
  }

  if (globals.state.replay.shared === null) {
    globals.store!.dispatch({
      type: "hypoBack",
    });
  } else if (globals.state.replay.shared.amLeader) {
    globals.lobby.conn!.send("replayAction", {
      tableID: globals.lobby.tableID,
      type: ReplayActionType.HypoBack,
    });
  }
}

export function toggleRevealed(): void {
  if (globals.state.replay.hypothetical === null) {
    return;
  }

  if (globals.state.replay.shared === null) {
    globals.store!.dispatch({
      type: "hypoShowDrawnCards",
      showDrawnCards: !globals.state.replay.hypothetical.showDrawnCards,
    });
  } else if (globals.state.replay.shared.amLeader) {
    globals.lobby.conn!.send("replayAction", {
      tableID: globals.lobby.tableID,
      type: ReplayActionType.HypoToggleRevealed,
    });
  }
}

// Check if we need to disable the toggleRevealedButton. This happens when a newly drawn card is
// played, discarded, or clued.
export function checkToggleRevealedButton(
  actionMessage: ActionIncludingHypothetical,
): void {
  if (globals.state.replay.hypothetical === null) {
    return;
  }

  switch (actionMessage.type) {
    case "play":
    case "discard": {
      const cardOrder = actionMessage.order;
      if (
        globals.state.replay.hypothetical.drawnCardsInHypothetical.includes(
          cardOrder,
        )
      ) {
        globals.elements.toggleDrawnCardsButton?.setEnabled(false);
      }

      break;
    }

    case "clue": {
      for (const cardOrder of actionMessage.list) {
        if (
          globals.state.replay.hypothetical.drawnCardsInHypothetical.includes(
            cardOrder,
          )
        ) {
          globals.elements.toggleDrawnCardsButton?.setEnabled(false);
          return;
        }
      }

      break;
    }

    default: {
      break;
    }
  }
}

export function changeStartingHandVisibility(): void {
  const startingPlayerIndex =
    globals.state.replay.hypothetical?.startingPlayerIndex;

  if (
    startingPlayerIndex === undefined ||
    startingPlayerIndex === null ||
    globals.elements.playerHands[startingPlayerIndex] === undefined
  ) {
    // Remove all empathy visibility, no longer in hypo.
    for (const i of eRange(globals.options.numPlayers)) {
      const playerIndex = i as PlayerIndex;
      forceHandEmpathy(playerIndex, false);
    }

    return;
  }

  forceHandEmpathy(
    startingPlayerIndex,
    !globals.state.replay.hypothetical!.showDrawnCards,
  );
}

function forceHandEmpathy(playerIndex: PlayerIndex, force: boolean) {
  const hand = globals.elements.playerHands[playerIndex];
  if (hand === undefined) {
    return;
  }

  for (const i of eRange(hand.children.length)) {
    const layoutChild = hand.children[i];
    if (layoutChild === undefined) {
      continue;
    }

    const card = layoutChild.children[0] as HanabiCard | undefined;
    if (card === undefined) {
      continue;
    }

    setEmpathyOnHand(card, force);
  }
}
