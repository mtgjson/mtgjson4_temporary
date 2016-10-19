'use strict';

var downloader = require('./downloader');

var cheerio = require('cheerio');
var hitme = require('hitme');
var async = require('async');

var buildUrl = function(url, parameters) {
    var ret = module.exports.url_prefix + url;
    if (parameters) {
    var keys = Object.keys(parameters).sort();
    var aux = [];

    keys.forEach(function(key) {
        var value = parameters[key];
        if (typeof(value) == 'string') {
        value = value.replace(/ /g, '+');
        }

        aux.push(key + '=' + value);
    });
    ret += '?' + aux.join('&');
    }

    return(ret);
};

var downloadFiles = function(multiverseid, callback) {
    var oracleUrl = buildUrl(
    '/Pages/Card/Details.aspx',
    { 'printed': 'false', 'multiverseid': multiverseid }
    );
    var printedUrl = buildUrl(
    '/Pages/Card/Details.aspx',
    { 'printed': 'true', 'multiverseid': multiverseid }
    );

    var ret = {
    multiverseid: multiverseid,
        languages: [],
        printings: []
    };

    var caller = hitme(callback);
    caller.data = ret;

    caller(function(cb) {
    downloader.get(oracleUrl).then(function(data) {
            ret.oracle = data.getBody();
        cb();
        }).fail(function(data) { callback(data); });
    });
    caller(function(cb) {
        downloader.get(printedUrl).then(function(data) {
            ret.printed = data.getBody();
            cb();
        }).fail(function(data) { callback(data); });
    });

    // Download all the printings URLS
    var grabPrintings = function(page, callback) {
        var maxPage = 1;
        if (grabPrintings.maxPage)
            maxPage = grabPrintings.maxPage;
	var url = buildUrl('/Pages/Card/Printings.aspx', { 'page' : page, 'multiverseid': multiverseid });

	downloader.get(url).then(function(data) {
            ret.printings.push(data.getBody());

            var $ = cheerio.load(data.getBody());
            var pages = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_PrintingsList_pagingControlsContainer');
            if (pages.length > 0) {
		$('a', pages).each(function(idx, obj) {
		    var n = parseInt($(obj).text().trim());
		    if (n > maxPage)
			maxPage = n;
		});
            }

            page++;
            grabPrintings.maxPage = maxPage;
            if (page < maxPage)
                setImmediate(grabPrintings, page, callback);
            else
                callback();
	}).fail(function(data) { callback(data); });
    };

    // Download all languages URLS
    var grabLanguages = function(page, callback) {
        var maxPage = 1;
        if (grabLanguages.maxPage)
            maxPage = grabLanguages.maxPage;
        var url = buildUrl('/Pages/Card/Languages.aspx', { 'page': page, 'multiverseid': multiverseid });

    downloader.get(url).then(function(data) {
            ret.languages.push(data.getBody());

        var $ = cheerio.load(data.getBody());
        var pages = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_languageList_pagingControls');
        if (pages.length > 0) {
        $('a', pages).each(function(idx, obj) {
            var n = parseInt($(obj).text().trim());
            if (n > maxPage)
            maxPage = n;
        });
        }

            page++;
            grabLanguages.maxPage = maxPage;
            if (page < maxPage)
                setImmediate(grabLanguages, page, callback);
            else
                callback();
    }).fail(function(data) { callback(data); });
    };

    caller(function(cb) {
        grabPrintings(0, cb);
    });
    caller(function(cb) {
        grabLanguages(0, cb);
    });
};

module.exports = function(multiverseid, callback) {
    console.log(multiverseid);
    downloadFiles(multiverseid, function(err, data) {
        console.log(Object.keys(data));
        callback(err, data);
    });
};

module.exports.url_prefix = 'http://gatherer.wizards.com';

module.exports.downloadFiles = downloadFiles;

