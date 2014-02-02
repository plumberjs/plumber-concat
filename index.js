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
        reduce(function(accResource, resource) {
            var accMap = accResource.sourceMap();
            var accData = accResource.data();
            var data = [accData, resource.data()].join('\n');
            var map = accMap.append(resource.sourceMap(), countLines(accData));
            return accResource.
                withData(data).
                withSourceMap(map);
        });
}


function allEqual(array) {
    return array.every(function(x) { return x === array[0]; });
}


module.exports = function(newName) {
    if (! newName) {
        throw new Error('Concat called without a new name');
    }

    return function(resources) {
        // Early escape: if no input, concat returns no resource
        if (resources.length === 0) {
            return [];
        }

        var types = resources.map(function(resource) {
            return resource.type();
        });

        if (! allEqual(types)) {
            throw new Error('Cannot concat resources of different types: ' + types.join(', '));
        }

        return [concatenate(resources).withFileName(newName)];
    };
};
