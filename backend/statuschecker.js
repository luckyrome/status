// external imports
var express = require('express');
var request = require('request');
var memcache = require('memcache');

// configurations
var config = require('./config');
if (typeof config === 'undefined' || !config) {
    console.error("No config.json present. Fix it!");
    return;
}

var memcacheConfig = config.storage.memcache;

// initialization
var app = express();
var memcachedClient = new memcache.Client(memcacheConfig.port, memcacheConfig.host);
memcachedClient.connect();

// constants from config
var responses = config.responses;

// because I get tired of typing "console.log"
var log = function(msg) {
    console.log(msg);
};

/**
* Gets status straight from a webservice. Validation of configs should have already happened
*
* @param callback {Function(data)} 
*/
function getLiveStatus(type, callback) {
    log("got type " + type);
    var cb = callback || function() {};
    var typeconf = config.types[type];

    // last chance for sanity
    if (typeof typeconf === 'undefined' || typeconf === null) {
        return cb(responses.status_misconfigured);
    }

    var options = typeconf.request_options;

    // call webservice and standardize the data
    request(options, function(error, response, payload) {
        var body = payload;
        var status, details, last_checked;
        last_checked = new Date().getTime();
        // todo: support straight up strings and entire DOMs
        if (typeconf.format === 'json') {
            body = JSON.parse(payload);
            status = extractJsonParam(body, typeconf.status_key);
            details = extractJsonParam(body, typeconf.details_key);
        } else {
            status = extractStringParam(body, typeconf.status_key);
            details = extractStringParam(body, typeconf.details_key);
        }

        var response = {
            "status" : (status === typeconf.status_ok) ? responses.OK : responses.BAD,
            "details" : details,
            "last_checked" : last_checked
        };

        var finishUp = function() {
            return cb(response);
        };

        memcachedClient.set(type, JSON.stringify(response), finishUp, memcacheConfig.ttl || 1800);
    });
}

/**
    Checks a Status - will check cache first
*/
function getStatus(type, callback) {

    var cb = callback || function() {};

    // try memcached first then go to the live site
    memcachedClient.get(type, function(error, data) {
        log("Got response from memcached!");
        if (typeof data !== 'undefined' && data != null) {
            callback(JSON.parse(data));
        } else {
            log("Memcached data was null for " + type + ", grabbing from live server");
            getLiveStatus(type, function(data) {
                cb(data);
            });
        }
    });
};

/**
 * Extracts a parameter from a json object using dot-separated annotations
 *
 * @param data {Object} the object being traversed
 * @param param {String} a '.'-separated list of attributes, e.g: item.prop.attribute
 * @return {String|null}
 */
function extractJsonParam(data, param) {
    if (typeof param === 'undefined' || !param) {
        return null;
    }
    var levels = param.split(".");
    var reference = data;
    for (var i = 0; i < levels.length; i++) {
        newreference = reference[levels[i]];
        if (typeof newreference === 'undefined' || newreference === null) {
            return null;
        }
        else {
            reference = newreference;
        }
    }
    if (typeof reference === 'object') {
        // dafuq?
        return null;
    } else {
        return reference;
    }
};

function extractStringParam(data, param) {
    if (typeof param === 'undefined' || !param) {
        return null;
    }
    var regex = new RegExp(param);
    if (regex != null) {
        var matchData = regex.exec(data);
        if (typeof matchData !== 'undefined' && matchData !== null) {
            if (typeof matchData[1] !== undefined && matchData[1]) {
                return matchData[1];
            } else {
                return matchData[0];
            }
        } else {
            return null;
        }
    } else {
        return null;
    }
}

/**
 * Tells us whether this type is configured for the system
 *
 * @param {String} type the type of configuration in question
 * @return {Boolean} true if all's good in the hood, false otherwise
 */
function sanityCheckType(type) {
    var valid = false;
    valid = !!(config.types && config.types[type] && config.types[type].request_options &&
        config.types[type].request_options.url && config.types[type].status_key &&
        config.types[type].status_ok && config.types[type].details_key && config.types[type].format);
    return valid;
};

/*
    Gets a status for a single service. Status can look like:
    {
        "status" : "OK|BAD|MEH",
        "details" : "Some English notes",
        "last_checked" : "219849216"

    }
*/
app.get("/:type/status", function(request, response) {
    // shortcut as early as possible because I don't want to deal with memcached not being there
    if (typeof memcachedClient === 'unefined' || memcachedClient === null) {
        log("Memcached client isn't running! Aborting because assumptions :(");
        callback(STATUS_CANT_TELL);
    }

    // todo: sanity check type argument
    var type = request.params.type;
    var validType = sanityCheckType(type);
    if (validType) {
        getStatus(type, function(data) {
            response.send(data);
        });
    } else {
        response.send(responses.status_misconfigured);
    }
});

/*
    Gets all statuses.
    Returns something like:
    [{
        "status" : "OK|BAD|MEH",
        "details" : "Some English notes",
        "last_checked" : "081023123"
    }, {
        "status" : "OK|BAD|MEH",
        "details" : "Other English notes",
        "last_checked" : "23821841"
    }]
*/
app.get("/status", function(request, response) {
    response.send({
        "status" : "not implemented, go away yeti-face!"
    });
});

/*
    Tells the server to get statuses and store them - only for the authenticated
*/
app.post("/status", function(request, response) {
    response.send({
        "status" : "not implemented, go away yeti-face!"
    });
});

var server = app.listen(config.port, function() {
    log("Hello World, listening");
});