'use strict';
const fxutil = require('../core/utils');
const bb = require('../core/bitbank/bitbank');

exports.doTrade = async () => {
    let interval = 1000;
    // bb.StartLimitOrder('btc_jpy', 0.001, interval, 'buy');
    // bb.StartLimitOrder('btc_jpy', 0.001, interval, 'sell');
    // await fxutil.sleep(1000);
    bb.StartLimitOrder('mona_jpy', 1, interval, 'buy');
    bb.StartLimitOrder('mona_jpy', 1, interval, 'sell');
    // await fxutil.sleep(1000);
    // bb.StartLimitOrder('xrp_jpy', 1, interval, 'buy');
    // bb.StartLimitOrder('xrp_jpy', 1, interval, 'sell');
    // await fxutil.sleep(1000);
    // bb.StartLimitOrder('bcc_jpy', 0.01, interval, 'buy');
    // bb.StartLimitOrder('bcc_jpy', 0.01, interval, 'sell');
    // await fxutil.sleep(1000);
    // bb.StartLimitOrder('ltc_btc', 0.1, interval, 'buy');
    // bb.StartLimitOrder('ltc_btc', 0.1, interval, 'sell');
    // await fxutil.sleep(1000);
    // bb.StartLimitOrder('eth_btc', 0.1, interval, 'buy');
    // bb.StartLimitOrder('eth_btc', 0.1, interval, 'sell');
    // await fxutil.sleep(1000);
    // bb.StartLimitOrder('mona_btc', 1, interval, 'buy');
    // bb.StartLimitOrder('mona_btc', 25, interval, 'sell');
    // await fxutil.sleep(1000);
    // bb.StartLimitOrder('bcc_btc', 0.01, interval, 'buy');
    // bb.StartLimitOrder('bcc_btc', 0.1, interval, 'sell');
};
