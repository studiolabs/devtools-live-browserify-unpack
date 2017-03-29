"use strict";

var path = require("path");
var fs = require("fs");
var mkdirp = require("mkdirp");
var Module = require("module");
var esprima_fb = require("esprima-fb");
var sourceMap = require("source-map");
var convertSourceMap = require("convert-source-map");
var resolve = require("browser-resolve");
var Immutable = require("immutable");

var util = require("util");

/**
 * @param {Object} options contains options for configuring BrowserifyUnpack, including:
 * - {string} file the relative or absolute file path of the browserified js file to unpack
 * - {string} [name='_'+path.basename(options.file)+'_/browserify/'] the directory into which to unpack the browserify bundled files
 * - {boolean} [verbose=false] turn additional console logging on or off
 * - {boolean} [map=false] whether to generate a browserify.map.json file containing an array of
 *     objects with: url, path, src, externals, deps, and line properties for each unpacked file
 * - {boolean} [sourcemap=false] whether to generate a source map comment in each unpacked file
 * - {function} [write=fs.writeFileSync] an override function to customize how the unpacked files are saved,
 *     the default behavior is to write them to sub-directories in a directory specified by options.name (this can be customized via the options.output option)
 * - {function} [write=fs.writeFileSync] an override function to customize the creation of the directories where unpacked files are saved
 * - {boolean} [withNode=false] if true, unpack node_modules files along with other browserified files, false to skip outputting node_modules files
 * - {string} [loaderUrl=options.name+'loader.js'] the 'file' constructor property to pass to the 'source-map' library for generating source maps in the unpacked files,
 *     only used if options.sourcemap == true
 * - {string} [output=path.dirname(options.file)] customize the base output directory path which, in combination with options.name, is where the unpacked files are written
 * - {string} [nodeDir=Module._nodeModulePaths(path.dirname('./'))[0]] customize the path to the 'node_modules' directory
 * - {string} [directory=(options.directory || path.dirname(options.file))] source files location (pre-browserify)
 * - {string} [root=process.cwd()] the project root directory, used to resolve various paths
 * - {string} [entryFile] optional name of the entry file to the browserify bundle (i.e. the browserify({ entries: [fileName] }) file), the default value is 'this.sourceDir + path.basename(options.file)'
 * - {string} [relativizeOutputPath] optional path against which the unpacked file paths are relativized,
 *     useful if the browserify bundle file paths are absolute and you don't want to create a copy of the fully directory path inside the unpacked directory.
 *     i.e. if the relativizeOutputPath='root\Unpacker\src\' and the bundle contains a file with the path 'root\Unpacker\src\pkg1\Bar.js',
 *     then Bar.js is written to '$OUTPUT$\pkg1\Bar.js' in the output directory. The default behavior is to write Bar.js to '$OUTPUT$\root\Unpacker\src\pkg1\Bar.js'
 */
function BrowserifyUnpack(options) {
  this.filepath = path.resolve(options.file);

  fs.accessSync(this.filepath);

  if (fs.lstatSync(this.filepath).isFile()) {
    this.name = options.name || "_" + path.basename(this.filepath) + "_";
    this.bVerbose = options.verbose || false;
    this.bMap = options.map || false;
    this.bSourceMap = options.sourcemap || false;
    this.write = options.write || fs.writeFileSync;
    this.mkdir = options.mkdir || mkdirp.sync;
    this.withNode = options.withNode || false;
    this.loaderUrl = options.loaderUrl || this.name + "/loader.js";
    this.output = path.resolve(options.output || path.dirname(this.filepath));
    this.index = [];
    this.link = [];
    this.nodeDir = options.nodeDir ||
      Module._nodeModulePaths(path.dirname("./"))[0];
    this.sourceDir = path.resolve(
      options.directory || path.dirname(this.filepath)
    ) + "/";
    this.rootDir = path.resolve(options.root || process.cwd()) + "/";
    this.entryFile = options.entryFile || options.entry
      ? path.resolve(options.entryFile || options.entry)
      : null;
    this.relativizeOutputPath = options.relativizeOutputPath ||
      options.relativizeoutputpath ||
      false;
  }

  if (options.verbose) {
    console.log(
      "\nBrowserifyUnpack parsed options: " +
        JSON.stringify(
          {
            filepath: this.filepath,
            name: this.name,
            bVerbose: this.bVerbose,
            bMap: this.bMap,
            bSourceMap: this.bSourceMap,
            write: this.write,
            mkdir: this.mkdir,
            withNode: this.withNode,
            loaderUrl: this.loaderUrl,
            output: this.output,
            nodeDir: this.nodeDir,
            sourceDir: this.sourceDir,
            rootDir: this.rootDir,
            entryFile: this.entryFile,
            relativizeOutputPath: this.relativizeOutputPath
          },
          undefined,
          "\t"
        )
    );
  }
}

