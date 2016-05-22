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
  -f, --file       File to unpack                                     [required]
  -n, --name       Output directory name
  -d, --directory  Source files directory
  -s, --sourcemap  add sourcemap to output files                 [defaut: false]
  -m, --map        Generate a map of the generated files         [defaut: false]
  -v, --verbose    Show logs                                     [defaut: false]
  --version        Affiche le numéro de version                        [boolean]
  -h, --help       Affiche de l'aide                                   [boolean]

Exemples:
  browserifyunpack -f foo.js  Cut a browserify bundle in multiple files

```

Usage via the API:

```
Usage:
var BrowserifyUnpack = require('browserify-unpack');
var unpacker = new BrowserifyUnpack({ options... });
var map = unpacker.unpack();

Options:
file                                                          [string, required]
  the relative or absolute file path of the browserified js file to unpack

name          [string, default: '_'+path.basename(options.file)+'_/browserify/']
  the directory into which to unpack the browserify bundled files

verbose                                                [boolean, default: false]
  turn additional console logging on or off
map                                                    [boolean, default: false]
  whether to generate a browserify.map.json file containing an array of
  objects with: url, path, src, externals, deps, and line properties
  for each unpacked file
sourcemap                                              [boolean, default: false]
  whether to generate a source map comment in each unpacked file
write                                      [function, default: fs.writeFileSync]
  an override function to customize how the unpacked files are saved,
  the default behavior is to write them to sub-directories in a
  directory specified by options.name
  (this can be customized via the options.output option)
write                                      [function, default: fs.writeFileSync]
  an override function to customize the creation of the directories
  where unpacked files are saved
withNode                                               [boolean, default: false]
  if true, unpack node_modules files along with other browserified files,
  false to skip outputting node_modules files
loaderUrl                                     [string, options.name+'loader.js']
  the 'file' constructor property to pass to the 'source-map' library
  for generating source maps in the unpacked files,
  only used if options.sourcemap == true
output                                      [string, path.dirname(options.file)]
  customize the base output directory path which, in combination with
  options.name, is where the unpacked files are written
nodeDir                 [string, Module._nodeModulePaths(path.dirname('./'))[0]]
  customize the path to the 'node_modules' directory
directory            [string, (options.directory || path.dirname(options.file))]
  source files location (pre-browserify)
root                                                     [string, process.cwd()]
  the project root directory, used to resolve various paths
entryFile                                                     [string, optional]
  optional name of the entry file to the browserify bundle
  (i.e. the browserify({ entries: [fileName] }) file),
  the default value is 'this.sourceDir + path.basename(options.file)'
relativizeOutputPath                                          [stringm optional]
  optional path against which the unpacked file paths are relativized,
  useful if the browserify bundle file paths are absolute and you don't want
  to create a copy of the fully directory path inside the unpacked directory.
  i.e. if the relativizeOutputPath='root\Unpacker\src\' and the bundle contains
  a file with the path 'root\Unpacker\src\pkg1\Bar.js', then Bar.js is written
  to '$OUTPUT$\pkg1\Bar.js' in the output directory.
  The default behavior is to write Bar.js to
  '$OUTPUT$\root\Unpacker\src\pkg1\Bar.js'
```

## Authors

[Steed Monteiro](http://twitter.com/SteedMonteiro).

## License

BSD
