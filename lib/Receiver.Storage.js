'use strict';

var zeromq = require('zmq');

var ReceiverStorage = function() {
};

ReceiverStorage.prototype.initMsgSockets = function() {
    this.notifySocket = zeromq.socket('pub');
    this.subSocket = zeromq.socket('sub');
};

ReceiverStorage.prototype.updateMsgSockets = function(config) {

    // Create publisher to notify storage of new pet location
    this.notifySocket.bindSync(config.notifyBroker);

    // Create subscriber to calculation app responses
    this.subSocket.connect(config.storageRequestBroker);
    this.subSocket.subscribe('StoreMeasurement');

    var self = this;
    this.subSocket.on('message', function(data) {
        if (self.hasValidStructure(data)) {
            // Publish the pet location
            self.publishPetLocation(data);

            // Store the message
            self.storeMeasurement(data);
        } else {
            console.error('Bad message from calculation apps:', data);
        }
    });
};

ReceiverStorage.prototype.hasValidStructure = function(request) {
    return true;
};

// Check that the measurement is a missing pet from the database
ReceiverStorage.prototype.isValidMeasurement = function(request) {
    return !!request.uuid;
};

ReceiverStorage.prototype.storeMeasurement = function(measurement) {
};

ReceiverStorage.prototype.publishPetLocation = function(data) {
    var msg = data.toString(),
        index = msg.indexOf('{'),
        json = msg.substring(index),
        measurement = JSON.parse(json);

    this.notifySocket.send(measurement.uuid+' '+JSON.stringify(measurement));
};

module.exports = ReceiverStorage;