BrowserifyUnpack.prototype.readSource = function(src, fileName) {
  var astResult = this.extractBrowserifyAst(src);
  var entries = astResult.entries;
  var files = astResult.files;

  var maps = [];
  var index = [];
  var keys = [];
  var main = null;

  files.map(
    function(file) {
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
      } else {
        start = body[0].range[0];
        end = body[body.length - 1].range[1];
      }

      var depProps = file.value.elements[1].properties;

      var deps = depProps.reduce(
        function(acc, dep) {
          if ("oMfpAn" == dep.key.value) return acc;
          acc[dep.key.value] = dep.value.value;
          return acc;
        },
        {}
      );

      var row = {
        id: file.key.value,
        deps: deps,
        start: start,
        end: end
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
    }.bind(this)
  );

  maps = this.fillPath(maps, main, this.entryFile || this.sourceDir + fileName);

  var srcDirForwardSlash = this.sourceDir.split("\\").join("/");
  var srcDirBackSlash = this.sourceDir.split("/").join("\\");

  for (var id in maps) {
    var item = maps[id];
    item.row.node = false;
    if (item.row.path) {
      item.row.src = item.row.path
        .replace(srcDirForwardSlash, "")
        .replace(srcDirBackSlash, "");
      var isModule = item.row.path.indexOf("node_modules");
      if (isModule > 0) {
        item.row.src = item.row.path.substr(isModule);
        item.row.node = true;
      }
      index[item.row.start] = item.row;
    }
  }

  return index;
};

BrowserifyUnpack.prototype.extract = function(file, browserifySource) {
  if (this.bVerbose) {
    console.log("Extracting Content..");
  }

  var fileContentInfo = this.getContentInfo(browserifySource);

  if (this.bVerbose) {
    console.log("Reading sourcemap...");
  }

  var browserifySourceMap = this.getFileSourceMap(browserifySource, file.path);

  if (this.bVerbose) {
    console.log("Creating file content...");
  }

  return this.createFileContent(
    browserifySource,
    fileContentInfo,
    browserifySourceMap,
    file
  );
};

BrowserifyUnpack.prototype.getFileSourceMap = function(fileContent, filePath) {
  var fileSourceMap = null;
  var sourcemap = convertSourceMap.fromSource(fileContent, true).toObject();

  var consumer = new sourceMap.SourceMapConsumer(sourcemap);

  consumer.eachMapping(
    function(m) {
      var path = Module._findPath(m.source, [
        this.rootDir,
        this.sourceDir,
        this.nodeDir
      ]);
      if (path == filePath) {
        if (fileSourceMap == null) {
          fileSourceMap = {
            mappings: [],
            original: consumer.sourceContentFor(m.source)
          };
        }
        fileSourceMap.mappings.push(m);
      }
    }.bind(this),
    {},
    consumer.GENERATED_ORDER
  );

  fileSourceMap.start = fileSourceMap.mappings[0];
  fileSourceMap.end = fileSourceMap.mappings.slice(-1)[0];

  return fileSourceMap;
};

BrowserifyUnpack.prototype.getContentInfo = function(src) {
  var astResult = this.extractBrowserifyAst(src);
  var entries = astResult.entries;
  var files = astResult.files;

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
      } else {
        start = body[0].range[0];
        end = body[body.length - 1].range[1];
      }

      var depProps = file.value.elements[1].properties;

      var deps = depProps.reduce(
        function(acc, dep) {
          if ("oMfpAn" == dep.key.value) return acc;
          acc[dep.key.value] = dep.value.value;
          return acc;
        },
        {}
      );

      return {
        start: start,
        end: end,
        deps: deps
      };
    }
  }
};

/** Parse JS source code and extract the browserify bundle portion of an AST
 */
BrowserifyUnpack.prototype.extractBrowserifyAst = function(src) {
  var ast = esprima_fb.parse(src, { range: true });

  ast.body = ast.body.filter(function(node) {
    return node.type !== "EmptyStatement";
  });

  if (ast.body.length !== 1) return;
  if (ast.body[0].type !== "ExpressionStatement") return;
  if (ast.body[0].expression.type === "UnaryExpression") {
    var body = ast.body[0].expression.argument;
  } else if (ast.body[0].expression.type === "AssignmentExpression") {
    var body = ast.body[0].expression.right;
  } else {
    var body = ast.body[0].expression;
  }

  if (body.type !== "CallExpression") return;

  var args = body.arguments;
  if (args.length === 1) args = extractStandalone(args) || args;
  if (args.length !== 3) return;

  if (args[0].type !== "ObjectExpression") return;
  if (args[1].type !== "ObjectExpression") return;
  if (args[2].type !== "ArrayExpression") return;

  var files = args[0].properties;
  var entries = args[2].elements.map(function(e) {
    return e.value;
  });

  return {
    entries: entries,
    files: files
  };
};

