'use strict';

var path = require('path');
var fs = require('fs');
var combineSourceMap = require('combine-source-map');
var mkdirp = require('mkdirp');

function BrowserifyUnpack(options) {

  this.filepath = path.resolve(options.src);

  if (fs.lstatSync(this.filepath).isFile()) {

    this.dest = options.dest || false ;
    this.name = options.name || 'dev' ;
    this.verbose = options.verbose || false ;
    this.dir = path.resolve(path.dirname(this.filepath));
    this.loadPaths = options.loadPaths || [];
    this.extensions = options.extensions || [];
    this.index = [];
    this.link = [];
    this.bar = false;
  }
};

BrowserifyUnpack.prototype.unpackTo = function(options) {

  var toPath = options.dest;

  this.src = fs.readFileSync(this.filepath, 'utf8');
  var unpack = require('browser-unpack');

  if(this.verbose){
		var ProgressBar = require('progress');
		var barOpts = {
	   width: 30,
	   total: 100,
	   clear: true
	 };

	 this.bar = new ProgressBar('Unpacking... [:bar] :percent', barOpts);
	}

	if(this.verbose){
		this.bar.tick(1);
	}

  var files = unpack(this.src);

	if(this.verbose){
		this.bar.tick(30);
	}
  files.forEach(function(file,index) {
    this.src  = this.src.split('["' + file.id + '"][0].apply(exports,arguments)').join(';' + file.source);
  }.bind(this));


	if(this.verbose){
		this.bar.tick(50);
	}

  files = unpack(this.src);

  this.dir = path.resolve(toPath);

	if(this.verbose){
		this.bar.tick(80);
	}

  return this.generateFiles(files, this.dir);

};

BrowserifyUnpack.prototype.generateFiles = function(files, toPath, tickStart) {


  mkdirp.sync(toPath);

  var indexFile = 0;
  var map = [];
  var index = {};
  files.forEach(function(file) {

    var extension = path.extname(file.id);
    var baseUrl = this.name+'/' + extension.substr(1) + '/';
    mkdirp.sync(toPath + '/' + baseUrl);

    var fileRealName =  file.id.replace(path.resolve('./') + '/', '')
    .replace(/\//g, '-')
    .replace(path.extname(file.id), '');

    var devFileUrl =  baseUrl + fileRealName + extension;
    var devFilePath = toPath + '/' + baseUrl + fileRealName + extension;

    if (fs.existsSync(file.id)) {
      var src = fs.readFileSync(file.id).toString();
    }else {
      var src = file.source;
    }

    var sourcemap = combineSourceMap.create();
    sourcemap.addFile({
      sourceFile: file.id.replace(path.resolve('./'), ''),
      source:src
    }, {
      line: 1
    });

    var comment = sourcemap.comment();
    var inline = new Buffer('\n' + comment + '\n');

    fs.writeFileSync(devFilePath, 'var replace_' + indexFile + ' = function(require,module,exports){' +
    '\n' + file.source + '\n' +
    '}' + inline);

    this.src = this.src.replace(file.source, 'return replace_' + indexFile + '(require,module,exports);');

    map.push({
      src: devFileUrl,
      index: file.id,
      line: 'var replace_' + indexFile + ' = function(require,module,exports){',
    });

    indexFile++;
 		if(this.verbose){
    	this.bar.tick(indexFile);
    }

  }.bind(this));


  if(this.verbose){
		this.bar.tick(100);
	}

  fs.writeFileSync(toPath + '/loader.js', this.src);

  return map;

};

module.exports =  BrowserifyUnpack;
