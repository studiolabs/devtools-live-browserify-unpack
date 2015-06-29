# Browserify Unpack

Bowserify unpack cut a browserify bundle in multiple files

## Install

Install with [npm](https://npmjs.org/package/browserify-unpack)

```
npm install --save-dev browserify-unpack
```

## Usage

Usage as a Node library:

```js
var fs = require('fs');
var path = require('path');
var paths = require('./paths');

var BrowserifyUnpack = require('browserify-unpack');

var Package = new BrowserifyUnpack({
    src: paths.build.dest + '/app.js'
});

var map = Package.unpackTo({
    dest: paths.build.dest
});

fs.writeFileSync(path.resolve(paths.build.dir) + '/src.json', JSON.stringify(map));
```

## Authors

[Steed Monteiro](http://twitter.com/SteedMonteiro).

## License

BSD
