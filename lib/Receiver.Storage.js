'use strict';

var zeromq = require('zmq'),
    mongoose = require('mongoose');

var ReceiverStorage = function() {
};

ReceiverStorage.prototype.initialize = function(config) {
    mongoose.connect(config.mongoUrl);
    this.database = mongoose.connection;

    this.database.on('error', console.error.bind(console, 'Mongo Connection Error:'));
    this.database.once('open', function(callback) {
        console.log('Connected to MongoDB at '+config.mongoUrl);
        // TODO 
    });
};

ReceiverStorage.prototype.initMsgSockets = function() {
    this.notifySocket = zeromq.socket('pub');
    this.subSocket = zeromq.socket('sub');

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

ReceiverStorage.prototype.updateMsgSockets = function(config, oldConfig) {
    if (oldConfig.notifyBroker) {
        this.notifySocket.unbindSync(config.notifyBroker);
    }

    // Create publisher to notify storage of new pet location
    this.notifySocket.bindSync(config.notifyBroker);

    // Create subscriber to calculation app responses
    if (oldConfig.storageRequestBroker) {
        this.subSocket.disconnect(oldConfig.storageRequestBroker);
        this.subSocket.unsubscribe(oldConfig.storageRequestChannel);
    }

    this.subSocket.connect(config.storageRequestBroker);
    this.subSocket.subscribe(config.storageRequestChannel);

};

ReceiverStorage.prototype.hasValidStructure = function(request) {
    var keys = ['uuid', 'latitude', 'longitude', 'radius', 'timestamp'],
        valid = true;

    for (var i = keys.length; i--;) {
        valid = valid && request.hasOwnProperty(keys[i]);
    }

    return valid;
};

// Check that the measurement is valid and missing
ReceiverStorage.prototype.isValidMeasurement = function(request) {
    return this.hasValidStructure(request) && this.isMissingItem(request.uuid);
};

ReceiverStorage.prototype.isMissingItem = function(uuid) {
    return true;
};

ReceiverStorage.prototype.storeMeasurement = function(measurement) {
    // TODO
    return true;
};

ReceiverStorage.prototype.publishPetLocation = function(data) {
    var msg = data.toString(),
        index = msg.indexOf('{'),
        json = msg.substring(index),
        measurement = JSON.parse(json);

    this.notifySocket.send(measurement.uuid+' '+JSON.stringify(measurement));
};

module.exports = ReceiverStorage;
