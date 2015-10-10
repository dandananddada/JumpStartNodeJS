'use strict';

var exchange = require('./exchange')
 ,	crypto = require('crypto')
 ,	db = require('./db')
 ,	http = require('http')
 , 	cookie = require('cookie')
 ,	express =require('express')
 ,	MemoryStore = express.session.MemoryStore		//内置存储机制
 ,	ObjectID = require('mongodb').ObjectID
 , 	priceFloor = 35
 ,	priceRange = 10
 ,	volFloor = 80
 ,	volRange = 40;

//用于存储Session信息
var sessionStore = new MemoryStore()
 ,	io
 ,	online = []
 ,	lastExchangeData = {};

 module.exports = {
 	getSessionStore: function(){
 		return sessionStore;
 	},
 	addStock: function(uid, stock, callback){

 		function doCallback(){
 			counter++;
 			if(counter==2)	{ callback(null, price); }
 		}

 		var counter = 0;
 		var price;
 		
 		module.exports.getStockPrices([stock], function(err, retrieved){
 			price = retrieved[0];
 			doCallback();
 		});
 		db.push('users', new ObjectID(uid), { portfolio: stock }, doCallback);
 	},

 	authenticate: function(username, password, callback){
 		db.findOne('users', { username: username }, function(err, user){
 			if(user&&(user.password === encryptPassword(password)))
 				callback(err, user._id);
 			else
 				callback(err, null);
 		});
 	},
 	createSocket: function(app){
 		io = require('socket.io').listen(app);
 		io.configure(function(){
 			io.set('authorization', function(handshakeData, callback){
 				if(handshakeData.headers.cookie){
 					handshakeData.cookie = cookie.parse(decodeURIComponent(handshakeData.headers.cookie));
 					handshakeData.sessionID = handshakeData.cookie['connect.sid'];
 					sessionStore.get(handshakeData.sessionID, function(err, session){
 						if(err||!session)	{	return callback(null, false);	}
 						else{
 							handshakeData.session = session;
 							console.log('sessino data', session);
 							return callback(null, true);
 						}		
 					});
 				}else{
 					return callback(null, false);
 				}
 			});
 			io.sockets.on('connection', function(socket){
 				socket.on('clientchat', function(data){
 					//服务端接收前端传递的数据data。
 					var message = socket.handshake.session.username + ': ' + data.message + '\n';
 					//将数据返回给当前客户端，并且广播给其他连接状态下的客户端。
 					socket.emit('chat', {	message: message	});
 					socket.broadcast.emit('chat', {	message: message	});
 				});
 				//内置断开链接事件，监听。
 				socket.on('disconnect', function(data){
 					var username = socket.handshake.session.username;
 					var index = online.indexOf(username);
 					online.splice(index, 1);						//从online数组中删除断开链接的用户
 					socket.broadcast.emit('disconnect', {	username: username	});
 				});
 				socket.on('updateAccount', function(data){
 					module.exports.updateEmail(socket.handshake.session._id, data.email, function(err, numUpdates){
 						socket.emit('updateSuccess', {});
 					});
 				});
				//监听joined事件
				socket.on('joined', function(data){
					online.push(socket.handshake.session.username);				//将建立socket链接的用户名追加到online数组
					var message = socket.handshake.session.username+ ": "+data.message+ "\n";
					//触发chat事件
					socket.emit('chat', { message: message, user: online });
					socket.broadcast.emit('chat', { message: message, username: socket.handshake.session.username });
					/*
					var message = "admin: "+socket.handshake.session.username+" has joined \n";
					socket.emit('chat', { message: message });					//向服务端发送信息
					socket.broadcast.emit('chat', { message: message });		//广播信息给所有连接的客户端
					*/
				});
				socket.on('requestData', function(data){
					socket.emit('initExchangeData', {	exchangeData: transformExchangeData(lastExchangeData)	});
				});
 			});
 		})
 	},
 
 	createUser: function(username, email, password, callback){
 		var user = { 	username: username, 
 						email: email,
 						password: encryptPassword(password)
 					}
 		db.insertOne('users', user, callback);
 	},
 	getUserById: function(id, callback){
 		db.findOne('users', {_id: new ObjectID(id)}, callback);
 	},
 	getUser: function(username, callback){
 		db.findOne('users', { username: username }, callback);
 	},
 	generateRandomOrder: function(exchangeData){
 		var order = {};
 		//随机生成一种订单类型
 		if(Math.random() > 0.5)		order.type = exchange.BUY;
 		else 						order.type = exchange.SELL;


 		var buyExists = exchangeData.buys && exchangeData.buys.prices.peek();
 		var sellExists = exchangeData.sells && exchangeData.sells.prices.peek();

 		var ran = Math.random();
 		if(!buyExists && !sellExists) {
 			order.price = Math.floor(ran * priceRange) + priceFloor;
 		}
 		//如果交易所存在库存信息，从库存中取出进行交易。
 		else if(buyExists && sellExists){
 			if(Math.random()>0.5)		order.price = exchangeData.buys.prices.peek();
 			else						order.price = exchangeData.sells.prices.peek();
 		}
 		else if(buyExists){
 			order.price = exchangeData.buys.prices.peek();
 		}
 		else{
 			order.price = exchangeData.sells.prices.peek();
 		}

 		var shift = Math.floor(Math.random()*priceRange/2);
 		if (Math.random() > 0.5)	order.price += shift;
 		else						order.price -= shift;
 		order.volume = Math.floor(Math.random() * volRange) + volFloor;
    	return order;
 	},
 	getStockPrices: function(stocks, callback){
 		var stockList = '';
 		stocks.forEach(function(stock){
 			stockList += stock + ',';
 		});

 		var options = {
 			host: 'download.finance.yahoo.com',
 			port: 80,
 			path: '/d/quotes.csv?s='+stockList+'&f=sl1c1d1&e=.csv'
 		};


 		http.get(options, function(res){
 			var data = '';
 			res.on('data', function(chunk){
 				data += chunk.toString();
 			}).on('error', function(err){
 				console.err('Error retrieving Yahoo stock prices');
 				throw err;
 			}).on('end', function(){
 				var tokens = data.split('\n');
 				var prices = [];
 				tokens.forEach(function(line){
 					var price = line.split(",")[1];
 					if(price)	prices.push(price);
 				});
 				callback(null, prices);
 			});
 		});
 	},
 	sendExchangeData: function(stock, exchangeData){
 		lastExchangeData[stock] = exchangeData;
 		var current = transformStockData(stock, exchangeData);
 		io.sockets.emit('exchangeData', current);
 	},
 	sendTrades: function(trades){
 		io.sockets.emit('trade', JSON.stringify(trades));
 	},
 	updateEmail: function(id, email, callback){
		db.updateById('users', new ObjectID(id), { email: email }, callback);
	},
 	ensureAuthenticated: function(req, res, next){
 		if(req.session._id)		return next();
 		res.redirect('/')
 	}
 	
 }

