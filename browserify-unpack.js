'use strict';

var path = require('path');
var _ = require('lodash');
var glob = require('glob');

function BrowserifyUnpack(options) {

  this.filepath = path.resolve(options.src);

  if (fs.lstatSync(this.filepath).isFile()) {

    options = processOptions(options);

    this.dest = options.dest || false ;
    this.dir = path.resolve(path.dirname(this.filepath));
    this.loadPaths = options.loadPaths || [];
    this.extensions = options.extensions || [];
    this.index = [];
    this.link = [];

  }
};

BrowserifyUnpack.prototype.unpackTo = function(options) {

  var toPath = options.dest;
  var urlRoot = options.urlRoot;

  var SassMap = require('sass-map');

  this.src = fs.readFileSync(srcFilePath, 'utf8');

  var unpack = require('browser-unpack')

  var files = unpack(this.src);

  files.forEach(function(file) {
    this.src  = this.src .split('["' + file.id + '"][0].apply(exports,arguments)').join(';' + file.source);
  });

  files = unpack(this.src);

  this.dir = path.resolve(toPath);

  return this.generateFiles(files, this.dir, urlRoot);

};

BrowserifyUnpack.prototype.generateFiles = function(files, toPath, urlRoot) {

  var combineSourceMap = require('combine-source-map');
  var mkdirp = require('mkdirp');

  mkdirp.sync(toPath);

  var indexFile = 0;
  var map = [];
  var index = {};
  files.forEach(function(file) {

    var extension = path.extname(file.id);
    var baseUrl = '/dev/' + extension.substr(1) + '/';
    mkdirp.sync(toPath + baseUrl);

    var fileRealName =  file.id.replace(path.resolve('./') + '/', '')
                          .replace('/', '-')
                          .replace(path.extname(file.path), '');

    var devFileUrl = urlRoot + baseUrl + fileRealName + extension;
    var devFilePath = toPath + baseUrl + fileRealName + extension;

    var sourcemap = combineSourceMap.create();
    sourcemap.addFile({
        sourceFile: devFileUrl,
        source: file.source
      }, {
        line: 1
      });

    var comment = sourcemap.comment();
    var inline = new Buffer('\n' + comment + '\n');

    fs.writeFileSync(devFilePath, 'var replace_' + indexFile + ' = function(require,module,exports){' +
      '\n ' + file.source + ' \n' +
      '}' + inline);

    this.src = this.src.replace(file.source, 'return replace_' + indexFile + '(require,module,exports);');

    map.push({
        src: devFileUrl,
        index: file.id,
        line: 'var replace_' + i + ' = function(require,module,exports){',
      });

    indexFile++;
  });

  fs.writeFileSync(toPath + '/loader.js', this.src);

  return map;

};
