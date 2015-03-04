'use strict';

var express = require('express'),
    bodyParser = require('body-parser'),
    zeromq = require('zmq'),
    _ = require('lodash'),
    ConfigManager = require('./ConfigManager'),
    ReceiverStorage = require(__dirname+'/Receiver.Storage');

var Receiver = function(configFile) {
    var self = this;

    configFile = configFile || './config.js';
    this.config = {};
    this.app = express();
    this.initMsgSockets();
    this.configManager = new ConfigManager({filename: configFile, 
                                            config: this.config, 
                                            onUpdate: function(config, oldConfig) {
                                                self.updateMsgSockets(config, oldConfig);
                                            }});

    this.configureApp(this.app);
    ReceiverStorage.prototype.initialize.call(this, this.config);
};

// Add storage functionality
_.assign(Receiver.prototype, ReceiverStorage.prototype);

Receiver.prototype.initMsgSockets = function() {
    this.pubSocket = zeromq.socket('pub');
    ReceiverStorage.prototype.initMsgSockets.call(this);
};

Receiver.prototype.updateMsgSockets = function(config, oldConfig) {
    if (oldConfig.calcRequestBroker) {
        this.pubSocket.unbindSync(oldConfig.calcRequestBroker);
    }

    this.pubSocket.bindSync(config.calcRequestBroker);
    ReceiverStorage.prototype.updateMsgSockets.call(this, config, oldConfig);
};

Receiver.prototype.configureApp = function(app) {
    var self = this;

    // Set up express
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    // Routes
    app.post('/', function(req, res) {
        var request = self.cleanRequestFields(req.body);
        if (!self.hasValidStructure(request)) {
            res.status(400).send('Unrecognized Request');
        } else {
            self.isMeasuringItem(request.uuid, function(err, measuring) {
console.log('IS MEASURING:', measuring);
                if (err) {
                    console.error('Could not validate measurement:', err);
                } else if (!measuring) {
                    res.status(204).send('Not measuring the given entity');
                } else {
                    // Publish message to computation apps
                    var msg = self.createCalculationMsg(req.body);
                    //console.log('Publishing to ComputationApps: ', msg);
                    self.pubSocket.send(msg);
                    res.status(202).send('Location Update for '+req.id+' has been received!');
                }
            });
        }

    });

};

Receiver.prototype.start = function() {
    var self = this;
    this.app.listen(this.config.port, function() {
        console.log('Listening on port '+self.config.port);
    });
};

Receiver.prototype.createCalculationMsg = function(msg) {
    var header = 'calculation_v'+this.config.calculationVersion;
    return header+JSON.stringify(msg);
};

module.exports = Receiver;
