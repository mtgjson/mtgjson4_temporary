'use strict';

var xml2js = require('xml2js');
var downloader = require('./downloader');

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

var fixTokenStructure = function(_token) {
    var token = {};
    Object.keys(_token).forEach(function(k) {
	token[k] = _token[k];
    });
    
    if (Array.isArray(token.name))
	token.name = token.name[0];

    token.name = token.name.trim();

    token.printings = [];
    token.set.forEach(function(_set) {
	var cSet = _set['_'];
	var x = { 'set': cSet };
	if (_set['$'])
	    x.image = _set['$']['picURL'];

	token.printings.push(x);
    });

    delete token.set;
    delete token.manacost;
    delete token.tablerow;
    delete token.token;

    if (token.text && Array.isArray(token.text))
	token.text = token.text[0];

    if (token.text == '')
	delete(token.text);

    token.type = token.type[0];
    if (token.pt && token.pt[0] != "") {
	var pt = token.pt[0].split('/');
	token.power = pt[0];
	token.toughness = pt[1];
    }
    delete token.pt;

    // Sort keys
    var keys = Object.keys(token).sort();
    keys.forEach(function(k) {
	var aux = token[k];
	delete token[k];
	token[k] = aux;
    });

    return(token);
};

var forSet = function(setCode, callback) {
    grab(function(err, data) {
	if (err) throw(err);

	var tokens = data.cockatrice_carddatabase.cards[0].card;
	var ret = [];
	console.log('Parsing %d tokens', tokens.length);

	tokens.forEach(function(_token) {
	    var token = fixTokenStructure(_token);

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
