'use strict';

// This is the database schema for the location measurements

module.exports = {
    uuid: String,  // This is the beacon id of the pet/measurement
    latitude: Number,
    longitude: Number,
    radius: Number,
    timestamp: Number
};
