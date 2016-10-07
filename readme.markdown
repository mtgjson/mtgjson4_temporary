# MTGJson

Sourcecode for generating data for [mtgjson.com](https://mtgjson.com) website.

## New features and Changes

 * Persistent immutable ID, generated for each card, stored on "_id" field.
 * JSON database stored on a [different project](https://github.com/mtgjson/db)
 * Sorting
  * All objects with sorted keys
  * Card arrays are sorted by number, then by multiverseid
 * Command line interface for adding, removing and querying substitution rules
 * Files provided on the website will be pretty-printed (instead of one-liners)
 * Incorporate tokens
  * Tokens will also have unique "_id" fields.
  * Tokens will have their own array, separated from the cards array.
  * Tokens will have a "card generator" array, provided they are from the same set.
  * Initially, tokens will be parsed from cockatrice: https://github.com/Cockatrice/Magic-Token/blob/master/tokens.xml
 * Fields that will be removed:
  * id
  * imageName
 * Set Specific
  * EMN
   * Try to look for meld cards automatically with the "Melds with (card-name-here)." on text.
 * New provided files
  * AllCards_Standard.json
  * AllTokens.json
 * Filename alteration: the "-x" suffix will be changed to "-full".
 * Every file will have a ".sig" file as well.
 
This list is not final and is subject to change at any time.

