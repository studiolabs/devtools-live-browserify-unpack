#!/usr/bin/env node

var yargs = require('yargs')
		.usage('Usage: $0 -f <file> [options]')
    .example('$0 -f foo.js', 'Cut a browserify bundle in multiple files')
		.option('d', {
			alias: 'destination',
			default: process.cwd(),
			describe: 'Path to save the output ( map.json + files)'
		})
		.option('f', {
			alias: 'file',
			demand: true,
			describe: 'File to unpack'
		})
		.option('n', {
			alias: 'name',
			default : 'dev',
			describe: 'Output directory name'
		})
		.option('v', {
			alias: 'verbose',
			default: false,
			describe: 'Debug',
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

	var file = path.resolve(argv.file);
	var destination = path.resolve(argv.destination);
	var name = argv.name;

	var Package = new BrowserifyUnpack({
		src: file,
		name : name,
		verbose: argv.verbose
	});

	var map = Package.unpackTo({ dest: destination });

	fs.writeFileSync(path.resolve(destination) + '/'+name+'/map.json', JSON.stringify(map));

	if (argv.verbose) {
		console.log('map saved ( '+ path.resolve(destination) + '/'+name+'/map.json )');
	}

} catch (e) {

	if (e.code === 'ENOENT') {
		console.error('Error: no such file or directory "' + e.path + '"');
	}
	else {
		console.log('Error: ' + e.message);
	}

	process.exit(1);
}
