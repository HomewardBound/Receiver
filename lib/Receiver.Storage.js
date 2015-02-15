'use strict';

var zeromq = require('zmq');

var ReceiverStorage = function() {
};

ReceiverStorage.prototype.configureMsgSockets = function() {
    // Create subscriber
    this.subSocket = zeromq.socket('sub');
    this.subSocket.connect('tcp://127.0.0.1:2001');
    this.subSocket.subscribe('StoreMeasurement');

    this.subSocket.on('message', function(data) {
        console.log('received response from computation apps');
        // Publish the pet location
        // TODO

        // Store the message
        // TODO
    });
    // TODO
};

// Check that the measurement is a missing pet from the database
ReceiverStorage.prototype.isValidMeasurement = function(request) {
};

ReceiverStorage.prototype.storeMeasurement = function(measurement) {
};

module.exports = ReceiverStorage;
