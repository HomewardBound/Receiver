'use strict';
var fs = require('fs'),
    nodeWatch = require('node-watch');

var ConfigManager = function(options) {
    this.filename = options.filename || 'config.js';
    this.defaults = fs.readFileSync(__dirname+'/config.default.js', 'utf-8');
    this.config = options.config || {};
    this.onUpdate = options.onUpdate || null;  // Callback function

    this.start();
};

ConfigManager.prototype.updateConfig = function(data) {
    var old = {},
        value = JSON.parse(data),
        keys = Object.keys(this.config),
        i;

    // Remove old values
    for (i = keys.length; i--;){
        old[keys[i]] = this.config[keys[i]];
        delete this.config[keys[i]];
    }

    // Add new values
    keys = Object.keys(value);
    for (i = keys.length; i--;){
        this.config[keys[i]] = value[keys[i]];
    }

    // Call update function, if needed
    if (this.hasOnUpdate()) {
        this.onUpdate(this.config, old);
    }
};

ConfigManager.prototype.hasOnUpdate = function() {
    return !!this.onUpdate;
};

ConfigManager.prototype.loadConfig = function(filename) {
    var value,
        self = this;

    fs.readFile(this.filename, 'utf-8', function(err, data) {
        try {
            self.updateConfig(data);
        } catch (e) {
            console.error('Cannot read the configuration file '+e);
        }
    });
};

ConfigManager.prototype.start = function() {
    var data,
        self = this;

    if (fs.existsSync(this.filename)) {
        // Read sync the first time
        data = fs.readFileSync(this.filename, 'utf-8');
    } else {  // Create a new config file
        console.log('Created new configuration file at '+this.filename);
        data = this.defaults;
        fs.writeFileSync(this.filename, this.defaults);
    }

    this.updateConfig(data);

    nodeWatch(this.filename, function() {
        self.loadConfig(self.filename);
    });
};



module.exports = ConfigManager;

