'use strict';

var Message = function(id, latitude, longitude, distance) {
    this.id = id;
    this.latitude = latitude;
    this.longitude = longitude;
    this.distance = distance;
};

module.exports = Message;
