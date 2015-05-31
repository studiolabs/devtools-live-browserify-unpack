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
 var fs = require('fs'),
      path = require('path'),
      paths  = require('./paths');

var BrowserifyUnpack = require('/www/dev/project/studiolabs/browserify-unpack');

var Package = new BrowserifyUnpack({
  src : paths.build.dest+'/app.js'
});

var map = Package.unpackTo({
    dest :paths.build.dest,
    urlRoot : '/'+paths.THEME
});

fs.writeFileSync(path.resolve(paths.build.dir) + '/src.json', JSON.stringify(map));
```

## Authors

[Steed Monteiro](http://twitter.com/SteedMonteiro).

## License

BSD
