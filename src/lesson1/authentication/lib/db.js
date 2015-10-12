var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports.mongoose = mongoose;
module.exports.Schema = Schema;

//connect to cloud database
var username = "dicer";
var password = "dicer";
var address = "@ds051953.mongolab.com:51953/jump_start_node";
connect();

function connect(){
	// mongodb://dicer:dicer@ds051953.mongolab.com:51953/jump_start_node
	var url = 'mongodb://' + username + ':' + password + address;
	mongoose.connect(url);
}

function disconnect(){
	mongoose.disconnect();
}