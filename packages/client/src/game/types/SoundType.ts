/**
 * Represents the type of sound that should play, depending on what the last action of the game was.
 */
export enum SoundType {
  // A "normal" or "boring" game action occurred, so do not play any special sound effect.
  Standard,

  // -----------
  // Play Sounds
  // -----------

  Fail1, // When a misplay (bomb) happens
  Fail2,
  Blind1, // When a blind-play happens
  Blind2,
  Blind3,
  Blind4,
  Blind5,
  Blind6,
  OneOutOfOrder, // When someone performs an "Order Chop Move"

  // --------------
  // Discard Sounds
  // --------------

  // Discard sounds
  DiscardClued, // When a player discards a card with one or more positive clues on it
  DoubleDiscard, // When a player discards *in* a "double discard" situation
  DoubleDiscardCause, // When a player discards to cause a "double discard" situation

  // ---------------------
  // Play / Discard Sounds
  // ---------------------

  Sad, // When the maximum score decreases.
  // (This normally happens when discarding a critical card, but it can also happen from playing a
  // card in some variants.)

  // Clue sounds
  Moo, // For "Cow & Pig" variants
  Oink, // For "Cow & Pig" variants
  Quack, // For "Duck" variants

  // ---------------
  // Finished Sounds
  // ---------------

  FinishedSuccess, // When the game is finished with any score other than 0 or the maximum score.
  FinishedFail, // When the game is finished with a score of 0.
  FinishedPerfect, // When the game is finished with the maximum score possible.
}
