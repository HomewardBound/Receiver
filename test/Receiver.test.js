/*globals describe,after,beforeEach,it,assert,before*/

'use strict';
var assert = require('assert'),
    //Message = require('../lib/message'),
    zeromq = require('zmq'),
    _ = require('lodash'),
    http = require('http'),
    fs = require('fs'),
    Receiver = require('../lib/Receiver.js'),

    app,
    testConfigFileName = __dirname + '/__config.test.js',
    calculationReq,
    postOptions,
    receiver,
    MEASURED_UUID = 'IAmMeasured',
    NOT_MEASURED_UUID = 'IAmNotMeasured';

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

var updateTestConfigOptions = function(config) {
    var testEntities = '__testEntities',
        testLocations = '__testLocations';

    config.port = 8080;
    config.entityCollection = testEntities;
    config.locationCollection = testLocations;
};

var seedDatabase = function(app, seeds, callback) {
    var count = 0,
        cb = function(err, saved) {
            if (err || !saved) {
                console.error('Could not save measured entity: ', err);
            }

            if (++count === seeds.length) {
                callback();
            }
        };

    for (var i = seeds.length; i--;) {
        app.database[app._itemsCollection].save(seeds[i], cb);
    }
};

describe('Testing Receiver', function() {
    var defaultConfig,
        calcChannel,
        computationPub;

    before(function(done) {
        // Create the test config
        // Get the default config
        defaultConfig = JSON.parse(fs.readFileSync(__dirname+'/../lib/config.default.js', 'utf-8'));

        // Change the port
        updateTestConfigOptions(defaultConfig);

        // Save it to test file
        fs.writeFileSync(testConfigFileName, JSON.stringify(defaultConfig));

        computationPub = createPublisher(defaultConfig.storageRequestBroker);

        // Create the server with test configuration
        app = new Receiver(testConfigFileName);
        app.start();

        // Store a measured entity in the database

        var seeds = [{uuid: NOT_MEASURED_UUID}, {uuid: MEASURED_UUID, isMeasuring: true}];
        seedDatabase(app, seeds, done);

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
            var post_data = {uuid: MEASURED_UUID,
                             latitude: 81.218, 
                             longitude: 123.2112,
                             radius: 10,
                             timestamp: new Date().getTime()};
            postOptions.headers = {'Content-Type': 'application/json',
                    'Content-Length': JSON.stringify(post_data).length};

                    var post_req = http.request(postOptions, function(res) {
                        setTimeout(checkMsgReceived, 300);
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
            var post_data = 'uuid='+MEASURED_UUID+'&latitude=81.218&longitude=123.2112&radius=10&timestamp=100293843';
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

            console.log('listening for notification on '+app.config.notifyBroker);
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
            var config = _.clone(defaultConfig),
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
                assert(data.toString().indexOf(999) > -1, 
                    'Receiver subscribed to old computation publisher');  // p2App doesn't care about Fido
                // Set the storageRequestBroker back to the default
                fs.writeFileSync(testConfigFileName, JSON.stringify(defaultConfig));
                setTimeout(done, 100);  // Give it time to reset
            });

            config.storageRequestBroker = 'tcp://127.0.0.1:2099';
            fs.writeFileSync(testConfigFileName, JSON.stringify(config));
            newComputationPub = createPublisher(config.storageRequestBroker);
            setTimeout(checkFn, 400);
        });

        it('should store measurement from computation apps', function(done) {
            var msg = {uuid: 'Spot', 
                       latitude: 120, 
                       longitude: 122, 
                       radius: 120, 
                       timestamp: new Date().getTime()},
                receivedMsg = false,
                oldLen,
                checkFn = function() {
                    app.database[app._locationCollection].find(function(err, models) {
                        assert(models.length === oldLen+1, 'Measurement not in database!');
                        console.log('Found '+oldLen);
                        done();
                    });
                };

            setTimeout(function() {
                app.database[app._locationCollection].find(function(err, models) {
                    oldLen = models.length;
                    computationPub.send('StoreMeasurement'+JSON.stringify(msg));
                    console.log('Found '+oldLen+'('+app._locationCollection+')');
                    setTimeout(checkFn, 100);
                });
            }, 50);
        });

        // Check if it is a pet
        it('should not accept measurement with invalid structure', function(done) {
            var msg = {uuid: 'Spot',
                       latitude: 12,
                       longitude: 120,
                       timestamp: new Date().getTime()},
                post_req;

            postOptions.headers = {'Content-Type': 'application/json',
                    'Content-Length': JSON.stringify(msg).length};

            post_req = http.request(postOptions, function(res) {
                assert(res.statusCode !== 200);
                done();
            });
            post_req.write(JSON.stringify(msg));
            post_req.end();
        });

        it('should not accept measurement whose target doesn\'t exist in the db', function() {
            var post_data = {uuid: 'Spot',
                             latitude: 81.218, 
                             longitude: 123.2112,
                             radius: 10,
                             timestamp: new Date().getTime()},
                post_req;

            postOptions.headers = {'Content-Type': 'application/json',
                    'Content-Length': JSON.stringify(post_data).length};

            post_req = http.request(postOptions, function(res) {
                assert(res.statusCode === 204);
            });
            post_req.write(JSON.stringify(post_data));
            post_req.end();

        });

        it('should not accept measurement whose target is not marked as measuring in the db', function() {
            var post_data = {uuid: NOT_MEASURED_UUID,
                             latitude: 81.218, 
                             longitude: 123.2112,
                             radius: 10,
                             timestamp: new Date().getTime()},
                post_req;

            postOptions.headers = {'Content-Type': 'application/json',
                    'Content-Length': JSON.stringify(post_data).length};

            post_req = http.request(postOptions, function(res) {
                assert(res.statusCode === 204);
            });
            post_req.write(JSON.stringify(post_data));
            post_req.end();
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
