import fs from 'fs';
import executor, { SmartContract } from "ton-contract-executor";
import ton, { Address, Cell, Slice, InternalMessage, CommonMessageInfo, toNano } from "ton";
import BN from "bn.js";

import { contractLoader } from './shared.js';




let expectedValue = new BN(0);

let initialData = new Cell();
initialData.bits.writeUint(expectedValue, 64);



let contract = await contractLoader('./../func/1.fc')(initialData);


async function testAdd(value: number) {
	let bodyCell = new Cell();
	bodyCell.bits.writeUint(value, 32);
	
	let msg = new InternalMessage({
		to: Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t'),
		value: toNano(0),
		bounce: false,
		body: new CommonMessageInfo({
			body: new ton.CellMessage(bodyCell),
		}),
	});
	
	let result = await contract.sendInternalMessage(msg);
	if (result.type !== 'success' || result.exit_code > 0) {
		throw new Error(`exit_code = ${result.exit_code}`);
	}
	
	const { exit_code, gas_consumed, action_list_cell } = result;

	expectedValue = expectedValue.add(new BN(value));

	let sl = Slice.fromCell(contract.dataCell);
	let newNum = sl.readUint(64);
	
	if (!expectedValue.eq(newNum)) {
		throw new Error(`Incorrect value, expected: ${expectedValue.toString(10)}, found: ${newNum.toString(10)}`);
	}
	console.log(`testAdd(${value}) passed, value = ${newNum.toString(10)}, gas = ${gas_consumed}`);
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
await testAdd(103);
await testAdd(4009);
await testGet();
await testAdd(50003);
await testAdd(600600);
await testGet();
await testAdd(7000004);
await testAdd(80000003);
await testAdd(900000002);
await testGet();
