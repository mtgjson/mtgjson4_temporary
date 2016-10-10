'use strict';

var cheerio = require('cheerio');
var moment = require('moment');

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
    'Black or Red': 'B/R',
    'Green or White': 'G/W',
    'White or Blue': 'W/B',
    'Two or Blue': '2/U',
    'Colorless': 'C',
    'Tap': 'T',
    'Energy': 'E'
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
	if (pt.indexOf('/') < 0)
	    // Loyalty
	    card.loyalty = pt;
	else {
	    pt = pt.split('/');
	    card.power = pt[0].trim();
	    card.toughness = pt[1].trim();
	}
    }

    // More card info
    var cardSetInfo = $('#' + idPrefix + '_currentSetSymbol img').attr('src');
    card.set = cardSetInfo.match(/set=([^&]*)/)[1];
    card.rarity = RARITIES[cardSetInfo.match(/rarity=([^&]*)/)[1]];

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

module.exports = {
    oracle: parseOracle
};
