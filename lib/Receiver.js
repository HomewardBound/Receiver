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
                                            onUpdate: function(config) {
                                                // self.updateMsgSockets(config); FIXME
                                            }});

    this.updateMsgSockets(this.config);
    this.configureApp(this.app);
};

Receiver.prototype.isValidMeasurement = function(request) {
    return !!request.uuid;
};

// Add storage functionality
_.assign(Receiver.prototype, ReceiverStorage.prototype);

Receiver.prototype.initMsgSockets = function() {
    this.pubSocket = zeromq.socket('pub');
    ReceiverStorage.prototype.initMsgSockets.call(this);
};

Receiver.prototype.updateMsgSockets = function(config) {
    this.initMsgSockets();
    this.pubSocket.bindSync(config.calcRequestBroker);
    ReceiverStorage.prototype.updateMsgSockets.call(this, config);
};

Receiver.prototype.configureApp = function(app) {
    var self = this;

    // Set up express
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    // Routes
    app.post('/', function(req, res) {
        if (self.isValidMeasurement(req.body)) {
            // Publish message to computation apps
            var msg = self.createCalculationMsg(req.body);
            self.pubSocket.send(msg);

            res.status(200).send('Location Update for '+req.id+' has been received!');
        } else {
            res.status(400).send('Unrecognized Request');
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
