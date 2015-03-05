'use strict';

var Receiver = require('./lib/Receiver.js'),
    start = function() {
        var app = new Receiver();
        app.start();
    };

start();
