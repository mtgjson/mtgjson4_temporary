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
	    var fallbackPath = path.join(__dirname, 'sets', set_code + '.json');
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

var set_save = function(set, callback) {
    var setPath = path.join(__dirname, 'db', set.code + '.json');

    fs.writeFile(setPath, JSON.stringify(set), 'utf-8', callback);
};

module.exports = {
    load: set_load,
    save: set_save
};
