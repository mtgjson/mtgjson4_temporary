'use strict';

var hitme = require('hitme');
var async = require('async');
var tiptoe = require('tiptoe');
var config = require('./config');
var downloader = require('./downloader');
var cardGrab = require('./download_card.js');
var uuid = require('./uuid');
var sets = require('./sets');
var parser = require('./parser');
var tokens = require('./tokens');

function init(callback) {
    var caller = hitme.serial(callback);
    // Loads the configuration
    caller(config.load);

    // Initializes the downloader module with the configuration loaded.
    caller(function(cb) {
        downloader.init(config.cache, cb);
    });

    // Setup URL prefix for downloading
    caller(function(cb) {
        if (config.mtgjson.base_url)
            cardGrab.url_prefix = config.mtgjson.base_url
        cb();
    });
}

function cleanup() {
    console.log('- cleaning up -');
    downloader.cleanup();
}

/*
var findCardInSet = function(multiverseid, name, set) {
    var findCB = function(element, index, array) {
        return(element.multiverseid == multiverseid && element.name == name);
    };

    return(set.cards.find(findCB));
};

var findTokenInSet = function(name, set) {
    var findCB = function(element, index, array) {
        return(element.name.localeCompare(name) == 0);
    };

    return(set.tokens.find(findCB));
};
*/

var downloadCard = function(card, callback) {
    var downloaded = null;
    tiptoe(
        // Download all the card information
        function() {
            cardGrab.downloadFiles(card.multiverseid, (card.special)?card.name:null, this);
        },
        // Parse each section of the downloaded data
        function(data) {
            downloaded = data;
            parser.oracle(card.multiverseid, data.oracle, this.parallel());
            parser.printed(card.multiverseid, data.printed, this.parallel());
            parser.legalities(data.printings, this.parallel());
            parser.printings(data.printings, this.parallel());
            parser.languages(data.languages, this.parallel());
        },
        // Aggregate each parsed information to the card object
        function(oracleData, printedData, legalities, printings, languages) {
	    Object.keys(oracleData).forEach(function(key) {
	        card[key] = oracleData[key];
	    });
	    Object.keys(printedData).forEach(function (key) {
                card[key] = printedData[key];
            });

            card.legalities = legalities;
            card.printings = printings;
            card.foreignNames = languages;
            this();
        },
        // Send card (or error) to the callback
        function(err) {
            callback(err, card);
        }
    );
};

var parseTokenForSet = function(setCode, callback) {
    var SET, _tokens;

    tiptoe(
    function() {
        tokens.forSet(setCode, this);
    },
    function(data) {
        _tokens = data;
        sets.load(setCode, this);
    },
    function(_SET) {
        SET = _SET;
        if (!SET.tokens) SET.tokens = [];
        async.each(_tokens, function(token, cb) {
        var setToken = findTokenInSet(token.name, SET);
        if (setToken == null) {
            setToken = token;
            SET.tokens.push(setToken);
            setToken['_id'] = uuid();
        }

        Object.keys(token).forEach(function(k) {
            setToken[k] = token[k];
        });

        // Sort keys
        var keys = Object.keys(setToken).sort();
        keys.forEach(function(k) {
            var aux = setToken[k];
            delete setToken[k];
            setToken[k] = aux;
        });

        cb();
        }, this);
    },
    function() {
        sets.save(SET, this);
    },
    function(err) {
        if (err) throw(err);
        callback();

    }
    );
};

var cli = {
    'help': function() {
    console.log('MTGJSON v4');
    console.log('Available commands:');
    Object.keys(cli).forEach(function(cmd) {
        console.log('  ' + cmd);
    });

    this();
    },
    'build': function() {
    var args = Array.prototype.slice.call(arguments, 0);

    async.eachSeries(args, function(setCode, cb) {
        var SET = null;
        tiptoe(
            function() {
                sets.load(setCode, this);
            },
            function(_SET) {
                SET = _SET;
                console.log('Downloading list of cards for %s...', SET.name);
                //cardGrab.downloadSetCardList(SET.name, this);
                cardGrab.downloadSetCardListCompact(SET.name, this);
            },
            function(cards) {
                var i = 0;
                if (!SET.cards) {
                    SET.cards = [];
                }

                async.eachSeries(cards, function(card, cb) {
                    i++;
                    console.log('Retrieving data for card "%s" %d/%d', card.name, i, cards.length);
                    downloadCard(card, function(err, c) {
                        if (err) throw(err);
                        sets.add(SET, c, cb);
                    });
                }, this);
            },
            function() {
                // Save set.
                    sets.save(SET, this);
                },
                function(err) {
                    if (err) throw(err);
                    cb();
                }
        );
    }, this);
    },
    'token': function() {
    var args = Array.prototype.slice.call(arguments, 0);

    async.eachSeries(args, parseTokenForSet, this);
    }
};

var command = process.argv[2];
var args = Array.prototype.slice.call(process.argv, 3);

if (Object.keys(cli).indexOf(command) < 0)
    command = 'help';

init(function(err) {
    if (err) throw(err);

    cli[command].apply(cleanup, args);
});
