var sourceMap = require('source-map');
var convertSourceMap = require('convert-source-map');

var SourceMapConsumer = sourceMap.SourceMapConsumer;

function SourceMapExtractor(src){
	this.sourcemap = {};
	this.files = [];
	this.src = src;

}

SourceMapExtractor.prototype.extract = function() {

	this.sourcemap = convertSourceMap.fromSource(this.src,true).toObject();

	var consumer = new sourceMap.SourceMapConsumer(this.sourcemap);

	consumer.eachMapping(function (m) {
		if(this.files[m.source] == undefined){
			this.files[m.source] = {
				mappings :[]
			};
		}
		this.files[m.source].mappings.push(m);
	}.bind(this),{},consumer.GENERATED_ORDER);

	var src  = this.src.split('\n');

	for( var i in this.files ){
		var start = this.files[i].mappings[0];
		var end = this.files[i].mappings.slice(-1)[0];

		this.files[i].generated = src.slice(start.generatedLine, end.generatedLine).join('\n');

		this.files[i].start = start;
		this.files[i].end = end;

		//console.log(this.files[i].generated);
		//console.log(file.generated);
	};




	return this.files;
};


module.exports =  SourceMapExtractor;
