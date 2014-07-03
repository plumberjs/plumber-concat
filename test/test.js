var chai = require('chai');
chai.should();

var SourceMapConsumer = require('source-map').SourceMapConsumer;

var SourceMap = require('mercator').SourceMap;

var Resource = require('plumber').Resource;

var runOperation = require('plumber-util-test').runOperation;
var completeWithResources = require('plumber-util-test').completeWithResources;

var concat = require('..');

function createResource(params) {
    return new Resource(params);
}

function countLines(source) {
    return source.split('\n').length;
}

function resourcesError(e) {
  chai.assert(false, "error in resources observable: " + e);
}


describe('concat', function(){
    it('should be a function', function(){
        concat.should.be.a('function');
    });

    it('should throw an exception when passed no name', function(){
        (function() {
            concat();
        }).should.throw('Concat called without a new name');
    });

    it('should return a function when passed name', function(){
        concat('new-file').should.be.a('function');
    });


    it('should throw an exception if passed files of different types', function(){
        (function() {
            var result = runOperation(concat('new-file'), [
                createResource({type: 'javascript', path: 'path/to/file.js', data: '\n'}),
                createResource({type: 'css',        path: 'path/to/file.css', data: '\n'})
            ]).resources;

            completeWithResources(result);
        }).should.throw(/Cannot concat resources of different types/);
    });


    describe('when passed no resources', function() {
        var result;

        beforeEach(function() {
            result = runOperation(concat('new-file'), []).resources;
        });

        it('should return no resources', function(done){
            completeWithResources(result, function(concatResources) {
                concatResources.length.should.equal(0);
            }, resourcesError, done);
        });
    });


    describe('when passed a single resource with no source map', function() {
        var result;
        var source = 'var answer = 42;\nvar question = "?";\n';

        beforeEach(function() {
            result = runOperation(concat('new-file'), [
                createResource({type: 'javascript', path: 'path/to/file.js', data: source})
            ]).resources;
        });

        it('should return a single new resource', function(done){
            completeWithResources(result, function(concatResources) {
                concatResources.length.should.equal(1);
            }, resourcesError, done);
        });

        it('should return a new resource with the same content', function(done){
            completeWithResources(result, function(concatResources) {
                concatResources[0].data().should.equal(source);
            }, resourcesError, done);
        });

        it('should return a new resource with the same type', function(done){
            completeWithResources(result, function(concatResources) {
                concatResources[0].type().should.equal('javascript');
            }, resourcesError, done);
        });

        it('should return a new resource with the expected name', function(done){
            completeWithResources(result, function(concatResources) {
                concatResources[0].filename().should.equal('new-file.js');
            }, resourcesError, done);
        });

        it('should return a new resource with an identity source map', function(done){
            completeWithResources(result, function(concatResources) {
                var map = new SourceMapConsumer(concatResources[0].sourceMap());
                map.sources.should.deep.equal(['path/to/file.js']);
                map.sourcesContent.should.deep.equal([source]);

                // identity mapping
                for (var i = 1; i <= countLines(source); i++) {
                    map.originalPositionFor({line: i, column: 0}).should.deep.equal({
                        source: 'path/to/file.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }
            }, resourcesError, done);
        });
    });


    describe('when passed a single resource with a source map', function() {
        var result;
        var source = 'var answer = 42;\nvar question = "?";\n';
        var sourceMap = SourceMap.forSource(source, 'path/to/file.js');

        beforeEach(function() {
            result = runOperation(concat('new-file'), [
                createResource({type: 'javascript', path: 'path/to/file.js', data: source, sourceMap: sourceMap})
            ]).resources;
        });

        it('should return a new resource with the same source map (apart from file)', function(done) {
            completeWithResources(result, function(concatResources) {
                var map = concatResources[0].sourceMap();
                map.file.should.equal('new-file.js');

                // Replace file to be able to compare with original
                var mapWithFile = map.withFile(sourceMap.file);
                mapWithFile.should.deep.equal(sourceMap);
            }, resourcesError, done);
        });
    });


    describe('when passed two resources without source maps', function() {
        var result;
        var sourceFirst = 'var answer = 42;\nvar question = "?";\n';
        var sourceSecond = '/* second */\nfunction second(n) {\n  return n + 2;\n}\n';

        beforeEach(function() {
            result = runOperation(concat('new-file'), [
                createResource({type: 'javascript', path: 'path/to/first.js', data: sourceFirst}),
                createResource({type: 'javascript', path: 'path/to/second.js', data: sourceSecond})
            ]).resources;
        });

        it('should return a single new resource', function(done){
            completeWithResources(result, function(concatResources) {
                concatResources.length.should.equal(1);
            }, resourcesError, done);
        });

        it('should return a new resource with the concatenated content', function(done){
            var concatenation = sourceFirst + '\n' + sourceSecond;
            completeWithResources(result, function(concatResources) {
                concatResources[0].data().should.equal(concatenation);
            }, resourcesError, done);
        });

        it('should return a new resource with the same type', function(done){
            completeWithResources(result, function(concatResources) {
                concatResources[0].type().should.equal('javascript');
            }, resourcesError, done);
        });

        it('should return a new resource with the expected name', function(done){
            completeWithResources(result, function(concatResources) {
                concatResources[0].filename().should.equal('new-file.js');
            }, resourcesError, done);
        });

        it('should return a new resource with a correct source map', function(done){
            completeWithResources(result, function(concatResources) {
                var map = new SourceMapConsumer(concatResources[0].sourceMap());
                map.sources.should.deep.equal([
                    'path/to/first.js',
                    'path/to/second.js'
                ]);
                map.sourcesContent.should.deep.equal([
                    sourceFirst,
                    sourceSecond
                ]);

                // identity mapping for first file
                var i;
                for (i = 1; i <= countLines(sourceFirst); i++) {
                    map.originalPositionFor({line: i, column: 0}).should.deep.equal({
                        source: 'path/to/first.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }

                // offset mapping for first file
                var offset = countLines(sourceFirst);
                for (i = 1; i <= countLines(sourceSecond); i++) {
                    map.originalPositionFor({line: offset + i, column: 0}).should.deep.equal({
                        source: 'path/to/second.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }
            }, resourcesError, done);
        });
    });

    describe('when passed two resources with source maps', function() {
        var result;
        var sourceFirst = 'var answer = 42;\nvar question = "?";\n';
        var sourceMapFirst = SourceMap.forSource(sourceFirst, 'path/to/first.js');
        var sourceSecond = '/* second */\nfunction second(n) {\n  return n + 2;\n}\n';
        var sourceMapSecond = SourceMap.forSource(sourceSecond, 'path/to/second.js');

        beforeEach(function() {
            result = runOperation(concat('new-file'), [
                createResource({type: 'javascript', path: 'path/to/first.js', data: sourceFirst, sourceMap: sourceMapFirst}),
                createResource({type: 'javascript', path: 'path/to/second.js', data: sourceSecond, sourceMap: sourceMapSecond})
            ]).resources;
        });

        it('should return a new resource with source maps correctly offsetted', function(done){
            completeWithResources(result, function(concatResources) {
                var map = new SourceMapConsumer(concatResources[0].sourceMap());
                map.sources.should.deep.equal([
                    'path/to/first.js',
                    'path/to/second.js'
                ]);
                map.sourcesContent.should.deep.equal([
                    sourceFirst,
                    sourceSecond
                ]);

                // identity mapping for first file
                var i;
                for (i = 1; i <= countLines(sourceFirst); i++) {
                    map.originalPositionFor({line: i, column: 0}).should.deep.equal({
                        source: 'path/to/first.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }

                // offset mapping for first file
                var offset = countLines(sourceFirst);
                for (i = 1; i <= countLines(sourceSecond); i++) {
                    map.originalPositionFor({line: offset + i, column: 0}).should.deep.equal({
                        source: 'path/to/second.js',
                        line: i,
                        column: 0,
                        name: null
                    });
                }
            }, resourcesError, done);
        });
    });

});
