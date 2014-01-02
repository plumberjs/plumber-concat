var Resource = require('plumber').Resource;

module.exports = function(/* no options */) {
    return function(resources) {
        // TODO: verify compatible/same type
        var concatenated = resources.reduce(function(acc, resource) {
            return acc + resource.data();
        }, '');
        return [new Resource({data: concatenated})];
    };
};
