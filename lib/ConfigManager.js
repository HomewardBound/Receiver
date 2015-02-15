'use strict';
var fs = require('fs'),
    nodeWatch = require('node-watch'),
    defaultName = 'config.js',
    defaults = JSON.parse(fs.readFileSync(__dirname+'/config.default.js', 'utf-8')),
    config;

var updateConfig = function(data) {
    var value = JSON.parse(data),
        keys = Object.keys(config),
        i;

    // Remove old values
    for (i = keys.length; i--;){
        delete config[keys[i]];
    }

    // Add new values
    keys = Object.keys(value);
    for (i = keys.length; i--;){
        config[keys[i]] = value[keys[i]];
    }
};

var loadConfig = function(filename) {
    var value;

    fs.readFile(filename, 'utf-8', function(err, data) {
        try {
            updateConfig(data);
        } catch (e) {
            console.error('Cannot read the configuration file '+e);
        }
    });
};

var start = function(filename, file) {
    var data;

    config = file;

    filename = filename || defaultName;
    if (fs.existsSync(filename)) {
        // Read sync the first time
        data = fs.readFileSync(filename, 'utf-8');
        updateConfig(data);
    } else {  // Create a new config file
        fs.writeFileSync(filename, JSON.stringify(defaults));
    }

    nodeWatch(filename, function() {
        loadConfig(filename);
    });
};


module.exports = {watch: start, config: config};

