import suitsJSON from "./json/suits.json";
import type { Color } from "./types/Color";
import type { Suit } from "./types/Suit";
import type { SuitJSON } from "./types/SuitJSON";

const SUIT_REVERSED_SUFFIX = " Reversed";

export function suitsInit(
  COLORS: ReadonlyMap<string, Color>,
): ReadonlyMap<string, Suit> {
  const suits = new Map<string, Suit>();

  if (suitsJSON.length === 0) {
    throw new Error('The "suits.json" file did not have any elements in it.');
  }

  for (const suitJSON of suitsJSON as SuitJSON[]) {
    // Validate the name
    const { name } = suitJSON;
    if (name === "") {
      throw new Error(
        'There is a suit with an empty name in the "suits.json" file.',
      );
    }

    // Validate the abbreviation. If it is not specified, use the abbreviation of the color with the
    // same name. Otherwise, assume that it is the first letter of the suit.
    let abbreviation = suitJSON.abbreviation ?? "";
    if (abbreviation.length === 0) {
      const color = COLORS.get(name);
      abbreviation = color === undefined ? name.charAt(0) : color.abbreviation;
    }
    if (abbreviation.length !== 1) {
      throw new Error(
        `The "${suitJSON.name}" suit has an abbreviation that is not one letter long.`,
      );
    }

    // Validate the clue properties. If these are not specified, the suit functions normally. (This
    // has to be done before validating the clue colors.)
    if ("allClueColors" in suitJSON && suitJSON.allClueColors !== true) {
      throw new Error(
        `The "allClueColors" property for the suit "${suitJSON.name}" must be set to true.`,
      );
    }
    const allClueColors = suitJSON.allClueColors ?? false;
    if ("allClueRanks" in suitJSON && suitJSON.allClueRanks !== true) {
      throw new Error(
        `The "allClueRanks" property for the suit "${suitJSON.name}" must be set to true.`,
      );
    }
    const allClueRanks = suitJSON.allClueRanks ?? false;
    if ("noClueColors" in suitJSON && suitJSON.noClueColors !== true) {
      throw new Error(
        `The "noClueColors" property for the suit "${suitJSON.name}" must be set to true.`,
      );
    }
    const noClueColors = suitJSON.noClueColors ?? false;
    if ("noClueRanks" in suitJSON && suitJSON.noClueRanks !== true) {
      throw new Error(
        `The "noClueRanks" property for the suit "${suitJSON.name}" must be set to true.`,
      );
    }
    const noClueRanks = suitJSON.noClueRanks ?? false;
    if ("prism" in suitJSON && suitJSON.prism !== true) {
      throw new Error(
        `The "prism" property for the suit "${suitJSON.name}" must be set to true.`,
      );
    }
    const prism = suitJSON.prism ?? false;

    // Validate the clue colors (the colors that touch this suit). If it is not specified, use the
    // color of the same name.
    const clueColors: Color[] = [];
    if ("clueColors" in suitJSON) {
      if (!Array.isArray(suitJSON.clueColors)) {
        throw new TypeError(
          `The clue colors for the suit "${suitJSON.name}" was not specified as an array.`,
        );
      }

      // The clue colors are specified as an array of strings. Convert the strings to objects.
      for (const colorName of suitJSON.clueColors) {
        if (typeof colorName !== "string") {
          throw new TypeError(
            `One of the clue colors for the suit "${suitJSON.name}" was not specified as a string.`,
          );
        }

        const color = COLORS.get(colorName);
        if (color === undefined) {
          throw new Error(
            `The color "${colorName}" in the suit "${suitJSON.name}" does not exist.`,
          );
        } else {
          clueColors.push(color);
        }
      }
    } else if (!allClueColors && !noClueColors && !prism) {
      // The clue colors were not specified; by default, use the color of the same name.
      const color = COLORS.get(name);
      if (color !== undefined) {
        clueColors.push(color);
      } else if (name !== "Unknown") {
        // The "Unknown" suit is not supposed to have clue colors.
        throw new Error(
          `Failed to find the clue colors for the "${suitJSON.name}" suit. (There is no corresponding color named "${suitJSON.name}".)`,
        );
      }
    }

    // The display name is optional; if not specified, then use the normal suit name.
    const displayName = suitJSON.displayName ?? suitJSON.name;

    // Validate the fill and the colorblind fill. If it is not specified, use the fill of the color
    // with the same name. Otherwise, assume the fill of the first clue color.
    let fill = suitJSON.fill ?? "";
    let fillColorblind = "";
    if (fill === "") {
      const color = COLORS.get(displayName);
      if (color !== undefined) {
        fill = color.fill; // eslint-disable-line prefer-destructuring
        fillColorblind = color.fillColorblind; // eslint-disable-line prefer-destructuring
      } else if (clueColors.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const firstColor = clueColors[0]!;
        fill = firstColor.fill; // eslint-disable-line prefer-destructuring
      } else {
        throw new Error(
          `Failed to find the fill for the "${suitJSON.name}" suit. (There is no corresponding color named "${suitJSON.name}" and this suit has no clue colors specified.)`,
        );
      }
    }
    if (fill === "") {
      throw new Error(`The fill was empty for the "${suitJSON.name}" suit.`);
    }
    if (fillColorblind === "") {
      fillColorblind = fill;
    }

    // Validate the fill colors.
    let fillColors: string[] = [];
    if ("fillColors" in suitJSON) {
      if (!Array.isArray(suitJSON.fillColors)) {
        throw new TypeError(
          `The "fillColors" property for the suit ${suitJSON.name} is not an array.`,
        );
      }

      if (suitJSON.fillColors.length === 0) {
        throw new Error(
          `The "fillColors" array for the suit "${suitJSON.name}" is empty.`,
        );
      }

      fillColors = suitJSON.fillColors; // eslint-disable-line prefer-destructuring
    }

    // Validate the "oneOfEach" property. If it is not specified, the suit is not one of each (e.g.
    // every card is not critical).
    if ("oneOfEach" in suitJSON && suitJSON.oneOfEach !== true) {
      throw new Error(
        `The "oneOfEach" property for the suit "${suitJSON.name}" must be set to true.`,
      );
    }
    const oneOfEach = suitJSON.oneOfEach ?? false;

    // Validate the "pip" property.
    let pip = "";
    if ("pip" in suitJSON) {
      if (typeof suitJSON.pip !== "string") {
        throw new TypeError(
          `The "pip" property for the suit "${suitJSON.name}" must be a string.`,
        );
      }

      if (suitJSON.pip.length === 0 && suitJSON.name !== "Unknown") {
        throw new Error(
          `Failed to find the pip for the "${suitJSON.name}" suit.`,
        );
      }

      pip = suitJSON.pip; // eslint-disable-line prefer-destructuring
    }

    // Add it to the map.
    const suit: Suit = {
      name,
      abbreviation,
      clueColors,
      displayName,
      fill,
      fillColorblind,
      fillColors,
      oneOfEach,
      pip,
      reversed: false,

      allClueColors,
      allClueRanks,
      noClueColors,
      noClueRanks,
      prism,
    };
    suits.set(suitJSON.name, suit);

    // Additionally, add the reversed version of this suit.
    const suitReversed: Suit = {
      ...suit,
      reversed: true,
    };
    suits.set(suitJSON.name + SUIT_REVERSED_SUFFIX, suitReversed);
  }

  return suits;
}
