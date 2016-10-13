'use strict';

// This code is adapted from http://stackoverflow.com/a/2117523/488212
var uuid = function() {
    var ret = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = (c == 'x')?r:r&(0x3|0x8);
    return (v.toString(16));
    });

    return(ret);
};

module.exports = uuid;

if (require.main == module) {
    // Called directly
    var count = 1;
    //console.log(process.argv);

    if (process.argv.length >= 3)
    count = parseInt(process.argv[2]);

    if (count < 1)
    count = 1;

    for (var i = 0; i < count; i++)
    console.log(uuid());
}
