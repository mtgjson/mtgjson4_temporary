'use strict';

var fs = require('fs');
var path = require('path');
var tiptoe = require('tiptoe');
var async = require('async');

var uuid = require('./uuid');

var set_cache = {};

// Holds a dictionary that references gatherer codes with mtgjson codes, when they do not match.
var set_codes = null;

// Creates the set_codes object, that transforms gatherer codes into mtgjson codes for select sets.
var load_set_codes = function(callback) {
    set_codes = {};

    fs.readdir(path.join(__dirname, 'data'), function(err, files) {
        if (err)
            throw(err);
        async.each(
            files,
            function(fn, cb) {
                if (fn.match(/^header_/) != null) {
                    fs.readFile(path.join(__dirname, 'data', fn), 'utf-8', function(err, _data) {
                        if (err) throw(err);
                        var data = JSON.parse(_data);

                        if (data.gathererCode && data.gathererCode != data.code) {
                            set_codes[data.gathererCode] = data.code;
                        }

                        cb();
                    });
                }
                else
                    cb();
            },
            callback
        );
    });
};

var set_load = function(set_code, callback) {
    if (Object.keys(set_cache).indexOf(set_code) >= 0) {
        callback(null, set_cache[set_code]);
        return;
    }

    var setPath = path.join(__dirname, 'db', set_code + '.json');

    tiptoe(
        function() {
            // Load set codes
            if (set_codes === null)
                load_set_codes(this);
            else
                this();
        },
        function() {
            var cb = this;
            // Check if we have a database with this code
            fs.stat(setPath, function(err, stats) {
                if (err) {
                    // Check if we have instructions for the set
                    var fallbackPath = path.join(__dirname, 'data', 'header_' + set_code + '.json');
                    fs.stat(fallbackPath, function(err2, stats) {
                        if (err2) {
                            // TODO: Create a proper error message
                            cb(err2);
                            return;
                        }
                        cb(null, fallbackPath);
                    });
                    return;
                }

                cb(null, setPath);
            });
        },
        function(dataPath) {
            fs.readFile(dataPath, this);
        },
        function(setData) {
            var cb = this;

            set_cache[set_code] = JSON.parse(setData);

            fs.readFile(path.join(__dirname, 'data', 'fixes_' + set_code + '.json'), 'utf-8', function(err, data) {
                if (!err) {
                    set_cache[set_code]._fixes = JSON.parse(data);
                }

                cb();
            });
        },
        function(err) {
            callback(err, set_cache[set_code]);
        }
    );
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
            if (a.number && b.number)
                return(sortAlphaNum(a.number, b.number));
            return(a.name.localeCompare(b.name));
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

    // Create a new object excluding internal stuff
    var _set = {};
    var ignoreKeys = [ 'meldcards', '_fixes' ];
    Object.keys(set).forEach(function(k) {
        if (ignoreKeys.indexOf(k) < 0)
            _set[k] = set[k];
    });

    fs.writeFile(setPath, JSON.stringify(_set, null, 2), 'utf-8', callback);
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
        card._title = card._title.replace(/ *:/, ':'); // Fix some name nonsense.
        // Check if we're consistent. Make actions if we're not.
        if (card._title.toLowerCase() != card.name.toLowerCase() && card.layout != 'double-sided' && card.layout != 'split') {
            console.log('===FIX===');
            console.log('"%s"\n"%s"', card._title, card.name);
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
                        setCard.layout = card.layout;
                    }
                }
        }
        else
            setCard[key] = card[key];
    });

    // Fix set codes
    if (set_codes != null) {
        var oldCodes = Object.keys(set_codes);
        setCard.printings = setCard.printings.map(function(value, index, array) {
            if (oldCodes.indexOf(value) >= 0)
                return(set_codes[value]);
            return(value);
        });
    }

    // FIXES
    if (set._fixes) {
        set._fixes.forEach(function(fix) {
            var matches = fix.match;
            var match = false;

            // Check for name
            if (matches.name) {
                if (Array.isArray(matches.name)) {
                    if (matches.name.indexOf(setCard.name) >= 0)
                        match = true;
                }
                else
                    if (matches.name == setCard.name)
                        match = true;
            }
            // Check for multiverseid
            if (matches.multiverseid) {
                if (Array.isArray(matches.multiverseid)) {
                    if (matches.multiverseid.indexOf(setCard.multiverseid) >= 0)
                        match = true;
                }
                else
                    if (matches.multiverseid == setCard.multiverseid)
                        match = true;
            }

            if (match) {
                // Apply fix.
                console.log('Applying fix for "%s"...', setCard.name);

                var availableFixes = Object.keys(fixes);
                Object.keys(fix).forEach(function(fixName) {
                    if (fixName == 'match') return;
                    if (availableFixes.indexOf(fixName) < 0) {
                        console.log('Unavailable fix "%s" for card "%s".', fixName, setCard.name);
                        return;
                    }

                    fixes[fixName](setCard, fix[fixName]);
                });
            }
        });
    }

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

var fixes = {
    'flavorAddExclamation': function(card, fix) {
        var flavor = card.flavor;
        var lastIndexOfQuote = flavor.lastIndexOf('"');
        if (lastIndexOfQuote < 0) {
            console.log('trying to apply fix flavorAddExclamation, but there are no quotes in the flavor: >>%s<<', flavor);
            return;
        }
        else {
            if (flavor[lastIndexOfQuote] != '!')
                flavor = flavor.substr(0, lastIndexOfQuote) + '!' + flavor.substr(lastIndexOfQuote);
        }

        card.flavor = flavor;
    },
    'flavorAddDash': function(card, fix) {
        var flavor = card.flavor;
        var firstQuote = flavor.indexOf('"');
        var secondQuote = flavor.indexOf('"', firstQuote + 1);
        var lastIndexOfQuote = secondQuote;

        if (lastIndexOfQuote < 0) {
            console.log('trying to apply fix flavorAddDash, but there are no quotes in the flavor: >>%s<<', flavor);
            return;
        }
        else {
            if (flavor[lastIndexOfQuote + 1] != '—')
                flavor = flavor.substr(0, lastIndexOfQuote + 1) + '—' + flavor.substr(lastIndexOfQuote + 1);
        }

        card.flavor = flavor;
    },
    'replace': function(card, fix) {
        Object.keys(fix).forEach(function(field) {
            card[field] = fix[field];
        });
    }
};

module.exports = {
    load: set_load,
    save: set_save,
    add: set_add,
    findCard: findCardInSet,
    findToken: findTokenInSet
};
