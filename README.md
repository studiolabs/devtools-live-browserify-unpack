# Browserify Unpack

Bowserify unpack cuts a browserify bundle into multiple files and writes them to an output directory in their original, pre-bundled, structure

## Install

Install with [npm](https://npmjs.org/package/browserify-unpack)

```
npm install --save-dev browserify-unpack
```

## Usage

Usage via the API:

```js
var fs = require('fs');
var path = require('path');
var paths = require('./paths');

var BrowserifyUnpack = require('browserify-unpack');

var Package = new BrowserifyUnpack({
 		file: paths.build.dest + '/app.js',
        output: paths.build.dest,
        map: true,
        sourcemap: true
        // options...
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
  -s, --sourcemap  add sourcemap to output files                [default: false]
  -m, --map        Generate a map of the generated files        [default: false]
  -v, --verbose    Show logs                                    [default: false]
  --version        Show version number                                 [boolean]
  -h, --help       Show package help information                       [boolean]

Exemples:
  browserifyunpack -f foo.js  Cut a browserify bundle into multiple files

```

Options:
```
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

Example commands:

Assuming the following directory structure:
```
my-app/
  |
  +-- src/
  |     +-- my-app.js
  |     +-- controller1.js
  |     +-- view1.js
  |     +-- services/
  |           +-- twitter-sidebar.js
  |
  +-- bin/
        +-- app-bundle.js
        +-- app-bundle.js.map
	    +-- unpack-dir/  (empty)
```

Unpack into bin/unpack-dir with verbose logging:
```
browserifyunpack -v --relativize -e my-app.js -f bin/app-bundle.js -d src -o bin/unpack-dir
```
'-v' verbose logging
'-e' the name of the bundle's entry file
'-f' the path of the bundled browserified JS file
'-d' the source directory containing the original JS files used in the bundle
'-o' the destination directory to write the unpacked files to
'--relativize' to create a correct output structure on windows

Once complete the unpack-dir should look like this:
```
bin/
  +-- unpack-dir/
        +-- loader.js  (the app-bundle.js file wrapped to listen for browser window events named after the bundle's JS files)
        +-- browserify/
              +-- _app-bundle.js_/
                    +-- my-app.js
                    +-- controller1.js
                    +-- view1.js
                    +-- services/
                          +-- twitter-sidebar.js
```

To change the '_app-bundle.js_' output sub-directory name, set the 'name' (-n) option:
```
browserifyunpack -v --relativize -n my-app -e my-app.js -f bin/app-bundle.js -d src -o bin/unpack-dir
```

This time the unpack-dir should look like this:
```
bin/
  +-- unpack-dir/
        +-- loader.js  (the app-bundle.js file wrapped to listen for browser window events named after the bundle's JS files)
        +-- browserify/
              +-- my-app/
                    +-- my-app.js
                    +-- controller1.js
                    +-- view1.js
                    +-- services/
                          +-- twitter-sidebar.js
```


## Authors

[Steed Monteiro](http://twitter.com/SteedMonteiro).

## License

BSD
