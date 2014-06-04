/* global : angular */
var dash = angular.module('dash', ['ngResource']);

/**
 * Controller for the dashboard (obviously). Will handle updating
 * statuses and dashboard-like functions (like switches)
 * todo: expose an API for updates
 */
dash.controller('DashController', ['$resource', function($resource) {
    var StatusAPI = $resource('http://localhost:3001/:id/status', {
            "id" : "@id"
        }, {
            "getAll" : {
                "url" : "http://localhost:3001/status", // todo: generate config to prepend to dash.js
                "params" : {
                    "types" : "facebook,facebookpush,xbox_core,xbox_website"
                },
                "isArray" : true
            }
        }
    );
    this.serviceList = StatusAPI.getAll();
}]);