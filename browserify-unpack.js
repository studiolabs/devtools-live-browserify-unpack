'use strict';

var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var Module = require('module');
var parse = require('esprima-fb').parse;
var sourceMap = require('source-map');
var convertSourceMap = require('convert-source-map');
var _ = require('lodash');
var resolve = require('browser-resolve');

var util = require("util");

function BrowserifyUnpack(options) {

	this.filepath = path.resolve(options.file);

	fs.accessSync(this.filepath);

	if (fs.lstatSync(this.filepath).isFile()) {
		this.name = options.name || '_' +path.basename(this.filepath)+'_';
		this.bVerbose = options.verbose || false ;
		this.bMap = options.map || false ;
		this.bSourceMap = options.sourcemap || false ;
		this.write = options.write || fs.writeFileSync ;
		this.mkdir = options.mkdir || mkdirp.sync ;
		this.withNode = options.withNode || false ;
		this.output = path.resolve( options.output || path.dirname(this.filepath));
		this.index = [];
		this.link = [];
		this.nodeDir = options.nodeDir || Module._nodeModulePaths(path.dirname('./'))[0];
		this.sourceDir = path.resolve( options.directory || path.dirname(this.filepath)) + '/';
		this.rootDir = path.resolve( options.root || process.cwd()) + '/';
	}
};

