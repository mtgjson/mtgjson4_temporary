'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var hitme = require('hitme');
var requestify = require('requestify');
var redis = require('redis');
var crypto = require('crypto');

// Filesystem cache provider for requestify
var fscache = {
    cache_root: '',
    encodeurl: function(url) {
        var shasum = crypto.createHash('sha1');
        shasum.update(url);
        var digest = shasum.digest('hex');
        return(digest);
    },
    get: function(url, callback) {
        console.log("get(%s,...)", url);
        var key = fscache.encodeurl(url);
        var fn = path.join(fscache.cache_root, key[0], key);
        fs.readFile(fn, 'utf8', function(err, data) {
            if (err) {
                if (err.code == 'ENOENT') {
                    // Ignore file not found errors
                    callback();
                    return;
                }
                callback(err);
                return;
            }
            callback(null, JSON.parse(data));
        });
    },
    set: function(url, data, callback) {
        var key = fscache.encodeurl(url);
        var fn = path.join(fscache.cache_root, key[0], key);
        fs.writeFile(fn, JSON.stringify(data), callback);
    },
    purge: function(url, callback) {
        var key = fscache.encodeurl(url);
        var fn = path.join(fscache.cache_root, key[0], key);
        fs.stat(fn, function(err, stat) {
            if (err == null) {
                fs.unlink(fn, callback);
                return;
            }
            if (err.code == 'ENOENT') {
                callback();
                return;
            }
            callback(err, stat);
        });
    }
};

var module_initialized = false;

module.exports = {};

// Exposes the requestify if needed elsewhere
module.exports.requestify = requestify;

// A simple wrapper to requestify get method
module.exports.get = function(url, options) {
    if (!module_initialized)
        throw(new Error("Downloader module not initialized."));
    
    if (!options)
        options = {};

    if (!options.cache) {
        options.cache = {
            cache: true,
            expires: module.exports.expires
        };
    }

    return(requestify.get(url, options));    
};

// initialize the downloader module fom the cache configuration data.
module.exports.init = function(cache_config, callback) {
    if (!callback && typeof(cache_config) == 'function') {
        callback = cache_config;
        cache_config = undefined;
    }

    if (!cache_config)
        cache_config = {};
    if (!cache_config.provider)
        cache_config.provider = 'memory';


    // Copy the config
    Object.keys(cache_config).forEach(function(cfg) {
    if (module.exports[cfg] === undefined)
        module.exports[cfg] = cache_config[cfg];
    else
        console.log("ERROR: Reserved config variable: %s",  cfg);
    });

    if (module.exports.expires === undefined)
        module.exports.expires = 3600000; // 1h

    module_initialized = true;

    if (cache_config.provider == 'none') {
        callback();
    }

    if (cache_config.provider == 'fs') {
        var cache_path;
        if (cache_config.path) {
            if (cache_config[0] == '/')
                cache_path = cache_config.path;
            else
                cache_path = path.join(__dirname, cache_config.path);
        }
    else
        cache_path = path.join(__dirname, 'cache');

    // Set the cache root folder on our cache provider
    fscache.cache_root = cache_path;
    requestify.cacheTransporter(fscache);
    
    // Create cache filesystem structure for the "fs" provider.
    fs.mkdir(cache_path, function() {
        async.each(
        '0123456789abcdef',
        function(folder, cb) {
            fs.mkdir(path.join(cache_path, folder), function() { cb(); });
        },
        callback
        );
    });
    }

    if (cache_config.provider == 'redis') {
        var redis_options = {};
        if (cache_config.host)
            redis.host = cache_config.host;
        if (cache_config.port)
            redis.port = cache_config.port;
        
        var client = redis.createClient(redis_options);
        module.exports.redis_client = client;
        requestify.cacheTransporter(requestify.coreCacheTransporters.redis(client));

        callback();
    }
}

// This functions quits the redis client, if we're using it.
module.exports.cleanup = function(callback) {
    if (module.exports.provider == 'redis')
        module.exports.redis_client.quit();

    if (callback && typeof(callback) == 'function')
        callback();
};

