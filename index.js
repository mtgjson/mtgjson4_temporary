'use strict';

var hitme = require('hitme');
var async = require('async');
var tiptoe = require('tiptoe');
var config = require('./config');
var downloader = require('./downloader');
var cardGrab = require('./download_card.js');
var uuid = require('./uuid');
var sets = require('./sets');

function init(callback) {
    var caller = hitme.serial(callback);
    caller(config.load);
    caller(function(cb) { downloader.init(config.cache, cb); });
}

function cleanup() {
    console.log('- cleaning up -');
    downloader.cleanup();
}

/*
init(function(err) {
    if (err) throw(err);

    sets.load('SHM', function(err, SET) {
	console.log(SET);
    });
});
*/

var findCardInSet = function(multiverseid, set) {
    var findCB = function(element, index, array) {
	return(element.multiverseid == multiverseid);
    };

    return(set.cards.find(findCB));
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
		    cardGrab.downloadSetCardList(SET.name, this);
		},
		function(cards) {
		    if (!SET.cards) {
			SET.cards = [];
		    }
		    
		    async.eachSeries(cards, function(card, cb) {
			var setCard = null;
			if (card.multiverseid) {
			    setCard = findCardInSet(card.multiverseid, SET);
			}

			if (!setCard) {
			    console.log('New card: %s', card.name);
			    setCard = card;
			    card['_id'] = uuid();
			    SET.cards.push(card);
			}
			else {
			    // Merge data
			    Object.keys(card).forEach(function(key) {
				setCard[key] = card[key];
			    });
			}

			// TODO: Download and parse rest of data.
			cb();
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