BrowserifyUnpack.prototype.createFileContent = function(
  browserifySource,
  fileContentInfo,
  browserifySourceMap,
  file
) {
  var browserifyContent = browserifySource.slice(
    fileContentInfo.start,
    fileContentInfo.end
  );

  var generator = new sourceMap.SourceMapGenerator({
    file: "/" + file.url
  });

  for (var i in browserifySourceMap.mappings) {
    var mapping = browserifySourceMap.mappings[i];

    generator.addMapping({
      source: "/" + file.src,
      original: { line: mapping.originalLine, column: mapping.originalColumn },
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn
      }
    });
  }

  generator.setSourceContent("/" + file.src, browserifySourceMap.original);
  var sourcemap = convertSourceMap.fromJSON(generator.toString());
  var inlineSourceMap = sourcemap.toComment();

  return {
    content: browserifyContent,
    mapInline: inlineSourceMap,
    info: fileContentInfo
  };
};

/** Recursively resolve relative browserify dependency paths (i.e. objects like {"./Base64":1,"./ZipEntries":22})
 * to absolute paths
 */
BrowserifyUnpack.prototype.fillPath = function(maps, item, entryFilePath) {
  if (item.row.path === undefined) {
    item.row.path = entryFilePath;
    for (var dependencie in item.row.deps) {
      var dirpath = path.dirname(entryFilePath) + "/";
      var res = Module._findPath(dependencie, [dirpath, this.sourceDir]);
      if (res) {
        this.fillPath(maps, maps[item.row.deps[dependencie]], res);
      } else {
        var res = Module._findPath(dependencie, [this.nodeDir, this.rootDir]);
        if (res) {
          this.fillPath(maps, maps[item.row.deps[dependencie]], res);
        } else {
          var res = Module._findPath(
            dependencie,
            Module._nodeModulePaths(dirpath)
          );
          if (res) {
            this.fillPath(maps, maps[item.row.deps[dependencie]], res);
          }
        }
      }
    }
  }

  return maps;
};

/** Main function used to kick off the unpacking process.
 * @param {string} [browserifySource] an optional source code string to unpack,
 * if null, then the constructor's 'options.file' option is read from the filesystem and unpacked
 */
BrowserifyUnpack.prototype.unpack = function(browserifySource) {
  if (this.bVerbose) {
    console.log(
      "Reading file '" +
        this.filepath +
        "' src: " +
        (browserifySource != null
          ? browserifySource.length + " length"
          : null) +
        "..."
    );
  }

  if (browserifySource == undefined) {
    browserifySource = fs.readFileSync(this.filepath, "utf8");
  }

  var browserifyFiles = this.readSource(
    browserifySource,
    path.basename(this.filepath)
  );

  if (this.bVerbose) {
    console.log("Reading source map...");
  }

  var browserifySourceMap = this.readSourceMap(browserifySource);

  if (this.bVerbose) {
    console.log("Saving files...");
  }

  return this.generateFiles(
    browserifyFiles,
    browserifySource,
    browserifySourceMap,
    this.output
  );
};

/** Read the source map from a minified JS file, supports embedded source map comments and source map URL comments.
 * If a source map URL is found, the map file path is assumed to be relative to the parent directory of the JS file
 */
BrowserifyUnpack.prototype.readSourceMap = function(src) {
  var files = [];
  var loaderMap = [];

  var fromSource = convertSourceMap.fromSource(src, true);
  var fromMapFile = !fromSource &&
    this.filepath &&
    convertSourceMap.fromMapFileSource(src, path.dirname(this.filepath));

  if (this.bVerbose) {
    console.log(
      fromSource
        ? "Reading source map from embedded comment"
        : fromMapFile
            ? "Reading source map from source map URL"
            : "Could not load source map, check source file"
    );
  }

  var sourcemap = (fromSource || fromMapFile).toObject();

  var consumer = new sourceMap.SourceMapConsumer(sourcemap);

  consumer.eachMapping(
    function(m) {
      if (m.source == null) return;
      var path = Module._findPath(m.source, [
        this.rootDir,
        this.sourceDir,
        this.nodeDir
      ]);
      if (path) {
        if (files[path] == undefined) {
          files[path] = {
            mappings: [],
            original: consumer.sourceContentFor(m.source)
          };
        }
        files[path].mappings.push(m);
      } else if (this.bVerbose) {
        console.error("could not find source map file '" + m.source + "'");
      }
    }.bind(this),
    {},
    consumer.GENERATED_ORDER
  );

  for (var i in files) {
    files[i].start = files[i].mappings[0];
    files[i].end = files[i].mappings.slice(-1)[0];
    loaderMap[files[i].start] = files[i];
  }

  return {
    files: files,
    loader: loaderMap
  };
};

