var express = require('express');
var request = require('request');

var app = express();
app.get("/facebook/status", function(req, res) {
    var type = "facebook";
    var jsonstatus = {};
    
    if (typeof memcached !== 'undefined') {
        jsonstatus = JSON.parse(memcached.getJsonStatus(type));
    } else {
        jsonstatus = request.get("https://www.facebook.com/feeds/api_status.php", function(error, response, body) {
            console.log(body);
        });
    }

    res.send(jsonstatus);
});
app.get("/facebook")

var server = app.listen(9999, function() {
    console.log("hello, listening");
});
