'use strict';

var path = require('path');
var _ = require('lodash');
var glob = require('glob');


function unpack( ){
   var unpack = require('browser-unpack'),
      fs = require('fs'),
      path = require('path'),
      mkdirp = require('mkdirp'),
      combineSourceMap = require('combine-source-map'),
      paths  = require('./paths'),
      dest = paths.THEME,
      dev = 'dev',
      build = 'build';


    var src = fs.readFileSync(path.resolve('./',paths.build.dest+'/app.js'), 'utf8');


    mkdirp.sync('./' + build + '/' + dev);
    var files = unpack(src);

    files.forEach(function(file) {
      src = src.split('["' + file.id + '"][0].apply(exports,arguments)').join(';' + file.source);
    });

    files = unpack(src);

    var i = 0;
    var map = [];
    var index = {};
    files.forEach(function(file) {
      var fileRealName = path.basename(file.id);
      var devFileUrl = '/' + dev + '/' + i + path.extname(fileRealName);
      var devFilePath = './' + build + devFileUrl;
      var fileName = file.id.replace(path.resolve('./')+ '/', '');

      var sourcemap = combineSourceMap.create();
      sourcemap.addFile({
        sourceFile: '/' + dest + '/' + fileName,
        source: file.source
      }, {
        line: 1
      });

      var comment = sourcemap.comment();
      var inline = new Buffer('\n' + comment + '\n');

      fs.writeFileSync(devFilePath, 'var replace_' + i + ' = function(require,module,exports){' +
        '\n ' + file.source + ' \n' +
        '}' + inline);

      src = src.replace(file.source, 'return replace_' + i + '(require,module,exports);');

      map.push({
        src: devFileUrl,
        index: fileName,
        line: 'var replace_' + i + ' = function(require,module,exports){',
      });


      i++;
    });

    fs.writeFileSync('./' + build + '/' + dest + '/loader.js', src);
    fs.writeFileSync('./' + build + '/src.json', JSON.stringify(map));

}

// resolve a sass module to a path

function resolveBrowserifyPath(sassPath, loadPaths, extensions) {
  // trim sass file extensions
  var re = new RegExp('(\.(' + extensions.join('|') + '))$', 'i');
  var sassPathName = sassPath.replace(re, '');
  // check all load paths
  var i, j, length = loadPaths.length,
    scssPath, partialPath;
  for (i = 0; i < length; i++) {
    for (j = 0; j < extensions.length; j++) {
      scssPath = path.normalize(loadPaths[i] + '/' + sassPathName + '.' + extensions[j]);
      if (fs.existsSync(scssPath)) {
        return scssPath;
      }
    }

    // special case for _partials
    for (j = 0; j < extensions.length; j++) {
      scssPath = path.normalize(loadPaths[i] + '/' + sassPathName + '.' + extensions[j]);
      partialPath = path.join(path.dirname(scssPath), '_' + path.basename(scssPath));
      if (fs.existsSync(partialPath)) {
        return partialPath;
      }
    }
  }

  // File to import not found or unreadable so we assume this is a custom import
  return false;
}

function BrowserifyUnpack(options, dir) {
  this.dir = dir;
  this.loadPaths = options.loadPaths || [];
  this.extensions = options.extensions || [];
  this.index = [];
  this.link = [];

  if (dir) {
    var map = this;
    _(glob.sync(dir + '/**/*.@(' + this.extensions.join('|') + ')', {
      dot: true
    })).forEach(function(file) {
      map.addFile(path.resolve(file));
    }).value();
  }
};

BrowserifyUnpack.prototype.getIncludedLink = function (filepath) {

      var importsLinks = [];

      var file = this.index[filepath];

      importsLinks = importsLinks.concat(file.links);

      for (var i in file.imports) {
        var link = file.imports[i];
       // console.log(link);
        importsLinks = importsLinks.concat(this.getIncludedLink(link));
      }

      return importsLinks;
}

// add a sass file to the BrowserifyUnpack
BrowserifyUnpack.prototype.addFile = function(filepath, parent) {
  var entry = parseData(fs.readFileSync(filepath, 'utf-8'));
  var cwd = path.dirname(filepath);

  var i, length = entry.imports.length,
    loadPaths, resolved;
  for (i = 0; i < length; i++) {
    loadPaths = _([cwd, this.dir]).concat(this.loadPaths).filter().uniq().value();
    resolved = resolveBrowserifyPath(entry.imports[i], loadPaths, this.extensions);
    if (!resolved) continue;


    // recurse into dependencies if not already enumerated
    if (!_.contains(entry.imports, resolved)) {
      entry.imports[i]= resolved;
      this.addFile(fs.realpathSync(resolved), filepath);
    }

  }

  this.registerLink(filepath,entry.property);

  this.index[filepath] = entry;

};

// a generic visitor that uses an edgeCallback to find the edges to traverse for a node
BrowserifyUnpack.prototype.visit = function(filepath, callback, edgeCallback, visited) {
  filepath = fs.realpathSync(filepath);
  var visited = visited || [];
  if (!this.index.hasOwnProperty(filepath)) {
    edgeCallback('BrowserifyUnpack doesn\'t contain ' + filepath, null);
  }
  var edges = edgeCallback(null, this.index[filepath]);

  var i, length = edges.length;
  for (i = 0; i < length; i++) {
    if (!_.contains(visited, edges[i])) {
      visited.push(edges[i]);
      callback(edges[i], this.index[edges[i]]);
      this.visit(edges[i], callback, edgeCallback, visited);
    }
  }
};

function processOptions(options) {
  return _.assign({
    loadPaths: [process.cwd()],
    extensions: ['scss', 'css'],
  }, options);
}

module.exports.parseFile = function(filepath, options) {
  if (fs.lstatSync(filepath).isFile()) {
    filepath = path.resolve(filepath);
    options = processOptions(options);
    var map = new BrowserifyUnpack(options);
    map.addFile(filepath);
    map.resolveLink();
    return map;
  }
  // throws
};



module.exports.parseDir = function(dirpath, options) {
  if (fs.lstatSync(dirpath).isDirectory()) {
    dirpath = path.resolve(dirpath);
    options = processOptions(options);
    var map = BrowserifyUnpack(options, dirpath);
    return map;
  }
  // throws
};
