'use strict'

var $ = require('jquery')
, BinaryHeap = require('./BinaryHeap');

var BUY = "buys", SELL = "sells";

function createBinaryHeap(orderType){
	// 根据交易类型创建一个二叉堆，用来存储库存。
	return new BinaryHeap(function(x){	return x;	}, orderType);
} 

// 获取交易所库存信息
function createExchange(exchangeData){
	var cloned = $.extend(true, {}, exchangeData);
	cloned.trades = [];					//交易记录
	init(cloned, BUY);					//购入需求记录
	init(cloned, SELL);					//售出需求记录
	return cloned;
	function init(exchange, orderType){
		if(!exchange[orderType]){
			exchange[orderType] = {};
			exchange[orderType].volumes = {};
			var options = {};
			//购入需求记录与售出需求记录存储数据方式不同，购入需求取负值存储，可以保证存入的原数据按照降序获取。
			if(BUY == orderType)	options.max = true;		
			//初始化交易所售出股和收购股价格表（二叉堆记录）
			exchange[orderType].prices = createBinaryHeap(options)
		}
	}
}

module.exports = {
	BUY: BUY,
	SELL: SELL,
	buy: function(price, volume, exchangeData){
		return order(BUY, price, volume, exchangeData);
	},
	sell: function(price, volume, exchangeData){
		return order(SELL, price, volume, exchangeData);
	},
	order: order,
	getDisplay: function(exchangeData){

		//初始化交易所库存
		var options = { max: true }
		,	buyPrices = createBinaryHeap(options)
		,	sellPrices = createBinaryHeap(options)
		,	buys = exchangeData.buys
		,	sells = exchangeData.sells;

		if(sells){
			for(var price in sells.volumes){
				sellPrices.push(price);
			}
		}
		if(buys){
			for(var price in buys.volumes){
				buyPrices.push(price);
			}
		}

		var padding = "        | ";
		var stringBook = "\n";

		while (sellPrices.size() > 0) {
			var sellPrice = sellPrices.pop()
			stringBook += padding + sellPrice + ", " + sells.volumes[sellPrice] + "\n";
		}
		while (buyPrices.size() > 0) {
			var buyPrice = buyPrices.pop();
			stringBook += buyPrice + ", " + buys.volumes[buyPrice] + "\n";
		}

		stringBook += "\n\n";
		for (var i=0; exchangeData.trades && i < exchangeData.trades.length; i++) {
			var trade = exchangeData.trades[i];
			stringBook += "TRADE " + trade.volume + " @ " + trade.price + "\n";
		}
		return stringBook;
	}
}

function order(orderType, price, volume, exchangeData){
	//初始化cloned对象，用来存储交易所出售和购入股票数据。
	var cloned = createExchange(exchangeData);
	var orderBook = cloned[orderType];
	//库中同需求的股，如果没有则为0。
	var oldVolume = orderBook.volumes[price];

	function getOpposite(){
		return (BUY == orderType) ? SELL : BUY;
	}

	function isTrade(){
		//取出堆中最顶层的价钱，如果是买入取出最大price反之最小。
		var opp = cloned[getOpposite()].prices.peek();
		//判断买入价钱是否大于当前最大值，卖出价钱是否小于当前最小值
		return (BUY == orderType) ? price >= opp : price <= opp;
	}

	//判断是否可以交易，交易的前提是购入价最大值要大于售出价最小值。
	var trade = isTrade();
	//需要交易的股数
	var remainingVolume = volume;
	var storePrice = true;

	//1.满足交易条件
	if (trade) {
		//获取股票库存oppBook
		var oppBook = cloned[BUY];
		if (orderType == BUY)	oppBook = cloned[SELL];
		//判断需要交易并且可以交易
		while(remainingVolume>0 && Object.keys(oppBook.volumes).length>0){
			//取出库存中最优股
			//如果是购入交易则取售出库中加个最低的股，如果是出售交易则选择购入库存中加个最高的股
			var bestOppPrice = oppBook.prices.peek();
			//获取最优股数
			var bestOppVol = oppBook.volumes[bestOppPrice];

			//1.1.最优股数大于交易股数
			if(bestOppVol>remainingVolume){
				//插入交易记录
				cloned.trades.push({ price: bestOppPrice, volume: remainingVolume });
				//更新最优股数库存，减去交易股数为剩余股数。
				oppBook.volumes[bestOppPrice] -= remainingVolume;
				remainingVolume = 0;		//所需交易股数清零
				storePrice = false;			//设置交易状态为结束
			}else{
			//1.2.最优股数等于交易股数，设置交易状态为结束，并执行后续操作。
				if(bestOppVol == remainingVolume)	storePrice = false;
			//1.3.最优股数小于交易股数
				cloned.trades.push({ price: bestOppPrice, volume: oppBook.volumes[bestOppPrice] });		//插入交易记录
				remainingVolume -= oppBook.volumes[bestOppPrice];							//更新交易股数
				oppBook.prices.pop();														//从库存中补充最优股
				delete oppBook.volumes[bestOppPrice];										//清空交易出的最优股
			}
		}	//交易未结束重复操作，只有满足1，2状态交易才会结束。
			//注意2，3状态最优股都交易出去，所以需要从库存更新最优股。
	}
	//2.不满足交易条件，将需求股追加到库存。
	//2.1.在库中没有同需求的股，直接追加到库。
	if(!oldVolume && storePrice)	cloned[orderType].prices.push(price);
	//2.2. 库中存在同需求的股，追加入库。
	var newVolume = remainingVolume;														//需要交易股数
	if (oldVolume)		newVolume += oldVolume;												//更新同需求股
	if (newVolume>0)	orderBook.volumes[price] = newVolume;								//需求股追加入库
	return cloned;																			//返回交易所库存信息
}