function encryptPassword(plainText){
 	return crypto.createHash('md5').update(plainText).digest('hex');
 }

function transformExchangeData(data){
	var transformed = [];
	for(var stock in data){
		var existingData = data[stock];
		var newData = transformStockData(stock, existingData);
		transformed.push(newData);
	}
	return transformed;
}
function transformStockData(stock, existingData){
 	var newData = {};
 	newData.st = stock;
 	if(existingData&&existingData.trades&&existingData.trades.length>0){
 		newData.tp = existingData.trades[0].price;
 		newData.tv = existingData.trades[0].volume;
 	}
 	var buyPrices = {}
 	 ,	askPrices = {};
 	if (existingData && existingData.buys) {
 		buyPrices = Object.keys(existingData.buys.volumes);
 		for (var i=buyPrices.length - 5; i<buyPrices.length; i++) {
 			var index = buyPrices.length - i;
 			newData['b' + index + 'p'] = buyPrices[i];
 			newData['b' + index + 'v'] = existingData
 			.buys.volumes[buyPrices[i]];
 		}
 	}
 	if (existingData && existingData.sells)   {
 		askPrices = Object.keys(existingData.sells.volumes);
 		for (var i=0; i<5; i++) {
 			var index = i + 1;
 			newData['a' + index + 'p'] = askPrices[i];
 			newData['a' + index + 'v'] = existingData
 			.sells.volumes[askPrices[i]];
 		}
 	}
 	for (var i = 1; i <= 5; i++) {
 		if (!newData['b' + i + 'p']) {
 			newData['b' + i + 'p'] = 0;
 			newData['b' + i + 'v'] = 0;
 		}
 		if (!newData['a' + i + 'p']) {
 			newData['a' + i + 'p'] = 0;
 			newData['a' + i + 'v'] = 0;
 		}
 		if (!newData['tv']) {
 			newData['tv'] = 0;
 		}
 		if (!newData['tp']) {
 			newData['tp'] = 0;
 		}
 	}
 	return newData;
}