module.exports.downloadSetCardListCompact = function(setName, callback) {
    var set = setName.replace(/ /g, '+');
    var maxpages = 1;

    var ret = [];

    var downloadPage = function(pagenum) {
    var url = buildUrl('/Pages/Search/Default.aspx', { 'output': 'compact', 'set': '%5b%22' + set + '%22%5d', 'page': pagenum });

    downloader.get(url).then(function(data) {
        var $ = cheerio.load(data.getBody());

        var pageList = $('#ctl00_ctl00_ctl00_MainContent_SubContent_topPagingControlsContainer');
        $('a', pageList).each(function(idx, obj) {
        var num = parseInt($(obj).text());
        if (num > maxpages)
            maxpages = num;
        });

        // Read the cards
        var checklist = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_searchResultsContainer tr.cardItem');
        checklist.each(function(idx, cardItem) {
        var obj = $('.name a', cardItem);
        var name = $(obj).html().replace(/&apos;/g, "'");
        var printings = $('.printings a', cardItem);
        var i;
        for (i = 0; i < printings.length; i++) {
            var multiverseid = $(printings[i]).attr('href').match(/multiverseid=([^&]*)/)[1];
            ret.push({ 'name': name, 'multiverseid': multiverseid });
        }
        });

        // Next page?
        pagenum++;
        if (pagenum < maxpages) {
            setImmediate(downloadPage, pagenum);
        }
        else {
            callback(null, ret);
        }
    }).fail(function(data) { callback(data); });
    };

    downloadPage(0);
};

/**
 * Callback returns two parameters
 * err: not null if an error occurred.
 * data: array with basic card information found on set. Each array element has the following keys:
 *      number, name, multiverseid, artist, color, rarity, set
 */
module.exports.downloadSetCardList = function(setName, callback) {
    var set = setName.replace(/ /g, '+');
    var maxpages = 1;

    var ret = [];

    var downloadPage = function(pagenum) {
    var url = buildUrl('/Pages/Search/Default.aspx', { 'output': 'checklist', 'set': '%5b%22' + set + '%22%5d', 'page': pagenum });

    downloader.get(url).then(function(data) {
        var $ = cheerio.load(data.getBody());

        var pageList = $('#ctl00_ctl00_ctl00_MainContent_SubContent_topPagingControlsContainer');
        $('a', pageList).each(function(idx, obj) {
        var num = parseInt($(obj).text());
        if (num > maxpages)
            maxpages = num;
        });

        // Read the cards
        var checklist = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_searchResultsContainer tr.cardItem');
        checklist.each(function(idx, cardItem) {
        var obj = $('.nameLink', cardItem);
        var card = {};
        card.number = $('.number', cardItem).html();
        card.name = $(obj).html().replace(/&apos;/g, "'");
        card.multiverseid = $(obj).attr('href').match(/multiverseid=([^&]*)/)[1];
        card.artist = $('.artist', cardItem).html();
        card.color = $('.color', cardItem).html();
        card.rarity = $('.rarity', cardItem).html();
        card.set = $('.set', cardItem).html();
        ret.push(card);
        });

        // Next page?
        pagenum++;
        if (pagenum < maxpages) {
        setImmediate(downloadPage, pagenum);
        }
        else {
        callback(null, ret);
        }
    }).fail(function(data) { callback(data); });
    };

    downloadPage(0);
};

module.exports.downloadAllSetsInfo = function(callback) {
    var url = buildUrl('/Pages/Default.aspx');

    downloader.get(url).then(function(data) {
    var $ = cheerio.load(data.getBody());

    var setNames = [];
    var i;

    var options = $('#ctl00_ctl00_MainContent_Content_SearchControls_setAddText option');
    for (i = 0; i < options.length; i++) {
        var option = options[i];
        var value = $(option).attr('value');
        if (value != '')
        setNames.push(value);
    }

    var ret = [];

    async.eachSeries(
        setNames,
        function(set, cb) {
        var setUrl = buildUrl('/Pages/Search/Default.aspx', { output: 'standard', set: '%5b%22' + set + '%22%5d' });

        downloader.get(setUrl).then(function(data) {
            var $ = cheerio.load(data.getBody());
            var obj = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_ctl00_listRepeater_ctl01_cardSetCurrent img');
            if (obj.length > 0) {
            var setCode = obj.attr('src').replace(/.*set=([^&]*).*/, '$1');
            var aux = { name: set, code: setCode };

            ret.push(aux);
            }
            else {
            console.log("Cannot retrieve information for set %s", set);
            }

            cb();
        }).fail(function(data) {
            throw(new Error("Error downloading " + setUrl));
        });
        },
        function() {
        callback(null, ret);
        }
    );
    }).fail(function(data) { callback(data); });
};
