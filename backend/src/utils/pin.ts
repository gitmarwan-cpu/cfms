import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const generatePin = (): string => crypto.randomInt(100000, 999999).toString();

export const hashPin = async (pin: string): Promise<string> => bcrypt.hash(pin, 10);

export const verifyPin = async (pin: string, hash: string): Promise<boolean> => bcrypt.compare(pin, hash || '');
