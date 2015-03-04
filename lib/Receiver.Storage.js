'use strict';

var zeromq = require('zmq'),
    mongojs = require('mongojs'),
    MeasurementSchema = require(__dirname+'/MeasurementSchema');

var ReceiverStorage = function() {
};

ReceiverStorage.prototype.initialize = function(config) {
    var self = this;
    
    this._measurementQueue = [];
    this._itemsCollection = config.entityCollection;
    this._locationCollection = config.locationCollection;
    this.database = mongojs.connect(config.mongoUrl, [this._itemsCollection, this._locationCollection]);

    this.database.on('error', console.error.bind(console, 'Mongo Connection Error:'));
    this.database.on('ready', function(callback) {
        console.log('Connected to MongoDB at '+config.mongoUrl);

        self.processQueue();
    });
};

ReceiverStorage.prototype.initMsgSockets = function() {
    this.notifySocket = zeromq.socket('pub');
    this.subSocket = zeromq.socket('sub');

    var self = this;
    this.subSocket.on('message', function(data) {
        var cleanedMsg = data.toString(),
            measurement;

        console.log('Received storage message: '+data);
        // Remove the beginning topic
        cleanedMsg = cleanedMsg.substring(cleanedMsg.indexOf('{'));

        // Remove any extra trailing characters
        cleanedMsg = cleanedMsg.substring(0, cleanedMsg.lastIndexOf('}')+1);
        measurement = JSON.parse(cleanedMsg);
        console.log('Received storage request for ',measurement);

        // To verify the request we filter by white-listed attributes
        // then verify the number of fields. This prevents a DDoS vulnerability
        // from actually iterating over all received request fields.
        measurement = self.cleanRequestFields(measurement);
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
        this.notifySocket.unbindSync(oldConfig.notifyBroker);
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

/**
 * Filter by white-listed attributes.
 *
 * @param {Object} request
 * @return {Object}
 */
ReceiverStorage.prototype.cleanRequestFields = function(request) {
    var keys = Object.keys(MeasurementSchema),
        result = {};

    for (var i = keys.length; i--;) {
        result[keys[i]] = request[keys[i]];
    }

    return result;
};

/**
 * Verify that the measurement has all the required keys other entries. As it 
 * has already been filtered, we can simply check the number of keys.
 *
 * @param {Object} request
 * @return {Boolean} valid
 */
ReceiverStorage.prototype.hasValidStructure = function(request) {
    var expectedKeys = Object.keys(MeasurementSchema),
        keys = Object.keys(request);

    return keys.length === expectedKeys.length;
};

ReceiverStorage.prototype.isMeasuringItem = function(uuid, callback) {
    this.database[this._itemsCollection].findOne({uuid: uuid}, function(err, item) {
        console.log('item:', item);
        return callback(err, (item && item.isMeasuring));
    });
};

ReceiverStorage.prototype.storeMeasurement = function(measurement) {
    if (this.MeasurementModel !== null) {
        this.database[this._locationCollection].save(measurement, function(err, saved) {
            if (err || !saved) {
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
