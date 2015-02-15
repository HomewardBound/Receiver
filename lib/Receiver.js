'use strict';

var express = require('express'),
    bodyParser = require('body-parser'),
    zeromq = require('zmq'),
    ConfigManager = require('./ConfigManager'),
    ReceiverStorage = require(__dirname+'/Receiver.Storage');

var Receiver = function(configFile) {
    configFile = configFile || './config.js';
    this.config = {};
    ConfigManager.watch(configFile, this.config);
    this.app = express();

    this.configureApp(this.app);
    this.configureMsgSockets();
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
            console.log('About to publish msg: ', msg);
            self.pubSocket.send(msg);

            res.status(200).send('Location Update for '+req.id+' has been received!');
        } else {
            res.status(400).send('Unrecognized Request');
        }
    });

};

Receiver.prototype.configureMsgSockets = function() {
    // Set up publish socket
    this.pubSocket = zeromq.socket('pub');
    this.pubSocket.bindSync('tcp://127.0.0.1:2001');

    ReceiverStorage.prototype.configureMsgSockets();
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

Receiver.prototype.isValidMeasurement = function(request) {
    return !!request.uuid;
};


module.exports = Receiver;
