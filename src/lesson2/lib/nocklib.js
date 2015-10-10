'use strict';

var exchange = require('./exchange')
 , 	priceFloor = 35
 ,	priceRange = 10
 ,	volFloor = 80
 ,	volRange = 40;

 module.exports = {
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
 	}
 }