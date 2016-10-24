'use strict';

var fs = require('fs');
var path = require('path');

var uuid = require('./uuid');

var set_cache = {};

var set_load = function(set_code, callback) {
    if (Object.keys(set_cache).indexOf(set_code) >= 0) {
        callback(null, set_cache[set_code]);
        return;
    }

    var setPath = path.join(__dirname, 'db', set_code + '.json');

    var getData = function(path) {
    fs.readFile(path, function(err, data) {
        if (err) {
            callback(err);
            return;
        }

        set_cache[set_code] = JSON.parse(data);
        callback(null, set_cache[set_code]);
    });
    };

    // Check if we have a database with this code
    fs.stat(setPath, function(err, stats) {
    if (err) {
        // Check if we have instructions for the set
        var fallbackPath = path.join(__dirname, 'data', 'header_' + set_code + '.json');
        fs.stat(fallbackPath, function(err2, stats) {
            if (err2) {
                // TODO: Create a proper error message
                callback(err2);
                return;
            }
            getData(fallbackPath);
        });
        return;
    }

    getData(setPath);
    });
};

/* ********************************************************************
 * Alphanum sort() function version - case sensitive
 *  - Slower, but easier to modify for arrays of objects which contain
 *    string properties
 *
 */
var sortAlphaNum = function(a, b) {
    var chunkify = function(t) {
        var tz = new Array();
        var x = 0, y = -1, n = 0, i, j;

        while (i = (j = t.charAt(x++)).charCodeAt(0)) {
            var m = (i == 46 || (i >=48 && i <= 57));
            if (m !== n) {
                tz[++y] = "";
                n = m;
            }
            tz[y] += j;
        }
        return tz;
    };

    var aa = chunkify(a);
    var bb = chunkify(b);
    var x;

    for (x = 0; aa[x] && bb[x]; x++) {
        if (aa[x] !== bb[x]) {
            var c = Number(aa[x]), d = Number(bb[x]);
            if (c == aa[x] && d == bb[x])
                return c - d;
            else
                return (aa[x] > bb[x]) ? 1 : -1;
        }
    }
    return aa.length - bb.length;
}


var set_save = function(set, callback) {
    var setPath = path.join(__dirname, 'db', set.code + '.json');

    // Sort cards
    if (set.cards) {
        set.cards = set.cards.sort(function(a, b) {

            return(sortAlphaNum(a.number, b.number));
        });

        set.cards.forEach(function(card) {
            var aux;
            var keys = Object.keys(card).sort();
            keys.forEach(function(key) {
                aux = card[key];
                delete card[key];
                card[key] = aux;
            });
        });
    }

    delete set.meldcards;

    fs.writeFile(setPath, JSON.stringify(set, null, 2), 'utf-8', callback);
};

/**
 * Adds a given card to the set, checking if the card is new and adding any needed information
 */
var set_add = function(set, card, callback) {
    if (!card.name) {
        console.error("The card has no name.");
        throw new Error('Invalid card: ' + JSON.stringify(card));
    }

    // TODO: We're currently assumming all cards have multiverse id.
    var setCard = findCardInSet(card.multiverseid, card.name, set);

    if (card._id) {
        // Card already has an id. Let's do a sanity check.
        // TODO: Sanity check
    }

    if (card._title) {
        // Check if we're consistent. Make actions if we're not.
        if (card._title != card.name && card.layout != 'double-sided' && card.layout != 'split') {
            card.layout = 'flip';
            card.names = [ card._title, card.name ];

            if ('ab'.indexOf(card.number.substr(-1)) == -1)
                card.number = card.number + 'b';

            var otherCard = findCardInSetByName(card._title, set);
            if (otherCard == null) {
                console.log("Card %s is not yet on the database. Re-run the fetch.", card._title);
            }
            else {
                otherCard.layout = 'flip';
                otherCard.names = card.names;
                if ('ab'.indexOf(otherCard.number.substr(-1)) == -1)
                    otherCard.number = otherCard.number + 'a';
            }
        }
        if (card.names && card.layout != 'flip' && card.text) {
            var matches = card.text.match(/\(Melds with ([^\.\)]*)\.?\)/);
            if (matches != null) {
                if (!set.meldcards)
                    set.meldcards = {};

                // Meld card.
                var mainCard = card.name;
                var secondCard = matches[1];
                var meldCard = card.names[1];

                card.names = [
                    mainCard,
                    secondCard,
                    meldCard
                ];
                card.layout = 'meld';

                set.meldcards[mainCard] = card.names;
                set.meldcards[secondCard] = card.names;
                set.meldcards[meldCard] = card.names;

                // Find second card
                var card2 = findCardInSetByName(secondCard, set);
                if (card2 == null) {
                    console.log("Cannot find second card for melding: %s", secondCard);
                }
                else {
                    card2.names = card.names;
                    card2.layout = 'meld';
                }

                // Find the melded card
                var card3 = findCardInSetByName(meldCard, set);
                if (card3 == null) {
                    console.log("Cannot find melded card for melding: %s", meldCard);
                }
                else {
                    card3.names = card.names;
                    card3.layout = 'meld';
                }
            }
        }

        if (set.meldcards && Object.keys(set.meldcards).indexOf(card.name) >= 0) {
            card.layout = 'meld';
            card.names = set.meldcards[card.name];
        }
    }

    if (!setCard) {
        setCard = {};
        setCard._id = uuid();
        set.cards.push(setCard);
    }

    // Merge
    // The persistent keys are not replaced if they are already on the destination object.
    var persistentKeys = [
        'layout',
        'number'
    ];
    var keys = Object.keys(card);
    keys.forEach(function(key) {
        if (setCard[key] && persistentKeys.indexOf(key) >= 0) {
            if (key == 'layout')
                if (setCard.layout != card.layout) {
                    if (setCard.layout == 'normal') {
                        console.log("WARNING: Changed layout of card %s. %s => %s", card.name, setCard.layout, card.layout);
                        setCard.layout = card.layout
                    }
                }
        }
        else
            setCard[key] = card[key];
    });

    // Delete unused/internal fields
    [
        '_title',
        'special',
        'set',
        'linkedCard'
    ]
        .forEach(function(key) {
            delete(setCard[key]);
        });

    // TODO: Any set-specific corrections

    if (callback && typeof(callback) === 'function')
        setImmediate(callback, null, setCard);

    return(setCard);
};

var findCardInSet = function(multiverseid, name, set) {
    var findCB = function(element, index, array) {
        return(element.multiverseid == multiverseid && element.name == name);
    };

    return(set.cards.find(findCB));
};

// Retriever the FIRST card with the given name in the set.
var findCardInSetByName = function(name, set) {
    var findCB = function(element, index, array) {
        return(element.name == name);
    };

    return(set.cards.find(findCB));
};

var findTokenInSet = function(name, set) {
    var findCB = function(element, index, array) {
        return(element.name.localeCompare(name) == 0);
    };

    return(set.tokens.find(findCB));
};

module.exports = {
    load: set_load,
    save: set_save,
    add: set_add,
    findCard: findCardInSet,
    findToken: findTokenInSet
};