/** Use the array of browserify bundled file ASTs and the source file string to split off and write each file
 */
BrowserifyUnpack.prototype.generateFiles = function(
  files,
  originalSource,
  sourceMapData,
  toPath
) {
  this.mkdir(toPath);

  var map = [];
  var index = {};
  var baseUrl = this.name + "/browserify/";

  if (this.bVerbose) {
    console.log(
      "Creating directory: '" + baseUrl + "', sourceDir: " + this.sourceDir
    );
  }

  this.mkdir(toPath + "/" + baseUrl);
  var loader = "";
  var start = 0;

  var loaderGenerator = new sourceMap.SourceMapGenerator({
    file: "/" + this.loaderUrl
  });

  if (this.bVerbose) {
    console.log(
      "\nsourceMapData keys:\n\t" +
        Object.keys(sourceMapData.files).join("\n\t") +
        "\n"
    );
  }

  var fileCount = 0;

  var lineDiff = 0;

  files.forEach(
    function(file) {
      loader += originalSource.slice(start, file.start);
      start = file.start;

      if (this.withNode == false && file.node == true) return;

      var fileOutputPath = !this.relativizeOutputPath
        ? file.src
        : path.isAbsolute(file.src)
            ? path.relative(this.rootDir, file.src)
            : file.src;
      var devFileUrl = baseUrl + fileOutputPath;
      var devFilePath = toPath + "/" + baseUrl + fileOutputPath;
      var inline = "";
      var generatedCode = originalSource.slice(file.start, file.end);

      try {
        this.mkdir(path.dirname(devFilePath));
      } finally {
        if (devFilePath.indexOf(":\\") > -1) {
          console.error(
            "cannot create absolute path containing ':\\', consider using the 'relativizeOutputPath' option, the path = '" +
              devFilePath +
              "'\n"
          );
        }
      }

      var browserifyVarName = fileOutputPath.replace(
        /([\/|:\\|\\|\.|\-])/g,
        "_"
      );

      var browserifyUpdate = this.createUpdateEvent(
        fileOutputPath.replace(/([:\\|\\])/g, "/"),
        values(file.deps)
      );

      var browserifyLine = "var " +
        browserifyVarName +
        " = function(require, module, exports){";

      var browserifyFunction = browserifyVarName +
        "(require,module,exports);\n" +
        browserifyUpdate;

      var browserifyFunctionLineCount = browserifyFunction.split("\n").length;

      if (this.bVerbose) {
        console.log(
          "\nsourceMapData '" +
            file.path +
            "' = " +
            sourceMapData.files[file.path]
        );
      }

      var smf = sourceMapData.files[file.path];

      if (smf == null && file.entry == true) {
        console.error(
          "cannot find sourceMapData for file '" +
            file.path +
            "', this file is the bundle's entry file" +
            (this.entryFile
              ? ", but the 'entryFile' option '" +
                  this.entryFile +
                  "' can't be found in the source map data"
              : " and no 'entryFile' option was provided, try providing an entry file name option") +
            "\n"
        );
      }

      smf.file = file;

      file.lines = generatedCode.split("\n").length;

      if (this.bSourceMap && file.node == false) {
        file.generator = new sourceMap.SourceMapGenerator({
          file: "/" + devFileUrl
        });

        lineDiff += browserifyFunctionLineCount;

        for (var i in smf.mappings) {
          var mapping = smf.mappings[i];

          file.generator.addMapping({
            source: "/" + file.src,
            original: {
              line: mapping.originalLine,
              column: mapping.originalColumn
            },
            generated: {
              line: mapping.generatedLine + lineDiff,
              column: mapping.generatedColumn
            }
          });
        }

        file.generator.setSourceContent("/" + file.src, smf.original);
        file.sourcemap = convertSourceMap.fromJSON(file.generator.toString());
        var inline = file.sourcemap.toComment();
      }

      if (this.bVerbose) {
        console.log("Writing: '" + devFileUrl + "'");
      }

      this.write(
        devFilePath,
        browserifyLine + "\n" + generatedCode + "\n" + "}" + "\n" + inline
      );

      loader += browserifyFunction;

      start = file.end;

      if (this.bMap) {
        map.push({
          url: devFileUrl,
          path: file.path,
          src: file.src,
          externals: Object.keys(file.deps),
          deps: Immutable.Map(file.deps),
          line: browserifyLine
        });
      }

      fileCount++;
    }.bind(this)
  );

  loader += originalSource.slice(start);

  var diff = 0;

  for (var i in sourceMapData.loader) {
    var smf = sourceMapData.loader[i];

    if (smf.file != null) {
      if (smf.file.node == true) {
        for (var i in smf.mappings) {
          var mapping = smf.mappings[i];
          loaderGenerator.addMapping({
            source: "/" + smf.file.src,
            original: {
              line: mapping.originalLine,
              column: mapping.originalColumn
            },
            generated: {
              line: mapping.generatedLine - diff,
              column: mapping.generatedColumn
            }
          });
        }
      }

      diff += smf.start.generatedLine +
        smf.file.lines -
        (smf.end.generatedLine + smf.file.lines);

      loaderGenerator.setSourceContent("/" + smf.file.src, smf.original);
    }
  }

  var sourcemap = convertSourceMap.fromObject(loaderGenerator);

  var loaderContent = convertSourceMap.removeComments(loader) +
    "\n" +
    sourcemap.toComment();

  if (this.bVerbose) {
    console.log("Writing: '" + this.loaderUrl + "'");
  }

  this.write(toPath + "/" + this.loaderUrl, loaderContent);

  if (this.bMap) {
    this.write(
      toPath + "/" + this.name + "/browserify.map.json",
      JSON.stringify(map)
    );

    if (this.bVerbose) {
      console.log(
        "browserify.map.json generated: '" +
          (this.name + "/browserify.map.json") +
          "'"
      );
    }
  }

  if (this.bVerbose) {
    console.log("Done unpacking " + fileCount + " files");
  }

  return {
    map: map,
    loaderContent: loaderContent
  };
};

