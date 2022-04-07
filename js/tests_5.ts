import fs from 'fs';
import executor, { SmartContract } from "ton-contract-executor";
import ton, { Address, Cell, Slice, BitString, Builder, InternalMessage, CommonMessageInfo, CellMessage, toNano } from "ton";
import seedrandom from 'seedrandom';
import ed25519 from 'ed25519';
import BN from "bn.js";

import { contractLoader, assertEmpty, internalMessage, externalMessage, createRandomGenerator } from './shared.js';
import { builder, int, slice, cell, sint, suint } from './shared.js';
import { bits2number, bits2string, bits2int, zeros, ones, bufferEqual } from './shared.js';



function cellEmpty(c: Cell): boolean {
	return c.bits.length === 0 && c.refs.length === 0;
}
const sendMessageActionCode = int(0x0ec3c86d);


// ------------------------ Random init ------------------------

const rand = seedrandom('112');
const gen = createRandomGenerator(rand);


const startingContractTime = 1000;

const randomValidUntil = () => startingContractTime + gen.int(-10, 60 + 180);




// ------------------------ Crypto ------------------------

function generateKeyPair(): ed25519.CurveKeyPair {
	let seed = gen.bits(256).bits.buffer;
	seed = seed.slice(0, 32);
	// for some reason seed was 128 bytes with 96 trailing zero-bytes
	return ed25519.MakeKeypair(seed);
}

function sign(c: Cell, privateKey: Buffer) {
	return ed25519.Sign(c.hash(), privateKey);
}
function verify(c: Cell, signature: Buffer, publicKey: Buffer) {
	return ed25519.Verify(c.hash(), signature, publicKey);
}


const keyPairs = [
	generateKeyPair(),
	generateKeyPair(),
	generateKeyPair(),
];

const owner1 = keyPairs[0];
const owner2 = keyPairs[1];




// ------------------------ Contract Set-Up ------------------------


let contract = await contractLoader('./../func/5.fc')(cell());
let packDataRes = await contract.invokeGetMethod('pack_data', [
	{type: 'int', value: int(owner1.publicKey).toString(10)},
	{type: 'int', value: int(owner2.publicKey).toString(10)}
]);
if (packDataRes.type !== 'success') {
	throw new Error(`pack_data get call failed with exit_code=${packDataRes.exit_code}, logs: ${packDataRes.logs}`);
}
const initialDataCell = packDataRes.result[0] as Cell;
if (!initialDataCell) {
	throw new Error(`pack_data produced null Cell or some other type`);
}
contract.setDataCell(initialDataCell);







// ------------------------ Test functions ------------------------

const debug = false;
function logSuccess(s: string) {
	if (debug) {
		console.log(s);
	}
}

let totalGas = 0;
let totalSuccess = 0;
let totalDelayed = 0;
let totalOutcoming = 0;


type Request = {
	validUntil: number,
	mode: number,
	messageInFull: Cell,

	requestCell: Cell,
	hash: Buffer,

	confirmed1: boolean,
	confirmed2: boolean,
};


function createRequest(validUntil: number, mode: 0, bodyCell: Cell): Request {
	let messageToSend = new InternalMessage({
		to: Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t'),
		value: toNano(1),
		bounce: false,
		body: new CommonMessageInfo({
			body: new CellMessage(bodyCell)
		})
	})
	
	const messageInFull = new Cell()
	messageToSend.writeTo(messageInFull)
	
	
	const requestCell = cell(
		suint(validUntil, 32),
		suint(mode, 8)
	).withReference(messageInFull);
	
	return {
		validUntil,
		mode,
		messageInFull,
	
		requestCell,
		hash: requestCell.hash(),
	
		confirmed1: false,
		confirmed2: false,
	};
}

const requests: Request[] = [];
const usedHashes: Set<string> = new Set<string>();

function generateRequest(): Request {
	while (true) {
		const validUntil = randomValidUntil();
		const mode = 0;
	
		const bodyR = rand();
		const bodyLength =
			bodyR < 0.05 ? 0 :
			bodyR < 0.15 ? 1023 :
			gen.int(1, 1023);
		const bodyCell = gen.bits(bodyLength);

		const req = createRequest(validUntil, mode, bodyCell);
		const reqHashString = req.hash.toString('hex');

		if (usedHashes.has(reqHashString)) {
			continue; // Regenerate same requests
		}
		usedHashes.add(reqHashString);

		return req;
	}
}


let currentContractTime = startingContractTime;

