var operation = require('plumber').operation;
var SourceMap = require('mercator').SourceMap;

function generateMap(resource) {
    // absolute path or filename
    var absSourcePath = resource.path() ?
            resource.path().absolute() : resource.filename();
    return SourceMap.forSource(resource.data(), absSourcePath);
}

function countLines(source) {
    return source.split('\n').length;
}

function concatenate(inputResources) {
    return inputResources.
        // Ensure all resources have a source map
        map(function(resource) {
            if (resource.sourceMap()) {
                return resource;
            } else {
                return resource.withSourceMap(generateMap(resource));
            }
        }).
        // Iteratively concatenate resources into one
        scan(function(accResource, resource) {
            // FIXME: send error to the stream
            assertSameType(accResource, resource);

            var accMap = accResource.sourceMap();
            var accData = accResource.data();
            var data = [accData, resource.data()].join('\n');
            var map = accMap.append(resource.sourceMap(), countLines(accData));
            return accResource.withData(data, map);
        }).
        // Note: we use a combination of scan+takeLast instead of
        // reduce in order to correctly return an empty Observable
        // when there is no input resources (rather than throwing an
        // error...)
        takeLast(1);
}


function assertSameType(resource1, resource2) {
    if (resource1.type() !== resource2.type()) {
        throw new Error('Cannot concat resources of different types: ' +
                        resource1.type() + ', ' + resource2.type());
    }
}


module.exports = function(newName) {
    if (! newName) {
        throw new Error('Concat called without a new name');
    }

    return operation(function(resources) {
        return concatenate(resources).map(function(concatenated) {
            return concatenated.withFileName(newName);
        });
    });
};
