/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

// Create global variables
var access_token = null;
var refresh_token = null;
var homeIDs = {};

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.mytado.0
var adapter = new utils.Adapter('mytado');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function getLoginToken() {
    var request = require("request");

    var options = { method: 'POST',
        url: 'https://my.tado.com/oauth/token',
        qs:
        { client_id: 'public-api-preview',
            grant_type: 'password',
            scope: 'home.user',
            username: adapter.config.username,
            password: adapter.config.password,
            client_secret: '4HJGRffVR8xb3XdEUQpjgZ1VplJi6Xgw' },
        headers:
        { 'Cache-Control': 'no-cache' } };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        var json = JSON.parse(body);
        access_token = json['access_token'];
        refresh_token = json['refresh_token'];

        if (access_token != null && refresh_token != null)
        {
            adapter.setState('api.access_token', access_token, function (err) {
                if (err) adapter.log.error(err);
            });
            adapter.setState('api.refresh_token', refresh_token, function (err) {
                if (err) adapter.log.error(err);
            });
        }
    });
}

function refreshToken() {
    var request = require("request");

    var options = { method: 'POST',
        url: 'https://my.tado.com/oauth/token',
        qs:
        { client_id: 'public-api-preview',
            grant_type: 'refresh_token',
            scope: 'home.user',
            refresh_token: refresh_token,
            client_secret: '4HJGRffVR8xb3XdEUQpjgZ1VplJi6Xgw' },
        headers:
        { 'Cache-Control': 'no-cache' } };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        var json = JSON.parse(body);
        access_token = json['access_token'];
        refresh_token = json['refresh_token'];

        if (access_token != null && refresh_token != null)
        {
            adapter.setState('api.access_token', access_token, function (err) {
                if (err) adapter.log.error(err);
            });
            adapter.setState('api.refresh_token', refresh_token, function (err) {
                if (err) adapter.log.error(err);
            });
        }
    });
}

function getHomeID() {
    var request = require("request");

    var options = { method: 'GET',
        url: 'https://my.tado.com/api/v2/me',
        headers:
        {   'Cache-Control': 'no-cache',
            Authorization: 'Bearer ' + access_token } };

    request(options, function (error, response, body) {
        if (error) {
            throw new Error(error);
        } else {
            var json = JSON.parse(body);

            homeIDs = json['homes'];

            json['homes'].forEach(function(element)
            {
                adapter.setObjectNotExists(element['name'], {
                    type: 'channel',
                    role: '',
                    common: {
                        name: element['name'] + ' (Home ID ' + element['id'] + ')'
                    },
                    native: {}
                });

                adapter.setObjectNotExists(element['name'] + '.id', {
                    type: 'state',
                    common: {
                        name: 'Home ID',
                        desc: 'home id for ' + element['name'],
                        type: 'string',
                        role: 'text',
                        read: true,
                        write: true
                    },
                    native: {}
                });

                adapter.setState(element['name'] + '.id', element['id']);
            });
        }
    });

}

function main() {
    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    // adapter.log.info('config username: '    + adapter.config.username);
    // adapter.log.info('config password: '    + adapter.config.password);

    getLoginToken();

    adapter.subscribeStates('*');
}
