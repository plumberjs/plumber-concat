plumber-concat
==============

Concatenation operation for [Plumber](https://github.com/plumberjs/plumber) pipelines.

## Example

    var concat = require('plumber-concat');

    module.exports = function(pipelines) {

        pipelines['compile'] = [
            all(
                glob('main.js'),
                bower('jquery', 'jquery.min.js')
            ),
            concat('app'), // => single `app.js' resource
            // ... more pipeline operations
        ];

    };


## API

### `concat(newName)`

Concatenate all input resources into a single one, under the given new name.

All input resources must be of the same type, else the operation will fail.

Source maps for all input resources will be updated or generated accordingly.

Note: the `newName` should **not** include the file extension. The extension is managed and added automatically.
