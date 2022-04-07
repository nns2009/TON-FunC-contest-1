import fs from 'fs';
import executor, { SmartContract } from "ton-contract-executor";
import ton, { Address, Cell, Slice, BitString, Builder, InternalMessage, CommonMessageInfo, toNano } from "ton";
import BN from "bn.js";

import { contractLoader, assertEmpty, builder, int, slice, cell, sint, suint, internalMessage } from './shared.js';





let expectedValue = int(0);

let initialData = cell(suint(expectedValue, 64));
let contract = await contractLoader('./../func/1.fc')(initialData);


async function testAdd(value: number) {
	let msg = internalMessage(suint(value, 32));
	
	let result = await contract.sendInternalMessage(msg);
	if (result.type !== 'success' || result.exit_code > 0) {
		throw new Error(`exit_code = ${result.exit_code}`);
	}
	
	const { gas_consumed } = result;

	expectedValue = expectedValue.add(int(value));

	let sl = contract.dataCell.beginParse();
	let storedNum = sl.readUint(64);
	assertEmpty(sl);
	
	if (!expectedValue.eq(storedNum)) {
		throw new Error(`Incorrect value, expected: ${expectedValue.toString(10)}, found: ${storedNum.toString(10)}`);
	}
	console.log(`testAdd(${value}) passed, value = ${storedNum.toString(10)}, gas = ${gas_consumed}`);
}

async function testShort(value: number, len: number) {
	if (len >= 32) throw new Error(`Incorrect testShort params: len = ${len}`);
	let msg = internalMessage(suint(value, len));
	
	let result = await contract.sendInternalMessage(msg);
	if (result.type !== 'failed')
		throw new Error(`Contract should have thrown an exception with message of length ${len}`);

	let sl = contract.dataCell.beginParse();
	let storedNum = sl.readUint(64);
	assertEmpty(sl);

	if (!expectedValue.eq(storedNum))
		throw new Error(`Contract data should not have changed, expected: ${expectedValue.toString(10)}, found: ${storedNum.toString(10)}`);
	
	console.log(`testShort(${value}, ${len}) passed, value = ${storedNum.toString()}`);
}

async function testGet() {
	let exres = await contract.invokeGetMethod('get_total', []);
	if (exres.type !== 'success' || exres.exit_code > 0) {
		throw new Error(`exit_code = ${exres.exit_code}`);
	}

	const { result } = exres;

	let res = result[0] as BN;
	if (!expectedValue.eq(res)) {
		throw new Error(`Incorrect value, expected: ${expectedValue.toString(10)}, found: ${res.toString(10)}`);
	}
	console.log(`testGet() passed, value = ${res.toString(10)}`);
}


await testGet();
await testAdd(7);
await testAdd(20);
await testShort(40, 31);
await testAdd(103);
await testAdd(4009);
await testGet();
await testAdd(50003);
await testAdd(600600);
await testGet();
await testAdd(7000004);
await testAdd(80000003);
await testShort(20, 7);
await testAdd(900000002);
await testGet();
await testShort(0, 1);


