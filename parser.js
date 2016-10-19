'use strict';

var cheerio = require('cheerio');
var moment = require('moment');
var async = require('async');

// TODO: Find a better place for this
Array.prototype.unique = function() {
    return this.reduce(function(accum, current) {
    if (accum.indexOf(current) < 0)
        accum.push(current);

    return(accum);
    }, []);
};

var SYMBOLS = {
    'White': 'W',
    'Blue': 'U',
    'Black': 'B',
    'Red': 'R',
    'Green': 'G',
    'Blue or Black': 'U/B',
    'Red or Green': 'R/G',
    'Black or Red': 'B/R',
    'Green or White': 'G/W',
    'White or Blue': 'W/B',
    'Two or White': '2/W',
    'Two or Blue': '2/U',
    'Two or Black': '2/B',
    'Two or Red': '2/R',
    'Two or Green': '2/G',
    'Colorless': 'C',
    'Tap': 'T',
    'Untap': 'Q',
    'Energy': 'E',
    'Variable Colorless': 'X',
    '0': '0',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    '11': '11',
    '12': '12',
    '13': '13',
    '15': '15'
};

var COLORS = {
    'W': 'white',
    'U': 'blue',
    'B': 'black',
    'R': 'red',
    'G': 'green'
};

var RARITIES = {
    'C': 'common',
    'U': 'uncommon',
    'R': 'rare',
    'M': 'mythic rare',
    'S': 'special'
};

var fixText = function(blocks) {
    var parseBlock = function(block) {
    return block
        .replace(/<img [^>]*alt="([^"]*)[^>]*>/g, function(img, p1) {
        var ret = p1;
        if (Object.keys(SYMBOLS).indexOf(p1) >= 0)
            ret = SYMBOLS[p1];
        return('{' + ret + '}');
        })
        .replace(/&apos;/g, "'")  // Fix html
        .replace(/&quot;/g, '"')
        .replace(/&#x2212;/g, '−') // Minus on planeswalker cards
        .replace(/&#x2014;/g, '-') // Fix long dashes
        .replace(/<[^>]*>/g, '');
    };

    var aux = [];
    if (Array.isArray(blocks)) {
        var i;
        for (i = 0; i < blocks.length; i++) {
            aux.push(parseBlock(blocks[i]));
        }
    }
    else
        aux.push(parseBlock(blocks));

    return(aux.join('\n'));
};

var parsePrinted = function(multiverseid, data, callback) {
    var card = {};

    var $ = cheerio.load(data);

    var rightCol = $('.rightCol');
    var colIdx = 0;

    // Sanity check
    if (rightCol.length == 0) {
        callback(new Error("Invalid card data."));
        return;
    }

    // In case of double-sided cards, this should always holds the front card id.
    var frontCardIdx = $(rightCol[0]).attr('id').replace('_rightCol', '');
    var idPrefix = $(rightCol[colIdx]).attr('id').replace('_rightCol', '');

    // Retrieve card type
    card.originalType = $('#' + idPrefix + '_typeRow .value').text().trim().replace(/  /g, ' ');

    // TODO: Extract subtypes and supertypes

    // Text
    var cardText = $('#' + idPrefix + '_textRow');
    if (cardText.length > 0) {
        var blocks = [];
        $('.value div', cardText).each(function(idx, obj) {
            blocks.push($(obj).html());
        });
    card.originalText = fixText(blocks);
    }

    callback(null, card);
};

