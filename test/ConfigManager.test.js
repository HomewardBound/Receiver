/*globals describe,after,beforeEach,it,assert,before*/

'use strict';
var assert = require('assert'),
    fs = require('fs'),
    ConfigManager = require('../lib/ConfigManager.js'),

    config,
    configFilename = __dirname+'/__config__',
    filesToRemove = [];

var saveConfig = function(config) {
    fs.writeFileSync(configFilename, JSON.stringify(config));
};

describe('Testing ConfigManager', function() {
    before(function() {
        while(fs.existsSync(configFilename)) {
            configFilename += '_';
        }
    });

    beforeEach(function() {
        config = {};
    });

    it('should create default config if file doesn\'t exist', function() {
        var configManager = new ConfigManager({filename: configFilename, config: config});
        assert(config.port);
    });

    it('should save generated default config if none provided', function() {
        var configManager = new ConfigManager({filename: configFilename, config: config});
        assert(fs.existsSync(configFilename), 'New config not saved');
    });

    it('should load initial configuration', function() {
        saveConfig({port:7079});
        var configManager = new ConfigManager({filename: configFilename, config: config});
        assert(config.port === 7079, 'Initial configuration not loaded');
    });

    it('should update configuration fields on file change', function(done) {
        saveConfig({port:7079});
        var updateNum = 0,
            configManager = new ConfigManager({filename: configFilename, 
                                               config: config,
                                               onUpdate: function(config) {
                                                   assert(config.port === 7077 || ++updateNum === 1, 
                                                       'config.port should be 7077 but was '+config.port); 
                                                   done();
                                                } });

        setTimeout(saveConfig, 100, {port:7077});
    });

    it('should remove configuration fields on file edit', function(done) {
        saveConfig({old: true, port:7079});
        var updateCount = 0,  // Skip the initial update
            options = {filename: configFilename, config: config},
            configManager;

        options.onUpdate = function(config) {
            assert(config.old === undefined || ++updateCount === 1, 'config.old still exists in the config'); 
            done();
        };

        configManager = new ConfigManager(options);
        saveConfig({port:7079});
    });

    it('should not update configuration if file contains syntax error', function(done) {
        saveConfig({port:7079});
        var configManager = new ConfigManager({filename: configFilename, config: config});
        fs.writeFileSync(configFilename, '{ asdf..clalldl;a');
        setTimeout(function() { assert(config.port === 7079); done();}, 150);
    });

    after(function() {
        // Remove all additional files
        if (fs.existsSync(configFilename)) {
            fs.unlink(configFilename, function(err) {
                if (err) {
                    console.error('Could not remove file. \n'+err);
                } 
            });
        }
    });

});
