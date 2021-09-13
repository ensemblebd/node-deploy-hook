const fs = require('fs');

module.exports = function(path, thing) {
    var output = thing;
    if (typeof(thing)==='object') output = JSON.stringify(thing);

    fs.writeFile(path, output, err => {
        if (err) {
          console.error(err);
        }
    });
}