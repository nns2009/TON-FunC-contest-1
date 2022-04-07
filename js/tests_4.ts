import fs from 'fs';
import executor, { SmartContract } from "ton-contract-executor";
import ton, { Address, Cell, Slice, BitString, Builder, InternalMessage, CommonMessageInfo, toNano } from "ton";
import seedrandom from 'seedrandom';
import BN from "bn.js";

import { contractLoader, assertEmpty, builder, int, slice, cell, sint, suint, internalMessage } from './shared.js';


function reverseString(str:string): string {
    return str.split("").reverse().join("");
}


const rand = seedrandom('111');

const createRandomGenerator = (rand: seedrandom.PRNG) => {
	function randomRange(min: number, max:number): number {
		return rand() * (max - min) + min;
	}

	function randomInt(min: number, max:number): number {
		return Math.floor(rand() * (max - min)) + min;
	}

	function randomChoice<T>(array: T[]): T {
		return array[randomInt(0, array.length)];
	}

	function randomBits(bitLength: number): Cell {
		const c = new Cell();
		for (let i = 0; i < bitLength; i++) {
			c.bits.writeBit(rand.int32() & 1);
		}
		return c;
	}

	return {
		range: randomRange,
		int: randomInt,
		choice: randomChoice,
		bits: randomBits,
	};
};



const gen = createRandomGenerator(rand);

function xbits(x: number, bitLength: number): Cell {
	if (x !== 0 && x !== 1)
		throw new Error(`xbits: incorrect x=(${x})`);

	const c = new Cell();
	for (let i = 0; i < bitLength; i++) {
		c.bits.writeBit(x);
	}
	return c;
}
const zeros = (bitLength: number) => xbits(0, bitLength);
const ones = (bitLength: number) => xbits(1, bitLength);


const bits2number = (c: Cell) => parseInt(c.bits.toString(), 2);
const bits2int = (c: Cell) => int(c.bits.toString(), 2);
const bits2string = (c: Cell) => bits2int(c).toString('hex');




const randomValidUntil = () => bits2number(gen.bits(4)); // 4 significant digits for valid until


let initialData = cell();
let contract = await contractLoader('./../func/4.fc')(initialData);



// ------------------------ Test functions ------------------------

const debug = false;
function logSuccess(s: string) {
	if (debug) {
		console.log(s);
	}
}

let totalGas = 0;
let totalSets = 0;
let totalRemoves = 0;
let totalTransactions = 0;
let totalExceptions = 0;

let db: {
	[key: string]: {
		validUntil: BN,
		value: Cell,
	}
} = {};


async function testSet(key: Cell, validUntil:number, value: Cell) {
	let msg = internalMessage(cell(
		suint(1, 32),
		gen.bits(64),
		key,
		suint(validUntil, 64),
		value
	));
	
	let result;
	try {
		result = await contract.sendInternalMessage(msg);
	} catch (ex) {
		console.log('key', key);
		console.log('validUntil', validUntil);
		console.log('value', value);
		console.log(ex);
		totalExceptions += 1;
		return;
	}

	if (result.type !== 'success' || result.exit_code !== 0) {
		throw new Error(`exit_code = ${result.exit_code}`);
	}
	const { gas_consumed } = result;

	const keyString = bits2string(key);
	db[keyString] = {
		validUntil: int(validUntil),
		value,
	};

	totalGas += gas_consumed;
	totalSets += 1;
	totalTransactions += 1;
	logSuccess(`testSet (${keyString.substring(0, 12)}) passed, gas = ${gas_consumed}`);
}


async function testRemoveOutdated(now: number) {
	let msg = internalMessage(cell(
		suint(2, 32),
		gen.bits(64)
	));

	contract.setUnixTime(now);
	let result = await contract.sendInternalMessage(msg);
	if (result.type !== 'success' || result.exit_code !== 0) {
		throw new Error(`remove outdated (op=2) message caused crash, but it shouldn't have`);
	}
	const { gas_consumed } = result;

	db = Object.fromEntries(
		Object.entries(db).filter(
			([key, { validUntil, value }]) =>
				!validUntil.lt(int(now))
		)
	)
	totalGas += gas_consumed;
	totalRemoves += 1;
	totalTransactions += 1;
	logSuccess(`testRemoveOutdated(${now}) passed, gas = ${gas_consumed}`);
}


