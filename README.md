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
 		file: paths.build.dest + '/app.js',
        output: paths.build.dest,
        map : true,
        sourcemap:true
});

var map = Package.unpack();

```
Usage as a command line tool:

The command line tool will parse a graph and then either display ancestors, descendents or both.

```
$ browserifyunpack -h
Usage: browserifyunpack -f <file> [options]

Options:
  -o, --output     Path to save the output ( map.json + files)
  -f, --file       File to unpack                                       [requis]
  -n, --name       Output directory name
  -d, --directory  Source files directory
  -s, --sourcemap  add sourcemap to output files                 [défaut: false]
  -m, --map        Generate a map of the generated files         [défaut: false]
  -v, --verbose    Show logs                                     [défaut: false]
  --version        Affiche le numéro de version                        [booléen]
  -h, --help       Affiche de l'aide                                   [booléen]

Exemples:
  browserifyunpack -f foo.js  Cut a browserify bundle in multiple files
```

## Authors

[Steed Monteiro](http://twitter.com/SteedMonteiro).

## License

BSD
