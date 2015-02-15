/*globals describe,after,beforeEach,it,assert,before*/

'use strict';
var assert = require('assert'),
    //Message = require('../lib/message'),
    zeromq = require('zmq'),
    http = require('http'),
    fs = require('fs'),
    Receiver = require('../lib/Receiver.js'),
    SERVER_ADDRESS = 'tcp://127.0.0.1:2001',

    app,
    testConfigFileName = __dirname + '/config.test.js',
    calcSocket,
    calculationReq,
    postOptions,
    receiver;

var createSubscriber = function(channel, callback) {
        calcSocket = zeromq.socket('sub');
        calcSocket.connect(SERVER_ADDRESS);
        calcSocket.subscribe(channel);
        calcSocket.on('message', callback);
};

describe('Testing Receiver', function() {
    before(function() {
        // Create the test config
        // Get the default config
        var defaultConfig = JSON.parse(fs.readFileSync(__dirname+'/../lib/config.default.js', 'utf-8'));

        // Change the port
        defaultConfig.port = 8080;

        // Save it to test file
        fs.writeFileSync(testConfigFileName, JSON.stringify(defaultConfig));

        // Create the server with test configuration
        app = new Receiver(testConfigFileName);
        app.start();
    });

    beforeEach(function() {
        postOptions = {
            host: '127.0.0.1', 
            port: app.config.port,
            method: 'POST',
            path: '/'
        };
    });

    describe('Basic HTTP communication', function() {

        it.only('should accept post messages to /', function(done) {
            console.log('sending post message to '+postOptions.host+':'+app.config.port);
            var post_req = http.request(postOptions, function(res) {
                console.log('response is ',res.statusCode);
                done();
            });
            post_req.end();
        });

    });

    it('should pass incoming json measurements to computation apps', function(done) {
        var calcChannel = app.createCalculationMsg(''),
            calcMsgReceived = false,
            checkMsgReceived = function() {
                assert(calcMsgReceived, 'Publish message not received');
                done();
            };

        createSubscriber(calcChannel, function(data) {
            calcMsgReceived = true;
        });

        // Modify postOptions
        var post_data = {uuid: '134asd443',
                         latitude: 81.218, 
                         longitude: 123.2112};
        postOptions.headers = {'Content-Type': 'application/json',
            'Content-Length': JSON.stringify(post_data).length};

        var post_req = http.request(postOptions, function(res) {
            setTimeout(checkMsgReceived, 100);
        });
        post_req.write(JSON.stringify(post_data));
        post_req.end();
    });

    it('should pass incoming measurements to computation apps', function(done) {
        var calcChannel = app.createCalculationMsg(''),
            calcMsgReceived = false,
            checkMsgReceived = function() {
                assert(calcMsgReceived, 'Publish message not received');
                done();
            };

        createSubscriber(calcChannel, function(data) {
            calcMsgReceived = true;
        });

        // Modify postOptions
        var post_data = 'uuid=134asd443&latitude=81.218&longitude=123.2112';
        postOptions.headers = {'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': post_data.length};

        var post_req = http.request(postOptions, function(res) {
            setTimeout(checkMsgReceived, 100);
        });
        post_req.write(post_data);
        post_req.end();
    });

    // Check if it is a pet
    it('should verify that the measurement is a valid entity', function() {
        assert(false, 'Need to write this test');
    });

    it('should store measurement from computation apps', function() {
        assert(false, 'Need to write this test');
    });

    it('should submit message to client apps on storage of measurement', function() {
        assert(false, 'Need to write this test');
    });

    after(function() {
        fs.unlink(testConfigFileName, function(err) {
            if (err) {
                console.error('Could not remove test_config '+err);
            } 
        });
    });

});