var parseOracle = function(multiverseid, data, callback) {
    var card = {};

    var $ = cheerio.load(data);

    var rightCol = $('.rightCol');
    var colIdx = 0;

    // Sanity check
    if (rightCol.length == 0) {
        callback(new Error("Invalid card data."));
        return;
    }

    card.multiverseid = multiverseid;
    card.layout = 'normal';

    // In case of double-sided cards, this should always holds the front card id.
    var frontCardIdx = $(rightCol[0]).attr('id').replace('_rightCol', '');
    var idPrefix = $(rightCol[colIdx]).attr('id').replace('_rightCol', '');

    card.name = $('#' + idPrefix + '_nameRow .value').text().trim();
    card.name = card.name.replace(/Æ/g, 'Ae');

    // Parse card mana cost
    var manaCost = $('#' + idPrefix + '_manaRow');
    if (manaCost.length > 0) {
        var aux = [];
        var i;
        var manaObj = $('img', manaCost);

        for (i = 0; i < manaObj.length; i++) {
            var obj = manaObj[i];
            var cost = $(obj).attr('alt');

            if (Object.keys(SYMBOLS).indexOf(cost) >= 0)
            cost = SYMBOLS[cost];
            else
            console.log("Warning: Unknown mana cost: '%s'", cost);

            aux.push('{' + cost + '}');
        }

        card.manacost = aux.join('');
    }

    // Parse card converted mana cost (always from the front card)
    var cmc = $('#' + frontCardIdx + '_cmcRow');
    if (cmc.length > 0)
        card.cmc = parseInt($('.value', cmc).text().trim());

    // Retrieve card type
    card.type = $('#' + idPrefix + '_typeRow .value').text().trim().replace(/  /g, ' ');

    // TODO: Extract subtypes and supertypes

    /*
    If the card has "Legendary Artifact Creature -- Human Wizard"
        super = Legendary
        types = Artifact, Creature
        subtypes = Human, Wizard

    If the card has "Artifact Creature -- Goblin Dwarf"
        super = []
        types = Artifact, Creature
        subtypes = Goblin, Dwarf

    */

    // These are the valid super types that a card can have
    var VALID_SUPERTYPES = ["Basic", "Legendary", "Snow", "World", "Ongoing"];

    // Split the card into the super/sub type sets
    var cardTypes = card.type.split("—");

    card.superTypes = [];
    card.types = [];
    card.subTypes = [];

    if (cardTypes.length > 0)
    {
        // Get all of the supertypes / types
        var eachSupAndType = cardTypes[0].split(" ");

        eachSupAndType.forEach(function(x) {
            if (x.length)
                (VALID_SUPERTYPES.indexOf(x) != -1) ? card.superTypes.push(x) : card.types.push(x);
        });

        // If this card does have a dash, lets get the subtypes
        if (cardTypes[1]) {
            var eachSub = cardTypes[1].split(" ");
            eachSub.forEach(function(x) {
                if (x.length)
                    card.subTypes.push(x);
            });
        }
    }

    // Delete unused arrays
    if (!card.superTypes.length)
        delete card.superTypes;
    if (!card.types.length)
        delete card.types;
    if (!card.subTypes.length)
        delete card.subTypes;

    // Text
    var cardText = $('#' + idPrefix + '_textRow');
    if (cardText.length > 0) {
        var blocks = [];
        $('.value div', cardText).each(function(idx, obj) {
            blocks.push($(obj).html());
        });
        card.text = fixText(blocks);
    }

    var cardFlavor = $('#' + idPrefix + '_FlavorText');
    if (cardFlavor.length > 0) {
        var aux = [];
        $('div', cardFlavor).each(function(idx, obj) {
            aux.push($(obj).text().trim());
        });
        card.flavor = aux.join('\n');
    }

    // Card Power/Toughness or Loyalty
    var cardPT = $('#' + idPrefix + '_ptRow');
    if (cardPT.length > 0) {
        var pt = $('.value', cardPT).text().trim();
        if (pt.indexOf('/') < 0) // Loyalty
            card.loyalty = pt;
        else
        {
            pt = pt.split('/');
            card.power = pt[0].trim();
            card.toughness = pt[1].trim();
        }
    }

    // More card info
    var cardSetInfo = $('#' + idPrefix + '_currentSetSymbol img').attr('src');
    card.set = cardSetInfo.match(/set=([^&]*)/)[1];
    card.rarity = RARITIES[cardSetInfo.match(/rarity=([^&]*)/)[1]];

    // Other sets
    var cardSets = $('#' + idPrefix + '_otherSetsRow');
    if (cardSets.length > 0) {
        card.printings = [];
        $('img', cardSets).each(function(idx, obj) {
            var set = $(obj).attr('src').match(/set=([^&]*)/)[1];
            card.printings.push(set);
        });

        card.printings = card.printings.unique().sort();
    }

    // Card Number
    var cardNumber = $('#' + idPrefix + '_numberRow');
    if (cardNumber.length > 0)
        card.number = $('.value', cardNumber).text().trim();

    // Card Artist
    var cardArtist = $('#' + idPrefix + '_artistRow');
    if (cardArtist.length > 0)
        card.artist = $('.value', cardArtist).text().trim();

    // Rulings
    var rulingsData = $('#' + idPrefix + '_rulingsContainer');
    if (rulingsData.length > 0) {
        card.rulings = [];
        $('tr', rulingsData).each(function(idx, obj) {
            var fields = $('td', obj);
            var date = $(fields[0]).text().trim();

            var momentdate = moment(date, 'MM/DD/YYYY');

            var content = $(fields[1]).html().trim()
            .replace(/&#x2019;/g, "'")
            .replace(/(&#x201C;|&#x201D)/g, '"');

            card.rulings.push({
            'date': momentdate.format('YYYY-MM-DD'),
            'text': fixText(content)
            });
        });
    }

    // Calculate colors
    if (card.manacost) {
        var matchedColors = card.manacost
            .match(/{[2WUBRG/]*}/g);

        if (matchedColors != null && matchedColors.length > 0) {
            card.colors = [];
            var colors = [];
            matchedColors.forEach(function(x) {
                var symbol = x.replace(/[{}/]/g, '');
                var i;
                for (i = 0; i < symbol.length; i++) {
                    if ('WUBRG'.indexOf(symbol[i]) >= 0)
                        colors.push(symbol[i]);
                }
                });
            colors.unique().forEach(function(x) {
                card.colors.push(COLORS[x]);
            });
        }
    }

    callback(null, card);
};

var parseLegalities = function(data, callback) {
    var legalities = [];

    var $ = cheerio.load(data[0]);

    var legalities_table = $('table')[1];
    $('.cardItem', legalities_table).each(function(idx, item) {
        var cells = $('td', item);

        legalities.push({
            'format': $(cells[0]).html().trim(),
            'legality': $(cells[1]).html().trim()
        });
    });

    callback(null, legalities);
};

var parsePrintings = function(data, callback) {
    var printings = [];

    async.each(
        data,
        function(page, cb) {
            var $ = cheerio.load(page);
            var printings_table = $('table')[0];
            $('.cardItem', printings_table).each(function(idx, item) {
                printings.push($('.column2 img', item).attr('src').match(/set=([^&]*)/)[1].trim());
            });
            cb();
        },
        function() {
            callback(null, printings.unique());
        }
    );
};

module.exports = {
    oracle: parseOracle,
    printed: parsePrinted,
    legalities: parseLegalities,
    printings: parsePrintings
};