async function testWrongOP() {
	let msg = internalMessage(cell(
		suint(3, 32),
		gen.bits(64),
		zeros(256 + 64 + 100) // key + valid until + value
	));

	let result = await contract.sendInternalMessage(msg);
	if (result.type !== 'failed' || result.exit_code != 12) {
		throw new Error(`Contract should have thrown with op=3, but it didn't`);
	}
	logSuccess(`testWrongOP passed, contract thrown with op=3, as it should`);
}


async function testTooShort() {
	let msg = internalMessage(cell(
		suint(2, 32),
		gen.bits(63)
	));

	let result = await contract.sendInternalMessage(msg);
	if (result.type !== 'failed' || result.exit_code == 0) {
		throw new Error(`Contract should have thrown with such a short message, but it didn't`);
	}
	logSuccess(`testTooShort passed, contract thrown with a short message, as it should`);
}


async function testGet(key: Cell) {
	const intKey = bits2int(key);
	
	let exres = await contract.invokeGetMethod(
		'get_key',
		[{type: 'int', value: intKey.toString(10)}]
	);
	
	const keyString = bits2string(key);
	const item = db[keyString];

	if (item) {
		if (exres.type !== 'success' || exres.exit_code > 0) {
			throw new Error(`Key (${keyString.substring(0, 12)}) is PRESENT in the database (valid until = ${item.validUntil}), but 'get_key' failed`);
		}
		const [foundValidUntil, foundValue] = exres.result as [BN, Slice];
		if (!item.validUntil.eq(foundValidUntil)) {
			throw new Error(`Valid until in the database differs from the returned value`);
		}
		if (!item.value.equals(foundValue.toCell())) {
			throw new Error(`Value in the database differs from the returned value`);
		}
	} else {
		if (exres.type !== 'failed' || exres.exit_code !== 98) {
			throw new Error(`Key (${key}) is ABSENT from the database, but 'get_key' didn't fail`);
		}
		logSuccess(`testGet passed: key is absent and 'get_key' crashed`);
	}
}



const key_len = 256;
const keys = [
	zeros(key_len),
	ones(key_len),
];
for (let i = 0; i < 50; i++) {
	keys.push(gen.bits(key_len));
}

const maxValueLength = 1023
	- 32 // op
	- 64 // query_id
	- key_len
	- 64; // valid_until






// ------------------------ Tests functions ------------------------

await testTooShort();
await testWrongOP();

const testsCount = 10000;
const reportProgressEach = 100;

for (let i = 0; i < testsCount; i++) {
	if (i % reportProgressEach == 0) {
		console.log(`Progress: ${i}/${testsCount} tests passed`);
	}

	const r = rand();
	
	if (r < 0.001) {
		const validUntil = randomValidUntil();
		await testRemoveOutdated(validUntil);
	} else if (r < 0.2) {
		const key = gen.choice(keys);
		
		const r2 = rand();
		const bitLength = r2 < 0.3 ? maxValueLength : gen.int(0, maxValueLength);
		const value = gen.bits(bitLength);
		
		const validUntil = randomValidUntil();
		
		await testSet(key, validUntil, value);
	} else {
		const key = gen.choice(keys);
		await testGet(key);
	}
}

await testWrongOP();
await testTooShort();


console.log();
console.log('-'.repeat(30));
console.log(`Passed all ${testsCount} tests!`);
console.log(`${totalTransactions} transactions occured`);
console.log(`${totalSets} set transactions and ${totalRemoves} remove transactions`);
console.log(`${totalGas} total gas spent`);
console.log(`${(totalGas / totalTransactions).toFixed(3)} gas per transaction`);
console.log();
console.log(`${totalExceptions} total unexpected exceptions`);