async function testExternal(request: Request, publicKey: Buffer, signature: Buffer) {
	let msg = externalMessage(cell(
		publicKey,
		signature
	).withReference(request.requestCell));

	contract.setUnixTime(currentContractTime);
	let result = await contract.sendExternalMessage(msg);

	if (request.validUntil < currentContractTime) {
		if (result.type !== 'failed' || result.exit_code !== 75) {
			throw new Error(`Message shouldn't be accepted because valid_until is too old`);
		}
		logSuccess(`testExternal passed: valid_until < now() so the message got rejected`);
	}
	else if (request.validUntil > currentContractTime + 60) {
		if (result.type !== 'failed' || result.exit_code !== 78) {
			throw new Error(`Message valid_until is too long`);
		}
		//console.warn(request.validUntil, currentContractTime);
		logSuccess(`testExternal passed: valid_until + 60 > now() so the message got rejected`);
	}
	else if (
		!bufferEqual(publicKey, owner1.publicKey)
		&& !bufferEqual(publicKey, owner2.publicKey))
	{
		if (result.type !== 'failed' || result.exit_code == 0) {
			throw new Error(`This publicKey is not even correct -> contract should throw`);
		}
		logSuccess(`testExternal passed: publicKey is not correct and the contract thrown`);
	} else if (!verify(request.requestCell, signature, publicKey)) {
		if (result.type !== 'failed' || result.exit_code == 0) {
			throw new Error(`Signature doesn't correspond to the provided publicKey -> contract should throw`);
		}
		logSuccess(`testExternal passed: signature doesn't correspond to the public key and the contract thrown`);
	} else {
		const signed1 = bufferEqual(publicKey, owner1.publicKey);
		const signed2 = bufferEqual(publicKey, owner2.publicKey);

		if (!signed1 && !signed2) {
			throw new Error(`Something is wrong with tests: previous check should have ensured that publicKey is one of two keys`);
		}

		if ((request.confirmed1 && signed1) || (request.confirmed2 && signed2)) {
			if (result.type !== 'failed' || result.exit_code == 0) {
				throw new Error(`Duplicate signed request -> contract should throw`);
			}
			logSuccess(`testExternal passed: duplicate signed request ignored`);
		} else {
			if (result.type !== 'success' || result.exit_code !== 0) {
				throw new Error(
					`Message is ok and should have been accepted.
					exit_code=${result.exit_code},
					signed1: ${signed1}
					signed2: ${signed2}
					request=${JSON.stringify(request, null, 4)}
					logs=${result.logs}`);
			}
			request.confirmed1 ||= signed1;
			request.confirmed2 ||= signed2;

			const shouldSend = request.confirmed1 && request.confirmed2;

			if (!result.action_list_cell) throw new Error(`Weird: action_list_cell is typically present here`);

			if (!shouldSend) {
				if (!cellEmpty(result.action_list_cell)) {
					throw new Error(
						`No messages should be sent this time
						-> actions should be empty
						request: ${JSON.stringify(request, null, 4)}`);
				}
				totalGas += result.gas_consumed;
				totalDelayed += 1;
				totalSuccess += 1;
				logSuccess('testExternal passed: message accepted, nothing send');
			} else {
				const actionCell = result.action_list_cell;
				if (cellEmpty(actionCell)) {
					throw new Error(`Outbound message should have been send`);
				}
				if (actionCell.refs.length !== 2) {
					throw new Error(`actionCell.refs.length !== 2: weird`);
				}
				if (!cellEmpty(actionCell.refs[0])) {
					throw new Error(`First actionCell ref (previous element) should be empty`);
				}
				const actionSlice = actionCell.beginParse();
				const actionCode = actionSlice.readUint(32);
				if (!sendMessageActionCode.eq(actionCode)) {
					throw new Error(`Unexpected action code, expected (${sendMessageActionCode}) got (${actionCode})`);
				}
				const messageMode = actionSlice.readUint(8);
				if (!messageMode.eq(int(request.mode))) {
					throw new Error(`Wrong message sending mode, expected (${request.mode}), found (${messageMode})`)
				}
				const outboundMessage = actionCell.refs[1];
				if (request.messageInFull.toString() !== outboundMessage.toString()) {
					throw new Error(
						`Message sent is not the one expected!
						Expected: ${request.messageInFull.toString()}
						Got: ${outboundMessage.toString()}`
					);
				}

				totalGas += result.gas_consumed;
				totalOutcoming += 1;
				totalSuccess += 1;
				logSuccess('testExternal passed: ok, message sent!');
			}
		}
	}
}




// ------------------------ Preparation ------------------------


for (let i = 0; i < 250; i++) {
	requests.push(generateRequest());
}





// ------------------------ Tests ------------------------

const testsCount = 10000;
const targetEndTime = 1200;
const timeStepProbability = (targetEndTime - startingContractTime) / testsCount;



const reportProgressEach = 100;

for (let i = 0; i < testsCount; i++) {
	if (i % reportProgressEach == 0) {
		console.log(`Progress: ${i}/${testsCount} tests passed`);
	}

	if (rand() < timeStepProbability) {
		currentContractTime++;
	}

	const req = gen.choice(requests);

	const sender = gen.choice(keyPairs);
	const signature = sign(req.requestCell, sender.privateKey);

	const publicKeyParam = gen.choice(keyPairs).publicKey;

	await testExternal(req, publicKeyParam, signature);
}


// !!!! Check now() time



// !! Cases to check - done(?)
// PublicKey_3 wrong wrong
// PublicKey_3 correct wrong
// PublicKey_3 wrong correct

// PublicKey_1 wrong wrong
// PublicKey_1 correct wrong -> Success
// PublicKey_1 wrong correct

// PublicKey_2 wrong wrong
// PublicKey_2 correct wrong
// PublicKey_2 wrong correct - Success

console.log();
console.log('-'.repeat(30));
console.log(`Final now(): ${currentContractTime}`);
console.log(`Passed all ${testsCount} tests!`);
console.log(`${totalSuccess} transactions accepted`);
console.log(`${totalDelayed} postponed and ${totalOutcoming} eventually sent`);
console.log(`${totalGas} total gas spent`);
console.log(`${(totalGas / totalSuccess).toFixed(3)} gas per transaction`);
