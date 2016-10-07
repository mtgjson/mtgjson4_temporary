'use strict';

var fs = require('fs');
var path = require('path');

var yaml = require('js-yaml');

var config = {};

config.load = function(filename, callback) {
    if (!callback && typeof(filename) == 'function') {
	callback = filename;
	filename = undefined;
    }
    
    filename = filename || path.join(__dirname, 'config.yaml');

    fs.readFile(filename, 'utf8', function(err, data) {
	if (err) {
	    callback(err);
	    return;
	}

	var doc = yaml.safeLoad(data);

	var i, keys = Object.keys(doc);
	for (i = 0; i < keys.length; i++)
	    config[keys[i]] = doc[keys[i]];

	callback(null, config);
    });
};

module.exports = config;
