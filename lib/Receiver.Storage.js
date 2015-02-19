'use strict';

var zeromq = require('zmq'),
    mongoose = require('mongoose'),
    MeasurementSchema = require(__dirname+'/MeasurementSchema');

var ReceiverStorage = function() {
};

ReceiverStorage.prototype.initialize = function(config) {
    var self = this;
    mongoose.connect(config.mongoUrl);
    this.database = mongoose.connection;
    this.MeasurementModel = null;
    this._measurementQueue = [];

    this.database.on('error', console.error.bind(console, 'Mongo Connection Error:'));
    this.database.once('open', function(callback) {
        console.log('Connected to MongoDB at '+config.mongoUrl);

        self.MeasurementModel = mongoose.model('Location', mongoose.Schema(MeasurementSchema));
        self.processQueue();
    });
};

ReceiverStorage.prototype.initMsgSockets = function() {
    this.notifySocket = zeromq.socket('pub');
    this.subSocket = zeromq.socket('sub');

    var self = this;
    this.subSocket.on('message', function(data) {
        var measurement = JSON.parse(data.toString().substring(self.config.storageRequestChannel.length));
        console.log('received message:',measurement);
        if (self.hasValidStructure(measurement)) {
            // Publish the pet location
            console.log('Publishing pet location for '+data);
            self.publishPetLocation(measurement);

            // Store the message
            console.log('Storing measurement for '+data);
            self.storeMeasurement(measurement);
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
    var keys = Object.keys(MeasurementSchema),
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
    if (this.MeasurementModel !== null) {
        var model = new this.MeasurementModel(measurement);
        console.log('About to save measurement');
        model.save(function(err) {
            if (err) {
                console.error('Error saving measurement '+ JSON.stringify(measurement) + 
                              '\nError is '+err);
            } else {
                console.log('Successfully stored measurement: '+JSON.stringify(measurement));
            }
        });
    } else {
        console.log('Adding measurement to queue: '+measurement);
        this._measurementQueue.push(measurement);
    }

    return !!this.measurementModel;
};

ReceiverStorage.prototype.processQueue = function() {
    console.log('Processing measurement queue (queue length is '+this._measurementQueue.length+')');
    for (var i = this._measurementQueue.length; i--;) {
        this.storeMeasurement(this._measurementQueue[i]);
    }
};

ReceiverStorage.prototype.publishPetLocation = function(measurement) {
    this.notifySocket.send(measurement.uuid+' '+JSON.stringify(measurement));
};

module.exports = ReceiverStorage;