BrowserifyUnpack.prototype.createUpdateEvent = function(
  eventFileEvent,
  externals
) {
  var browserifyVarName = "event___" +
    eventFileEvent.replace(/([\/|:\\|\\|\.|\-])/g, "_");

  var script = "if(module.exports.prototype !== undefined){\n" +
    "	if(module.exports.prototype.constructor !== undefined ){\n" +
    "		var Module = module.exports; \n" +
    "		var " +
    browserifyVarName +
    " =function(){\n" +
    "			this.liveEvent = '" +
    eventFileEvent +
    "';\n" +
    "			window.addEventListener(this.liveEvent,function(){\n" +
    "				if(this.onLiveChange !== undefined){\n" +
    "					this.onLiveChange().bind(this);\n" +
    "				}\n" +
    "			}.bind(this));\n";

  for (var i in externals) {
    var externalEvent = String(externals[i])
      .replace(this.sourceDir, "")
      .replace(this.rootDir, "");

    if (externalEvent.indexOf("node_modules") == -1) {
      script += "			window.addEventListener('" +
        externalEvent +
        "',function(){\n" +
        "				console.log('" +
        externalEvent +
        "'); \n" +
        "				if(this.onLiveExternalChange !== undefined){\n" +
        "					this.onLiveExternalChange().bind(this);\n" +
        "				}\n" +
        "			}.bind(this));\n";
    }
  }

  script += "			return Module.apply(this,arguments);\n" +
    "		};\n" +
    "		Object.assign(" +
    browserifyVarName +
    ", Module);\n" +
    "		" +
    browserifyVarName +
    ".prototype = Module.prototype;\n" +
    "		" +
    browserifyVarName +
    ".prototype.constructor = " +
    browserifyVarName +
    ";\n" +
    "		module.exports = " +
    browserifyVarName +
    ";\n" +
    "	}\n" +
    "}";

  return script;
};

// helper functions

/** Return the 'arguments' from an esprima parsed AST function call node, if the node type is not correct, return undefined */
function extractStandalone(args) {
  if (args[0].type !== "FunctionExpression") return;
  if (args[0].body.length < 2) return;
  if (args[0].body.body.length < 2) return;

  args = args[0].body.body[1].argument;
  if (args.type !== "CallExpression") return;
  if (args.callee.type !== "CallExpression") return;

  return args.callee.arguments;
}

/** Get an object's own property values */
function values(obj) {
  var res = [];
  for (var key in obj) {
    if (obj.hasOwnProperty.call(key)) res.push(obj[key]);
  }
  return res;
}

module.exports = BrowserifyUnpack;