BrowserifyUnpack.prototype.readSource = function(src, fileName) {
	// If src is a Buffer, esprima will just stringify it, so we beat them to
	// the punch. This avoids the problem where we're using esprima's range
	// indexes -- which are meant for a UTF-16 string -- in a buffer that
	// contains UTF-8 encoded text.

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
	var entries = args[2].elements.map(function(e) {
		return e.value
	});

	var maps = [];
	var index = [];
	var keys = [];
	var main = null;

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
			if('oMfpAn' == dep.key.value) return acc;
			acc[dep.key.value] = dep.value.value;
			return acc;
		}, {});

		var row = {
			id: file.key.value,
			deps: deps,
			start : start,
			end : end
		};

		if (maps[row.id] == undefined) maps[row.id] = { names: [] };

		maps[row.id].row = row;
		maps[row.id].id = row.id;

		if (entries.indexOf(row.id) >= 0) {
			maps[row.id].names[fileName] = 1;
			row.entry = true;
			main = maps[row.id];
		}

		return row;

	}.bind(this));


	maps = this.fillPath(maps, main, this.sourceDir+fileName);

	for( var id in  maps ){
		var item = maps[id];
		item.row.node = false ;
		if(item.row.path){
			item.row.name = item.row.path.replace(this.sourceDir, '');
			var isModule = item.row.path.indexOf('node_modules');
			if( isModule > 0){
				item.row.name = item.row.path.substr(isModule);
				item.row.node = true ;
			}
			index[item.row.start] = item.row;
		}
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




BrowserifyUnpack.prototype.extract = function(file, browserifySource) {

	if (this.bVerbose) {
		console.log("Extracting Content..");
	}

	var fileContentPosition = this.getContentPosition(browserifySource);

	if (this.bVerbose) {
		console.log("Reading sourcemap...")
	}

	var browserifySourceMap = this.getFileSourceMap(browserifySource, file.path);

	if (this.bVerbose) {
		console.log("Creating file sontent...")
	}

	return this.createFileContent(browserifySource, fileContentPosition, browserifySourceMap, file);
}

BrowserifyUnpack.prototype.getFileSourceMap = function(fileContent, filePath) {

	var fileSourceMap = null;
	var sourcemap = convertSourceMap.fromSource(fileContent,true).toObject();

	var consumer = new sourceMap.SourceMapConsumer(sourcemap);

	consumer.eachMapping(function (m) {
		var path =  Module._findPath(m.source, [this.rootDir, this.sourceDir, this.nodeDir]);
		if(path == filePath ){
			if(fileSourceMap == null){
				fileSourceMap = {
					mappings :[],
					original : consumer.sourceContentFor(m.source)
				};
			}
			fileSourceMap.mappings.push(m);
		}

	}.bind(this), {}, consumer.GENERATED_ORDER);

	fileSourceMap.start = fileSourceMap.mappings[0];
	fileSourceMap.end = fileSourceMap.mappings.slice(-1)[0];

	return fileSourceMap;
};



BrowserifyUnpack.prototype.getContentPosition = function(src) {

	// If src is a Buffer, esprima will just stringify it, so we beat them to
	// the punch. This avoids the problem where we're using esprima's range
	// indexes -- which are meant for a UTF-16 string -- in a buffer that
	// contains UTF-8 encoded text.

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
	var entries = args[2].elements.map(function(e) {
		return e.value
	});

	var maps = [];
	var index = [];
	var keys = [];
	var main = null;

	for (var i in files) {

		var file = files[i];
		if (entries.indexOf(file.key.value) >= 0) {

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

			return { start : start, end : end };
	    }

	};

};


BrowserifyUnpack.prototype.createFileContent = function(browserifySource, browserifySourcePosition, browserifySourceMap, file) {


	var browserifyContent = browserifySource.slice(browserifySourcePosition.start, browserifySourcePosition.end);

	var generator = new sourceMap.SourceMapGenerator({
	  file: '/'+file.url
	});

	var lineDiff = browserifySourceMap.start.generatedLine - 1;

	for( var i in browserifySourceMap.mappings ){
		var mapping = browserifySourceMap.mappings[i];

		generator.addMapping({
		  source: '/'+file.name,
		  original: { line: mapping.originalLine, column: mapping.originalColumn },
		  generated: { line: mapping.generatedLine - lineDiff, column: mapping.generatedColumn }
		});
	}

	generator.setSourceContent('/'+file.name, browserifySourceMap.original);
	var sourcemap = convertSourceMap.fromJSON(generator.toString());
	var inlineSourceMap = sourcemap.toComment();

	return {
		content : browserifyContent,
		mapInline : inlineSourceMap
	};

};

BrowserifyUnpack.prototype.fillPath = function(maps, item , filepath) {

	if(item.row.path === undefined){
		item.row.path = filepath;
		for(var dependencie in item.row.deps){
			var dirpath = path.dirname(filepath)+'/';
			var res =  Module._findPath(dependencie, [dirpath, this.sourceDir]);
			if(res){
				this.fillPath(maps, maps[item.row.deps[dependencie]], res);
			}else {
				var res =  Module._findPath(dependencie, [this.nodeDir, this.rootDir]);
				if(res){
					this.fillPath(maps, maps[item.row.deps[dependencie]], res);
				}else{
					var res =  Module._findPath(dependencie, Module._nodeModulePaths(dirpath));
					if(res){
						this.fillPath(maps, maps[item.row.deps[dependencie]], res);
					}else{
						item.path = dirpath+dependencie;
					}
				}
			}
		}
	}

	return  maps;
}

BrowserifyUnpack.prototype.unpack = function() {

	if (this.bVerbose) {
		console.log("Reading file...");
	}

	var browserifySource = fs.readFileSync(this.filepath, 'utf8');

	var browserifyFiles = this.readSource(browserifySource, path.basename(this.filepath));

	if (this.bVerbose) {
		console.log("Reading source map...")
	}

	var browserifySourceMap = this.readSourceMap(browserifySource);

	if (this.bVerbose) {
		console.log("Saving files...")
	}

	return this.generateFiles(browserifyFiles, browserifySource,  browserifySourceMap,this.output);
}



BrowserifyUnpack.prototype.readSourceMap = function(src) {

	var files = [];
	var loaderMap = [];
	var sourcemap = convertSourceMap.fromSource(src,true).toObject();

	var consumer = new sourceMap.SourceMapConsumer(sourcemap);

	consumer.eachMapping(function (m) {
		var path =  Module._findPath(m.source, [this.rootDir, this.sourceDir, this.nodeDir]);
		if(path){
			if(files[path] == undefined){
				files[path] = {
					mappings :[],
					original : consumer.sourceContentFor(m.source)
				};
			}
			files[path].mappings.push(m);

		}

	}.bind(this), {}, consumer.GENERATED_ORDER);

	for( var i in files ){
		files[i].start = files[i].mappings[0];
		files[i].end = files[i].mappings.slice(-1)[0];
		loaderMap[files[i].start] = files[i];
	};

	return {
		files: files,
		loader : loaderMap
	};
};

BrowserifyUnpack.prototype.generateFiles = function(files, originalSource, sourceMapData, toPath) {

	this.mkdir(toPath);

	var map = [];
	var index = {};
	var baseUrl = this.name + '/browserify/';
	this.mkdir(toPath + '/' + baseUrl);
	var loader = "";
	var start = 0;

	var loaderGenerator = new sourceMap.SourceMapGenerator({
	  file: '/'+"loader.js"
	});

	files.forEach(function(file) {


		loader += originalSource.slice(start, file.start);
		start = file.start;

		if(this.withNode == false &&  file.node == true) return;


		var devFileUrl =  baseUrl + file.name
		var devFilePath = toPath + '/' + baseUrl + file.name;
		var inline = "";
		var generatedCode = originalSource.slice(file.start, file.end);

		this.mkdir(path.dirname(devFilePath));

		var browserifyVarName = 'browserify_' +file.name.replace(/([\/|\.|\-])/g, '_');

		var browserifyVarName = file.name.replace(/([\/|\.|\-])/g, '_');

        var moduleName = path.parse(file.path).name.replace(/([\/|\.|\-])/g, '_');

		var browserifyUpdate = this.createUpdateEvent(browserifyVarName, moduleName);

		var browserifyLine = 'var ' +browserifyVarName+ ' = function(require, module, exports){';

		var smf = sourceMapData.files[file.path];
		smf.file = file;

		var browserifyFunction = browserifyVarName+ '(require,module,exports);\n'+
		browserifyUpdate;

		var browserifyFunctionLines = browserifyFunction.split('\n').length;

		file.lines = generatedCode.split('\n').length;

		if(this.bSourceMap && file.node == false){
				file.generator = new sourceMap.SourceMapGenerator({
				  file: '/'+devFileUrl
				});

				var lineDiff  = smf.start.generatedLine - browserifyFunctionLines;

				for( var i in smf.mappings ){
					var mapping = smf.mappings[i];

					file.generator.addMapping({
					  source: '/'+file.name,
					  original: { line: mapping.originalLine, column: mapping.originalColumn },
					  generated: { line: mapping.generatedLine - lineDiff , column: mapping.generatedColumn }
					});
				}

				file.generator.setSourceContent('/'+file.name, smf.original);
				file.sourcemap = convertSourceMap.fromJSON(file.generator.toString());
				var inline = file.sourcemap.toComment();
		}

		this.write(devFilePath,  browserifyLine+ '\n' + generatedCode + '\n' + '}' + '\n' + inline);

		loader += browserifyFunction;

		start = file.end;

		if (this.bMap) {
			map.push({
				variable : browserifyVarName,
				url: devFileUrl,
				path: file.path,
				name: file.name,
				deps: _.keys(file.deps),
				line: browserifyLine
			});
		}

	}.bind(this));

	loader += originalSource.slice(start);

	var diff = 0;

	for(var i in sourceMapData.loader){

		var smf = sourceMapData.loader[i];

		if(smf.file.node == true){

			for( var i in smf.mappings ){
				var mapping = smf.mappings[i];
				loaderGenerator.addMapping({
				  source: '/'+smf.file.name,
				  original: { line: mapping.originalLine, column: mapping.originalColumn },
				  generated: { line: mapping.generatedLine - diff, column: mapping.generatedColumn }
				});
			}

		}

			diff +=  smf.start.generatedLine - smf.end.generatedLine - smf.file.lines;

			loaderGenerator.setSourceContent('/'+smf.file.name, smf.original);


	};

	var sourcemap = convertSourceMap.fromObject(loaderGenerator);

	this.write(toPath + '/loader.js',  loader +'\n'+ sourcemap.toComment());

	if (this.bMap) {

	this.write(toPath+'/'+this.name+'/browserify.map.json', JSON.stringify(map));

		if (this.bVerbose) {
			console.log('browserify.map.json generated');
		}

	}

	if (this.bVerbose) {
		console.log("Done");
	}

	return map;

};

BrowserifyUnpack.prototype.createUpdateEvent = function(event, moduleName) {

	return "if(module.exports.prototype !== undefined){\n"+
		"if(module.exports.prototype.constructor !== undefined ){\n"+
		" 	var Module = module.exports; \n"+
		"	var "+moduleName+" =function(){\n"+
		"		this.liveEvent = '"+event+"';\n"+
		"		window.addEventListener(this.liveEvent,function(){\n"+
		"			if(this.onLiveChange !== undefined){\n"+
		"				this.onLiveChange();\n"+
		"			}\n"+
		"		}.bind(this));\n"+
		"		return Module.apply(this,arguments);\n"+
		"	};\n"+
		" 	Object.assign("+moduleName+", Module);\n"+
		"	"+moduleName+".prototype = Module.prototype;\n"+
		"	"+moduleName+".prototype.constructor = "+moduleName+";\n"+
		"	module.exports = "+moduleName+";\n"+
		"}\n"+
	"}";

};


module.exports =  BrowserifyUnpack;
