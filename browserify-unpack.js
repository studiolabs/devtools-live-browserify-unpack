'use strict';

var path = require('path');
var fs = require('fs');
var combineSourceMap = require('combine-source-map');
var mkdirp = require('mkdirp');

var parse = require('esprima-fb').parse;

var _ = require('lodash');



function BrowserifyUnpack(options) {

	this.filepath = path.resolve(options.file);

	fs.accessSync(this.filepath);

	if (fs.lstatSync(this.filepath).isFile()) {
		this.name = options.name || path.parse(this.filepath).name ;
		this.bVerbose = options.verbose || false ;
		this.bMap = options.map || false ;
		this.bSourceMap = options.sourcemap || false ;
		this.sourceDir = path.resolve( options.directory || './') + '/';
		this.output = path.resolve( options.output || path.dirname(this.filepath));
		this.index = [];
		this.link = [];
	}
};


BrowserifyUnpack.prototype.clearName = function(name) {
	name = name.replace(this.sourceDir, '');
	var start = name.lastIndexOf('./');
	if (start == -1) start = 0;
	if (name[start] == "/") start++;
	if (name[start + 1] == "/") start += 2;
	return name.substr(start);
}

BrowserifyUnpack.prototype.getItemUrl = function(names) {

	var url = "";

	names.map(function(name) {

		var newName = this.clearName(name);
		if (newName.length > url.length) {
			url = newName;
		};
		return newName;
	}.bind(this));

	if (path.extname(url) == '') {
		url += '.js';
	}

	return url;
};


BrowserifyUnpack.prototype.start = function(src, fileName) {
	// If src is a Buffer, esprima will just stringify it, so we beat them to
	// the punch. This avoids the problem where we're using esprima's range
	// indexes -- which are meant for a UTF-16 string -- in a buffer that
	// contains UTF-8 encoded text.
	if (typeof src !== 'string') {
		src = String(src);
	}

	var ast = parse(src, { range: true });

	ast.body = ast.body.filter(function(node) {
		return node.type !== 'EmptyStatement';
	});

	if (ast.body.length !== 1) return;
	if (ast.body[0].type !== 'ExpressionStatement') return;
	if (ast.body[0].expression.type === 'UnaryExpression') {
		var body = ast.body[0].expression.argument;
	} else if (ast.body[0].expression.type === 'AssignmentExpression') {
		var body = ast.body[0].expression.right;
	} else {
		var body = ast.body[0].expression;
	}

	if (body.type !== 'CallExpression') return;

	var args = body.arguments;
	if (args.length === 1) args = extractStandalone(args) || args;
	if (args.length !== 3) return;

	if (args[0].type !== 'ObjectExpression') return;
	if (args[1].type !== 'ObjectExpression') return;
	if (args[2].type !== 'ArrayExpression') return;

	var files = args[0].properties;
	var cache = args[1];
	var entries = args[2].elements.map(function(e) {
		return e.value
	});

	var maps = [];
	var index = [];

	this.unit  = files.length / 200;
	this.progress = 10;

	files.map(function(file) {
		var body = file.value.elements[0].body.body;
		var start, end;
		if (body.length === 0) {
			if (body.range) {
				start = body.range[0];
				end = body.range[1];
			} else {
				start = 0;
				end = 0;
			}
		}
		else {
			start = body[0].range[0];
			end = body[body.length - 1].range[1];
		}

		var depProps = file.value.elements[1].properties;

		var deps = depProps.reduce(function(acc, dep) {
			acc[dep.key.value] = dep.value.value;
			if (maps[dep.value.value] == undefined) maps[dep.value.value] = { names: [] };
			if (maps[dep.value.value].names[dep.key.value] == undefined) maps[dep.value.value].names[dep.key.value] = 0;
			maps[dep.value.value].names[dep.key.value]++;
			return acc;
		}, {});

		var row = {
			id: file.key.value,
			source: src.slice(start, end),
			deps: deps
		};

		if (maps[row.id] == undefined) maps[row.id] = { names: [] };



		maps[row.id].row = row;
		maps[row.id].id = row.id;

		if (entries.indexOf(row.id) >= 0) {
			maps[row.id].names[fileName] = 1;
			row.entry = true;
		}

		return row;

	}.bind(this));

	for( var id in  maps ){

		var item = maps[id].row;
		if(typeof id == "string" && fs.existsSync(id)){
			item.name = this.clearName(id);
		}else{
			item.name = this.getItemUrl(_.keys(file.names), file);
		}

		index.push(item);

	};

	return index;

};

function extractStandalone(args) {
	if (args[0].type !== 'FunctionExpression') return;
	if (args[0].body.length < 2) return;
	if (args[0].body.body.length < 2) return;

	args = args[0].body.body[1].argument;
	if (args.type !== 'CallExpression') return;
	if (args.callee.type !== 'CallExpression') return;

	return args.callee.arguments;
};

BrowserifyUnpack.prototype.unpack = function() {

	if (this.bVerbose) {
		console.log("Reading file...")
	}

	this.src = fs.readFileSync(this.filepath, 'utf8');

	//files.forEach(function(file,index) {
	//  this.src  = this.src.split('["' + file.id + '"][0].apply(exports,arguments)').join(';' + file.source);
	//}.bind(this));

	if (this.bVerbose) {
		console.log("Unpacking...")
	}

	var files = this.start(this.src, path.basename(this.filepath));

	if (this.bVerbose) {
		console.log("Saving Files...")
	}

	return this.generateFiles(files, this.output);

};

BrowserifyUnpack.prototype.generateFiles = function(files, toPath) {

	mkdirp.sync(toPath);

	var indexFile = 0;
	var map = [];
	var index = {};
	var baseUrl = this.name + '/browserify/';
	mkdirp.sync(toPath + '/' + baseUrl);

	files.forEach(function(file) {

		var devFileUrl =  baseUrl + file.name
		var devFilePath = toPath + '/' + baseUrl + file.name;
		var inline = "";


		if(this.bSourceMap){


		if (fs.existsSync(this.sourceDir + file.name)) {
			var src = fs.readFileSync(this.sourceDir + file.name).toString();
		}else {
			var src = file.source;
		}

		var sourcemap = combineSourceMap.create();
		sourcemap.addFile({
			sourceFile: '/' + file.name,
			source:src
		}, {
			line: 1
		});

		var comment = sourcemap.comment();
		var inline = new Buffer('\n' + comment + '\n');

		}

		mkdirp.sync(path.dirname(devFilePath));

		fs.writeFileSync(devFilePath, 'var replace_' + indexFile + ' = function(require,module,exports){' +
		'\n' + file.source + '\n' +
		'}' + inline);

		this.src = this.src.replace(file.source, 'return replace_' + indexFile + '(require,module,exports);');

		if (this.bMap) {
			map.push({
				src: devFileUrl,
				index: file.name,
				line: 'var replace_' + indexFile + ' = function(require,module,exports){',
			});
		}

		indexFile++;

	}.bind(this));



	fs.writeFileSync(toPath + '/loader.js', this.src);

	if (this.bMap) {

	fs.writeFileSync(toPath+'/'+this.name +'/browserify.map.json', JSON.stringify(map));

		if (this.bVerbose) {
			console.log('Map generated');
		}

	}

	if (this.bVerbose) {
		console.log("Done")
	}

	return map;

};

module.exports =  BrowserifyUnpack;
