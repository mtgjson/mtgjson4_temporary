'use strict';

var xml2js = require('xml2js');
var downloader = require('./downloader');
var parser = require('./parser');

var tokenURL = 'https://raw.githubusercontent.com/Cockatrice/Magic-Token/master/tokens.xml';

var grab = function(callback) {
    downloader.get(tokenURL).then(function(_data) {
        var data = _data.getBody();

        var ret = xml2js.parseString(data, function (err, result) {
            if (err) throw (err);
            callback(null, result);
        });
    }).fail(function(data) {
        callback(data);
    });
};

var forSet = function(setCode, callback) {
    grab(function(err, data) {
    if (err) throw(err);

    var tokens = data.cockatrice_carddatabase.cards[0].card;
    var ret = [];
    console.log('Parsing %d tokens', tokens.length);

    tokens.forEach(function(_token) {
        var token = parser.token(_token);

        var inSet = false;
        token.printings.forEach(function(p) {
        if (p.set == setCode)
            inSet = true;
        });

        if (inSet)
            ret.push(token);
    });

    callback(null, ret);
    });
};

module.exports = {
    'grab': grab,
    'forSet': forSet
};
