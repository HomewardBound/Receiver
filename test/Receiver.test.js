/*globals describe,after,beforeEach,it,assert,before*/

'use strict';
var assert = require('assert'),
    //Message = require('../lib/message'),
    zeromq = require('zmq'),
    http = require('http'),
    fs = require('fs'),
    Receiver = require('../lib/Receiver.js'),

    app,
    testConfigFileName = __dirname + '/__config.test.js',
    calculationReq,
    postOptions,
    receiver;

// Simulating related apps
var createSubscriber = function(address, channel) {
    var subscriber = zeromq.socket('sub');
    subscriber.connect(address);
    subscriber.subscribe(channel);
    return subscriber;
};

var createPublisher = function(address) {
    var publisher = zeromq.socket('pub');
    publisher.bindSync(address);
    return publisher;
};

describe('Testing Receiver', function() {
    var defaultConfig,
        calcChannel,
        computationPub;

    before(function() {
        // Create the test config
        // Get the default config
        defaultConfig = JSON.parse(fs.readFileSync(__dirname+'/../lib/config.default.js', 'utf-8'));

        // Change the port
        defaultConfig.port = 8080;

        // Save it to test file
        fs.writeFileSync(testConfigFileName, JSON.stringify(defaultConfig));

        computationPub = createPublisher(defaultConfig.storageRequestBroker);

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
        calcChannel = app.createCalculationMsg('').split('""')[0];  // Extract the topic
    });

    describe('Initial Message Reception', function() {

        it('should accept urlencoded post messages to /', function(done) {
            var post_req = http.request(postOptions, function(res) {
                assert(res.statusCode);
                done();
            });
            post_req.end();
        });

        it('should pass incoming json measurements to computation apps', function(done) {
            var calcMsgReceived = false,
            checkMsgReceived = function() {
                assert(calcMsgReceived, 'Publish message not received');
                done();
            };

            var subscriber = createSubscriber(app.config.calcRequestBroker, calcChannel);
            subscriber.on('message', function(data) {
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
            var calcMsgReceived = false,
            checkMsgReceived = function() {
                assert(calcMsgReceived, 'Publish message not received');
                done();
            },
            subscriber = createSubscriber(app.config.calcRequestBroker, calcChannel); 

            subscriber.on('message', function(data) {
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

        it('should update publisher socket on config update', function(done) {
            var config = defaultConfig;
            config.calcRequestBroker = 'tcp://127.0.0.1:2009';
            fs.writeFileSync(testConfigFileName, JSON.stringify(config));
            setTimeout(done, 150);
        });
    });

    describe('Receiver.Storage test', function() {
        it('should submit message to client apps on storage of measurement', function(done) {
            var testMeasurement = {uuid: 'test', 
                                   latitude: 120, 
                                   longitude: 122, 
                                   radius: 120, 
                                   timestamp: new Date().getTime()},
                receivedMsg = false,
                phoneApp = createSubscriber(app.config.notifyBroker, '');  // Listen for any dog request

            phoneApp.on('message', function(data) {
                receivedMsg = true;
            });

            computationPub.send('StoreMeasurement '+JSON.stringify(testMeasurement));

            var verify = function() {
                assert(receivedMsg, 'Did not receive pet location on storage');
                done();
            };

            setTimeout(verify, 200);
        });

        it('should send notifications to owners', function(done) {
            var msg = {uuid: 'Spot', 
                       latitude: 120, 
                       longitude: 122, 
                       radius: 120, 
                       timestamp: new Date().getTime()},
                receivedMsg = false,
                p1App = createSubscriber(app.config.notifyBroker, 'Spot');

            p1App.on('message', function(data) {
                assert(true);  // p2App doesn't care about Fido
                done();
            });

            computationPub.send('StoreMeasurement '+JSON.stringify(msg));
        });

        it('should not send notifications to non-owners', function(done) {
            var msg = {uuid: 'Fido', 
                       latitude: 120, 
                       longitude: 122, 
                       radius: 120, 
                       timestamp: new Date().getTime()},
                receivedMsg = false,
                p1App = createSubscriber(app.config.notifyBroker, 'Spot');

            p1App.on('message', function(data) {
                assert(false);  // p2App doesn't care about Fido
            });

            computationPub.send('StoreMeasurement '+JSON.stringify(msg));
            setTimeout(done, 200);
        });

        it('should update subscriber socket on config update', function(done) {
            var config = defaultConfig,
                msg = {uuid: 'Einstein', 
                       latitude: 120, 
                       longitude: 122, 
                       radius: 120, 
                       timestamp: new Date().getTime()},
                p1App = createSubscriber(app.config.notifyBroker, 'Einstein'),
                newComputationPub,
                checkFn = function() {
                    computationPub.send('StoreMeasurement '+JSON.stringify(msg));
                    msg.radius = 999;
                    newComputationPub.send('StoreMeasurement '+JSON.stringify(msg));
                };

            p1App.on('message', function(data) {
                assert(data.toString().indexOf(999) > -1, 'Receiver subscribed to old computation publisher');  // p2App doesn't care about Fido
                done();
            });

            config.storageRequestBroker = 'tcp://127.0.0.1:2099';
            fs.writeFileSync(testConfigFileName, JSON.stringify(config));
            newComputationPub = createPublisher(config.storageRequestBroker);
            setTimeout(checkFn, 400);
        });

        /*
        it('should not receive multiple notify messages', function(done) {
            this.timeout(7999);
            var config = defaultConfig,
                msg = {uuid: 'Einstein', 
                       latitude: 120, 
                       longitude: 122, 
                       radius: 120, 
                       timestamp: new Date().getTime()},
                p1App = createSubscriber(app.config.notifyBroker, 'Einstein'),
                newComputationPub,
                checkFn = function() {
                    console.log('sending measurements');
                    computationPub.send('StoreMeasurement '+JSON.stringify(msg));
                    msg.radius = 999;
                    newComputationPub.send('StoreMeasurement '+JSON.stringify(msg));
                };

            p1App.on('message', function(data) {
                console.log('Received message: '+ data);
                assert(data.toString().indexOf(999) > -1, 'Receiver subscribed to old computation publisher');  // p2App doesn't care about Fido
                done();
            });

            //config.storageRequestBroker = 'tcp://127.0.0.1:2004';
            config.storageRequestBroker = 'tcp://127.0.0.1:2009';
            fs.writeFileSync(testConfigFileName, JSON.stringify(config));
            //setTimeout(fs.writeFileSync, 1000, testConfigFileName, JSON.stringify(config));
            newComputationPub = createPublisher(config.storageRequestBroker);
            setTimeout(checkFn, 300);
        });
        */

        it('should dynamically subscribe to computation app on config change', function() {
            assert(false, 'Need to write this test');
        });

        it('should store measurement from computation apps', function() {
            assert(false, 'Need to write this test');
        });

        // Check if it is a pet
        it('should verify that the measurement is a valid entity', function() {
            assert(false, 'Need to write this test');
        });

    });

    after(function() {
        fs.unlink(testConfigFileName, function(err) {
            if (err) {
                console.error('Could not remove test_config '+err);
            } 
        });
    });

});
