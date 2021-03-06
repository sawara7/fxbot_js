const ccxt = require ('ccxt');
const env = require('../../_env');
const utils = require('../utils');

let ticker;
let bf = new ccxt.bitflyer ({
    apiKey: env.apiKey,
    secret: env.secret}
);

let trade_result = {
    "positive" : 0,
    "negative" :0,
    "failed":0
};
exports.trade_result = trade_result;

function changeSide(side) {
    if (side == 'BUY' || side == 'buy') {
        return 'SELL';
    } else if (side == 'SELL' || side == 'sell'){
        return 'BUY';
    };
};
exports.change_side =changeSide;

async function closeAllPosition() {
    let res;
    let size = 0;
    let side;
    while(true){
        res = await bf.private_get_getpositions({'product_code':'FX_BTC_JPY'});
        if (res.length === 0){
            return true;
        };
        for (let i in res) {
            if (res[i].size > 0){
                size += res[i].size;
                side = res[i].side;
            };
        };
        if (size !== Number && size < 0.01){
            return true;
        };
        let order = await bf.createOrder("FX_BTC_JPY", 'market', changeSide(side), size);
        await utils.sleep(1000);
    };
};
exports.closeAllPosition = closeAllPosition;

 async function cancelAllOrder() {
    let res;
    while(true){
        try {
            res = await bf.fetchOpenOrders('FX_BTC_JPY');
            if (res.length === 0) {
                return true;
            };
            for (let i in res) {
                await bf.cancelOrder(res[i].id, res[i].symbol);
            };
            await utils.sleep(1000);
        }catch(error){
            console.log(error);
            await utils.sleep(1000);
        };
    };
};
exports.cancelAllOrder = cancelAllOrder;

exports.fetchParentOrder = async (id) => {
    let res = await bf.private_get_getparentorders(
        {'product_code': 'FX_BTC_JPY'}
        );
    for (o of res){
        if (o.parent_order_acceptance_id === id){
            return o;
        };
    };
    return {};
};

exports.cancelParentOrder = async (id) => {
    return await bf.private_post_cancelparentorder(
        {
            'product_code': 'FX_BTC_JPY',
            'parent_order_acceptance_id': id
        }
    );
};

exports.closeParentOrder = async (id) => {
    return await bf.private_post_cancelparentorder(
        {
            'product_code': 'FX_BTC_JPY',
            'parent_order_acceptance_id': id
        }
    );
};

async function checkOrderStatus(id, symbol, status, timeout, interval, losscut){
    let time = 0;
    while (true) {
        try{
            time += interval;
            if (timeout !== 0 && time > timeout){
                return 'timeout';
            }
            let result = await bf.fetchOrder(id, symbol, {'product_code': 'FX_BTC_JPY'});
            if (result.status === status){
                console.log('order status is ' + status);
                return result;
            }
            if (losscut !== undefined){
                let ret = await losscut(result);
                if (ret === true){
                    return 'losscut';
                };
            };
            await utils.sleep(interval);
        }catch(error){
            console.log(error);
            await utils.sleep(interval);
        };
    };
};
exports.checkOrderStatus = checkOrderStatus;

async function checkOrderStatusByPosition(position, timeout, interval, losscut){
    let time = 0;
    while (true) {
        try{
            time += interval;
            if (timeout !== 0 && time > timeout){
                return 'timeout';
            }

            let buy_size = 0;
            let sell_size = 0;
            let price = 0;
            let res = await bf.private_get_getpositions({'product_code':'FX_BTC_JPY'});
            for (let i in res) {
                if (res[i].side === 'BUY'){
                    buy_size += res[i].size;
                }else if (res[i].side === 'SELL'){
                    sell_size += res[i].size;
                };
                price += res[i].price * res[i].size;
            };
            price = price / (buy_size+sell_size);

            let result = { 'size': { 'buy': buy_size, 'sell': sell_size } , 'price':price };
            if (position.buy === buy_size && position.sell === sell_size){
                return result;
            };

            if (losscut !== undefined){
                if (losscut(result) === true){
                    await cancelAllOrder();
                    await closeAllPosition();
                    return result;
                };
            };
            await utils.sleep(interval);
        }catch(error){
            console.log(error);
            await utils.sleep(interval);
        };
    };
};
exports.checkOrderStatusByPosition = checkOrderStatusByPosition;

exports.createLimitOrderPair = async function(price, amount, ask_offset, bid_offset) {
    bf.createOrder(
        'BTC/JPY','limit','buy',amount,price - bid_offset,{ "product_code" : "FX_BTC_JPY"}
    );
    bf.createOrder(
        'BTC/JPY','limit','sell',amount,price + ask_offset,{ "product_code" : "FX_BTC_JPY"}
    );
};

exports.createLimitOrderPairAwait = async function(price, offset, amount, side, losscut) {
    let od1 = await bf.createOrder(
        'BTC/JPY','limit', side, amount, price ,{ "product_code" : "FX_BTC_JPY"}
    );
    let status = await checkOrderStatus(od1.id, 'FX_BTC_JPY', 'closed', 1000 * 10, 500, undefined);
    if (status === 'timeout' || status === 'losscut'){
        await cancelAllOrder();
        await closeAllPosition();
        trade_result.failed ++;
        return
    };
    let close_price = 0;
    if (status.info.average_price > 100){
        if (side === 'sell'){
            close_price = status.info.average_price - offset;
        }else if (side === 'buy'){
            close_price = status.info.average_price + offset;
        };
    }else{
        if (side === 'sell'){
            close_price = status.info.price - offset;
        }else if (side === 'buy'){
            close_price = status.info.price + offset;
        };
    };
    let od2 = await bf.createOrder(
        'BTC/JPY','limit', changeSide(side), amount, close_price ,{ "product_code" : "FX_BTC_JPY"}
    );
    let status2 = await checkOrderStatus(od2.id, 'FX_BTC_JPY', 'closed', 0, 1000, losscut);
    if (status2 === 'timeout' || status2 === 'losscut'){
        trade_result.negative ++;
        await cancelAllOrder();
        await closeAllPosition();
        return;
    };
    if (side === 'sell'){
        console.log("======OK======", status.info.price - status2.info.price);
    }else{
        console.log("======OK======", status2.info.price - status.info.price);
    };
    trade_result.positive ++;
};

