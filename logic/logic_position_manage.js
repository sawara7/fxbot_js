'use strict';
const fxutil = require('../core/utils');
const bb = require('../core/bitbank/bitbank');

let doTrade = async function() {
    await bb.doTrade();
};

exports.doTrade = async () => {
    doTrade();
};
