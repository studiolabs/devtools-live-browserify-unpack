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
Usage as a command line tool:

The command line tool will parse a graph and then either display ancestors, descendents or both.

```
$ browserifyunpack -h
Usage: browserifyunpack -f <file> [options]

Options:
  -d, --destination  Path to save the output ( map.json + files)
          [défaut: "/Volumes/WORKSPACE/Dropbox/www/dev/project/photobox/studio"]
  -f, --file         File to unpack                                     [requis]
  -n, --name         Output directory name                       [défaut: "dev"]
  -v, --verbose      Debug                                       [défaut: false]
  --version          Affiche le numéro de version                      [booléen]
  -h, --help         Affiche de l'aide                                 [booléen]

Exemples:
  browserifyunpack -f foo.js  Cut a browserify bundle in multiple files
```

## Authors

[Steed Monteiro](http://twitter.com/SteedMonteiro).

## License

BSD