exports.createMarketLimitOrder = async function(offset, amount, side) {
    let od1 = await createMarketOrder2(amount, side);
    let status = await checkOrderStatus(od1.id, 'FX_BTC_JPY', 'closed', 1000 * 10, 500, undefined);
    if (status === 'timeout' || status === 'losscut'){
        await cancelAllOrder();
        await closeAllPosition();
        trade_result.failed ++;
        return
    };
    let close_price = 0;
    if (status.info.average_price > 100){
        if (side === 'sell'){
            close_price = status.info.average_price - offset;
        }else if (side === 'buy'){
            close_price = status.info.average_price + offset;
        };
    }else{
        if (side === 'sell'){
            close_price = status.info.price - offset;
        }else if (side === 'buy'){
            close_price = status.info.price + offset;
        };
    };
    let od2 = await bf.createOrder(
        'BTC/JPY','limit', changeSide(side), amount, close_price ,{ "product_code" : "FX_BTC_JPY"}
    );
    return od2;
};

exports.createLimitOrder = async function(amount, side, price){
    return await bf.createOrder(
        'BTC/JPY','limit',side,amount,price,{ "product_code" : "FX_BTC_JPY"}
    );
};

async function createMarketOrder2(amount, side){
    return await bf.createOrder(
        'BTC/JPY','market',side,amount,0,{ "product_code" : "FX_BTC_JPY"}
    );
};

exports.createMarketOrder2 = createMarketOrder2;

exports.getPositionBySide = async function(){
    let res;
    let buy_size = 0;
    let sell_size = 0;
    res = await bf.private_get_getpositions({'product_code':'FX_BTC_JPY'});
    for (let i in res) {
        if (res[i].side === 'BUY'){
            buy_size += res[i].size;
        }else if (res[i].side === 'SELL'){
            sell_size += res[i].size;
        };
    };
    return {'buy':buy_size, 'sell':sell_size};
};

exports.getCurrentOpenOrder = async function() {
    let ret = [];
    let orders = await bf.fetchOpenOrders('FX_BTC_JPY');
    for (let o in orders) {
        ret.push(orders[o]);
    };
    // for (let i in res){
    //     if (Date.now() - res[i].timestamp > 6000){
    //         if (ret === undefined){
    //             console.log('ok');
    //             ret = res[i];
    //             continue;
    //         };
    //         if (ret.timestamp < res[i].timestamp){
    //             console.log('ok');
    //             ret = res[i];
    //             continue;
    //         };
    //     };
    // }
    return ret;
};

exports.getOpenOrderLengthBySide = async function() {
    let res = await bf.fetchOpenOrders('FX_BTC_JPY');
    let ret = {'buy':0, 'sell':0};
    for (let i in res){
        if (res[i].side === 'buy'){
            ret.buy++;
        };
        if (res[i].side === 'sell'){
            ret.sell++;
        }; 
    }
    return ret;
};

exports.startTicker = async function(interval) {
    while(true){
        try{
            await utils.sleep(interval);
            ticker = await bf.fetch_ticker('BTC/JPY', {"product_code" : "FX_BTC_JPY" });
        } catch(error) {
            console.log(error);
        };
    };
};

exports.getTickerOneshot = async function(){
    return await bf.fetch_ticker('BTC/JPY', {"product_code" : "FX_BTC_JPY" });
};

let getTicker = function() {
    return ticker;
};

let sfd;
exports.startSFD = async function(interval) {
    while(true){
        try{
            await utils.sleep(interval);
            let ticker_fx = getTicker();
            let ticker = await bf.fetch_ticker('BTC/JPY', {"product_code" : "BTC_JPY" });
            sfd = Math.abs(ticker_fx.last - ticker.last)/ticker.last * 100;
            console.log(sfd);
        } catch(error) {
            console.log(error);
        };
    };
};

let getSFD = function() {
    return sfd;
};

exports.ticker = getTicker;
exports.sfd = getSFD;

async function createStopLimitOrder(side, price, diff1, diff2, size){
    return await bf.private_post_sendparentorder(
        {
        "order_method": "IFDOCO",
        "minute_to_expire": 1000,
        "time_in_force": "GTC",
        "parameters": [
        {
            "product_code": "FX_BTC_JPY",
            "condition_type": "LIMIT",
            "side": side,
            "price": price,
            // "trigger_price": price,
            "size": size
        }
        ,
        {
            "product_code": "FX_BTC_JPY",
            "condition_type": "LIMIT",
            "side": changeSide(side),
            "price": price + diff1,
            // "trigger_price": price + diff1,
            "size": size
        }
        ,
        {
            "product_code": "FX_BTC_JPY",
            "condition_type": "STOP",
            "side": changeSide(side),
            // "price": price + diff2,
            "trigger_price": price + diff2,
            "size": size
        }
    ]}
    );
};
exports.createStopLimitOrder = createStopLimitOrder;
