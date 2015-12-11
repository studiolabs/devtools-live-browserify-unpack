#!/usr/bin/env node

var yargs = require('yargs')
		.usage('Usage: $0 -f <file> [options]')
    .example('$0 -f foo.js', 'Cut a browserify bundle in multiple files')
		.option('o', {
			alias: 'output',
			describe: 'Path to save the output ( map.json + files )'
		})
		.option('f', {
			alias: 'file',
			demand: true,
			describe: 'File to unpack'
		})
		.option('n', {
			alias: 'name',
			describe: 'Output directory name'
		})
		.option('d', {
			alias: 'directory',
			describe: 'Source files directory'
		})
		.option('s', {
			alias: 'sourcemap',
			default: false,
			describe: 'Add sourcemap to output files',
			type: 'bool'
		})
		.option('m', {
			alias: 'map',
			default: false,
			describe: 'Generate a map of the generated files',
			type: 'bool'
		})
		.option('v', {
			alias: 'verbose',
			default: false,
			describe: 'Show logs',
			type: 'bool'
		})
		.version(function() {
			return require('../package').version;
		})
		.help('h')
		.alias('h', 'help')
    .epilog('copyright 2015');

var argv = yargs.argv;

var path = require('path');
try {

	var fs = require('fs');
	var path = require('path');
	var BrowserifyUnpack = require('../browserify-unpack.js');


	var Package = new BrowserifyUnpack(argv);

	Package.unpack();


} catch (e) {

	if (e.code === 'ENOENT') {
		console.error('Error: no such file or directory "' + e.path + '"');
	}
	else {
		console.log('Error: ' + e.message);
	}

	process.exit(1);
}
