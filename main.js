'use strict';

var throng = require('throng'),
    Receiver = require('./lib/Receiver.js'),
    start = function() {
        new Receiver().start();
    };

throng(start);
