'use strict';

var fs = require('fs');
var path = require('path');

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

// From: http://www.davekoelle.com/alphanum.html
var sortAlphaNum = function(a,b) {
    var reA = /[^a-zA-Z]/g;
    var reN = /[^0-9]/g;
    var AInt = parseInt(a, 10);
    var BInt = parseInt(b, 10);

    if(isNaN(AInt) && isNaN(BInt)){
        var aA = a.replace(reA, "");
        var bA = b.replace(reA, "");
        if(aA === bA) {
            var aN = parseInt(a.replace(reN, ""), 10);
            var bN = parseInt(b.replace(reN, ""), 10);
            return aN === bN ? 0 : aN > bN ? 1 : -1;
        } else {
            return aA > bA ? 1 : -1;
        }
    }else if(isNaN(AInt)){//A is not an Int
        return 1; //to make alphanumeric sort first return -1 here
    }else if(isNaN(BInt)){//B is not an Int
        return -1; //to make alphanumeric sort first return 1 here
    }else{
        return AInt > BInt ? 1 : -1;
    }
};

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

    fs.writeFile(setPath, JSON.stringify(set, null, 2), 'utf-8', callback);
};

module.exports = {
    load: set_load,
    save: set_save
};
