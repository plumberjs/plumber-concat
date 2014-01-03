var Resource = require('plumber').Resource;

/* Adapted from mapcat by Eddie Cao to work with Plumber Resources and
 * in-memory data.
 *
 * https://github.com/edc/mapcat
 */

var path = require('path');

var SourceMapConsumer = require('source-map').SourceMapConsumer;
var SourceMapGenerator = require('source-map').SourceMapGenerator;

function concatenate(inputResources, dest) {
    var buffer = [];
    var lineOffset = 0;
    var generator = new SourceMapGenerator({
        file: dest.filename()
    });

    // Append each resource
    inputResources.forEach(function(resource) {
        // FIXME: some might not have an associated map??!
        var map = new SourceMapConsumer(resource.sourceMap());

        // Rebase the mapping by the lineOffset
        map.eachMapping(function(mapping) {
            generator.addMapping({
                generated: {
                    line: mapping.generatedLine + lineOffset,
                    column: mapping.generatedColumn
                },
                original: {
                    line: mapping.originalLine,
                    column: mapping.originalColumn
                },
                source: mapping.source
            });
        });

        var src = resource.data();
        buffer.push(src);
        lineOffset += src.split('\n').length;
    });

    return dest.
        withData(buffer.join('\n')).
        withSourceMap(generator.toString());
};


function allEqual(array) {
    return array.every(function(x) { return x === array[0]; });
}


module.exports = function(newName) {
    return function(resources) {
        var types = resources.map(function(resource) {
            return resource.type();
        });

        if (! allEqual(types)) {
            throw new Error('Cannot concat resources of different types: ' + types.join(', '));
        }

        // Concatenated resource is of the same type
        var concatResource = new Resource({filename: newName, type: types[0]});
        return [concatenate(resources, concatResource)];
    };
};
