# Cards

Key | Example | Description
--- | --- | ---
_id | | This is an unmutable, unique, key that every card will have.
artist | "John Avon" | This is the name of the artist for the specific print of a card. Some artist names may not match due to misprints being corrected.
cmc | 8 | This is normally an integer of the converted mana cost of the card. In some situations, this might be a float because some cards have halfs (i.e. "Litte Girl") in their costs. Cards that do not have this field have an implied cmc of 0.
colorIdentity | ["U","G","B"] | This field tells you all the colors this card interacts with. For example, [General Tazri](http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=407529) has an ability that costs all 5 colors, so his color identity is all colors.
colors | ["Blue", "Green", "Black"] | The colors the card is. For example, [General Tazri](http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=407529) is White only.
flavor | "The Izzet quickly suspended their policy of lifetime guarantees." | The flavor text of the card. Will not be set if a card does not have flavor text.
layout | "normal" | The possible layouts a card can have. ENUM values: normal, split, flip, double-faced, token, plane, scheme, phenomenon, leveler, vanguard, meld
legalities | | An array of what formats this card is legal, restricted, or banned in.
loyalty | 3 | This card's loyalty. Will not be set if the card does not use loyalty.
manacost | 1{G}{G} | This is the card's mana cost. If a card does not have a mana cost, such as [Ancestral Vision](http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=393818), this field will not be set. Note that manacost 0 is different from not having a mana cost.
multiverseid | 159097 | This is the card's multiverse ID which is assigned to the card via Gatherer. If a card is not on gatherer, this field will not be set.
name | "Phelddagrif" | This is the name of the card.
names | | These are alternative cards that relate to the card. This is where cards like [Ludevic's Test Subject](http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=221179) will have the flip side name and split cards will have the other half's name.
number | 150 | The card number in the set, as defined on the card.
originalText | | If the oracle wording of a card was updated, this field will be set with the original text of the card.
originalType | | If the oracle wording of a card's type was updated, this field will be set with the original type of the card.
power | 4 | This is the power of the card. Will only be set if the card has a power.
printings | | This is an array which contains the 3 letter set code for all sets this card was printed in.
rarity | "rare" | This is the rarity of the card. ENUM: common, uncommon, rare, mythic rare, special
releaseDate | | This field is set for promo cards that are not released within sets. An exmaple of this is this version of [Dragon Broodmother](http://magiccards.info/ptc/en/40.html).
rullings | | This is an array of rullings found on Gatherer for the card. Will not be set if no rullings.
subTypes | ["Eldrazi", "Spawn"] | This is an array of the subtypes for cards. Ex: "Legendary Artifact Creature -- Eldrazi Spawn" will yield ["Eldrazi", "Spawn"]
superTypes | ["Legendary"] | This is an array of the supertypes for cards. Ex: "Legendary Artifact Creature -- Eldrazi Spawn" will yield ["Legendary"].
text | | This is the rules text of a card. Does not contain flavor text.
toughness | 4 | This is the toughness of the card. Will only be set if the card has a toughness.
type | "Legendary Artifact Creature -- Eldrazi Spawn" | This is the full type line of a card.
types | ["Artifact", "Creature"] | This is an array of types. Ex: "Legendary Artifact Creature -- Eldrazi Spawn" will yield ["Artifact", "Creature"]
watermark | "Golgari" | This will be set if a card has a watermark, such as [Abrupt Decay](http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=253561)


Additionals for later??
variations
border
timeshifted
hand
life
reserved
starter
foreignNames
source