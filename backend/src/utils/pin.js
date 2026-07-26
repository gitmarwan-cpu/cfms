'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * يولّد PIN رقمي من 6 خانات (سهل الإملاء هاتفياً للمستفيد)، ويُعاد نصاً
 * صريحاً مرة واحدة فقط في استجابة الإنشاء - لا يُخزَّن أبداً كما هو.
 */
const generatePin = () => crypto.randomInt(100000, 999999).toString();

const hashPin = async (pin) => bcrypt.hash(pin, 10);

const verifyPin = async (pin, hash) => bcrypt.compare(pin, hash || '');

module.exports = { generatePin, hashPin, verifyPin };
