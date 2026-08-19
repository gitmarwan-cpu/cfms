const bcrypt = require('bcryptjs') as {
  hash(value: string, rounds: number): Promise<string>;
  compare(value: string, hash: string): Promise<boolean>;
};
const crypto = require('crypto') as { randomInt(min: number, max: number): number };

export const generatePin = (): string => crypto.randomInt(100000, 999999).toString();

export const hashPin = async (pin: string): Promise<string> => bcrypt.hash(pin, 10);

export const verifyPin = async (pin: string, hash: string): Promise<boolean> => bcrypt.compare(pin, hash || '');

module.exports = { generatePin, hashPin, verifyPin };
