// external imports
var express = require('express');
var request = require('request');
var Memcached = require('memcached');

// configurations
var config = require('./config');
if (typeof config === 'undefined' || !config) {
    console.error("No config.json present. Fix it!");
    return;
}

var memcacheConfig = config.storage.memcache;

// initialization
const app = express();
const connectString = `${memcacheConfig.host}:${memcacheConfig.port}`;
const memcachedClient = new Memcached([connectString]);
memcachedClient.connect(connectString, () => {});

memcachedClient.on('failure', function( details ){ log( "Server " + details.server + "went down due to: " + details.messages.join( '' ) ) });
memcachedClient.on('reconnecting', function( details ){ log( "Total downtime caused by server " + details.server + " :" + details.totalDownTime + "ms")});

/**
 * Sets the Access-Control-Allow-Origin header and does other globally good stuff
 */
app.get('/*',function(request, response, next) {
    response.set("Access-Control-Allow-Origin", "http://localhost");
    next(); // http://expressjs.com/guide.html#passing-route control
});

// constants from config
var responses = config.responses;

// because I get tired of typing "console.log"
var log = function(msg) {
    console.log(msg);
};

/**
* Gets status straight from a webservice. Validation of configs should have already happened
*
* @param type {String} the type of status (service) we're querying
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
            "id" : type,
            "status" : (status === typeconf.status_ok) ? responses.OK : responses.BAD,
            "details" : details,
            "last_checked" : last_checked
        };

        var finishUp = function() {
            return cb(response);
        };

        memcachedClient.set(type, JSON.stringify(response), memcacheConfig.ttl || 1800, finishUp);
    });
}

/**
 * Checks a status will check cache first, and resort to 
 * the live webservice if nothing comes up
 *
 * @param type {String} the type of status (service) we're querying
 * @param force {Boolean} whether or not to go to the live server
 * @param callback {Function(data)} 
 */
function getStatus(type, force, callback) {
    log(`Getting individual status ${type}`);
    var cb = callback || function() {};

    if (!sanityCheckType(type)) {
        log(`Invalid type ${type}`);
        response_json = Object.assign(responses.status_invalid_type, {"id" : type});
        return cb(response_json);
    }

    if (force) {
        log(`Forcing live status on ${type}`);
        getLiveStatus(type, function(data) {
            cb(data);
        });         
    } else {
        log(`Looking for memcached`);
        // try memcached first then go to the live site
        memcachedClient.get(type, function(error, data) {
            log("Got response from memcached!");
            if (typeof data !== 'undefined' && data != null && !force) {
                cb(JSON.parse(data));
            } else {
                log("Memcached data was null for " + type + ", grabbing from live server");
                getLiveStatus(type, function(data) {
                    cb(data);
                });
            }
        });
    }
    
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

/**
 * Extracts some substring from a data argument which is supposedly a string
 * Also will do string matching if no matching groups inside pattern
 *
 * @param data {String} data to extract from
 * @param pattern {String} the regex pattern to use for extraction
 * @return {String|null} the match, or null if no match.
 */
function extractStringParam(data, pattern) {
    if (typeof pattern === 'undefined' || !pattern) {
        return null;
    }
    var regex = new RegExp(pattern);
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
        "id" : "facebook",
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

    var type = request.params.type;
    getStatus(type, false, function(data) {
        response.send(data);
    });
});

/*
    Gets all statuses.
    Returns something like:
    [{
        "id" : "facebook",
        "status" : "OK|BAD|MEH",
        "details" : "Some English notes",
        "last_checked" : "081023123"
    }, {
        "id" : "whatever",
        "status" : "OK|BAD|MEH",
        "details" : "Other English notes",
        "last_checked" : "23821841"
    }]
*/
app.get("/status", function(request, response) {
    var typequery = request.query.types;
    if (typeof typequery === 'undefined' || !typequery)  {
        response.send(responses.status_give_me_types);
        return;
    }

    var types = typequery.split(",");

    var completedStatus = 0;
    var finishUp = function(...args) {
        
        completedStatus++;
        log(`finished one ${args} completed status count ${completedStatus}`);
        if (completedStatus === Object.keys(types).length) {
            response.send(bigStatus);
        }
    }
    var bigStatus = [];
    types.forEach((type) => {
        getStatus(type, false, function(data){
            bigStatus.push(data);
            finishUp();
        });
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

// fire it up!
var server = app.listen(config.port, function() {
    log("Hello World, listening");
});
