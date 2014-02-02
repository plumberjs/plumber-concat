var chai = require('chai');
chai.should();

var SourceMapConsumer = require('source-map').SourceMapConsumer;

var SourceMap = require('mercator').SourceMap;

var Resource = require('plumber').Resource;

var concat = require('..');

function createResource(params) {
    return new Resource(params);
}

function countLines(source) {
    return source.split('\n').length;
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
            concat('new-file')([
                createResource({type: 'javascript', path: 'path/to/file.js'}),
                createResource({type: 'css',        path: 'path/to/file.css'})
            ]);
        }).should.throw(/Cannot concat resources of different types/);
    });


    describe('when passed no resources', function() {
        var concatResources;

        beforeEach(function() {
            concatResources = concat('new-file')([]);
        });

        it('should return no resources', function(){
            concatResources.length.should.equal(0);
        });
    });


    describe('when passed a single resource with no source map', function() {
        var concatResources;
        var source = 'var answer = 42;\nvar question = "?";\n';

        beforeEach(function() {
            concatResources = concat('new-file')([
                createResource({type: 'javascript', path: 'path/to/file.js', data: source})
            ]);
        });

        it('should return a single new resource', function(){
            concatResources.length.should.equal(1);
        });

        it('should return a new resource with the same content', function(){
            concatResources[0].data().should.equal(source);
        });

        it('should return a new resource with the same type', function(){
            concatResources[0].type().should.equal('javascript');
        });

        it('should return a new resource with the expected name', function(){
            concatResources[0].filename().should.equal('new-file.js');
        });

        it('should return a new resource with an identity source map', function(){
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
        });
    });


    describe('when passed a single resource with a source map', function() {
        var concatResources;
        var source = 'var answer = 42;\nvar question = "?";\n';
        var sourceMap = SourceMap.forSource(source, 'path/to/file.js');

        beforeEach(function() {
            concatResources = concat('new-file')([
                createResource({type: 'javascript', path: 'path/to/file.js', data: source, sourceMap: sourceMap})
            ]);
        });

        it('should return a new resource with the same source map (apart from file)', function() {
            var map = SourceMap.fromMapData(concatResources[0].sourceMap());
            map.file.should.equal('new-file.js');

            // Replace file to be able to compare with original
            var mapWithFile = map.withFile(sourceMap.file);
            mapWithFile.should.deep.equal(sourceMap);
        });
    });


    describe('when passed two resources without source maps', function() {
        var concatResources;
        var sourceFirst = 'var answer = 42;\nvar question = "?";\n';
        var sourceSecond = '/* second */\nfunction second(n) {\n  return n + 2;\n}\n';

        beforeEach(function() {
            concatResources = concat('new-file')([
                createResource({type: 'javascript', path: 'path/to/first.js', data: sourceFirst}),
                createResource({type: 'javascript', path: 'path/to/second.js', data: sourceSecond})
            ]);
        });

        it('should return a single new resource', function(){
            concatResources.length.should.equal(1);
        });

        it('should return a new resource with the concatenated content', function(){
            var concatenation = sourceFirst + '\n' + sourceSecond;
            concatResources[0].data().should.equal(concatenation);
        });

        it('should return a new resource with the same type', function(){
            concatResources[0].type().should.equal('javascript');
        });

        it('should return a new resource with the expected name', function(){
            concatResources[0].filename().should.equal('new-file.js');
        });

        it('should return a new resource with a correct source map', function(){
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
        });
    });

    describe('when passed two resources with source maps', function() {
        var concatResources;
        var sourceFirst = 'var answer = 42;\nvar question = "?";\n';
        var sourceMapFirst = SourceMap.forSource(sourceFirst, 'path/to/first.js');
        var sourceSecond = '/* second */\nfunction second(n) {\n  return n + 2;\n}\n';
        var sourceMapSecond = SourceMap.forSource(sourceSecond, 'path/to/second.js');

        beforeEach(function() {
            concatResources = concat('new-file')([
                createResource({type: 'javascript', path: 'path/to/first.js', data: sourceFirst, sourceMap: sourceMapFirst}),
                createResource({type: 'javascript', path: 'path/to/second.js', data: sourceSecond, sourceMap: sourceMapSecond})
            ]);
        });

        it('should return a new resource with source maps correctly offsetted', function(){
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
        });
    });

});
