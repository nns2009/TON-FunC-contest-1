import fs from 'fs';
import executor, { SmartContract } from "ton-contract-executor";
import ton, { Address, Cell, Slice, Builder, InternalMessage, CommonMessageInfo, toNano } from "ton";
import seedrandom from 'seedrandom';
import BN from "bn.js";




// ------------------------ String functions ------------------------

export function readString(filename: string): string {
	return fs.readFileSync(new URL(filename, import.meta.url), 'utf-8');
}


export function reverseString(str:string): string {
    return str.split("").reverse().join("");
}




// ------------------------ Contract functions ------------------------

export const contractLoader = (filename: string) => {
	const sourceCode = readString(filename);
	return (dataCell: Cell) => SmartContract.fromFuncSource(sourceCode, dataCell);		
};




// ------------------------ Random generators ------------------------

export const createRandomGenerator = (rand: seedrandom.PRNG) => {
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




// ------------------------ Bit generation ------------------------

export function xbits(x: number, bitLength: number): Cell {
	if (x !== 0 && x !== 1)
		throw new Error(`xbits: incorrect x=(${x})`);

	const c = new Cell();
	for (let i = 0; i < bitLength; i++) {
		c.bits.writeBit(x);
	}
	return c;
}
export const zeros = (bitLength: number) => xbits(0, bitLength);
export const ones = (bitLength: number) => xbits(1, bitLength);




// ------------------------ Bit manipulations ------------------------

export const bits2number = (c: Cell) => parseInt(c.bits.toString(), 2);
export const bits2int = (c: Cell) => int(c.bits.toString(), 2);
export const bits2string = (c: Cell) => bits2int(c).toString('hex');




// ------------------------ Cell manipulations ------------------------

export const builder = () => new Builder();
export const int = (value: number | string, base?: number) => new BN(value, base);
export const slice = (cell: Cell) => Slice.fromCell(cell);

export const sint = (value: number | BN, bitLength: number) => builder().storeInt(value, bitLength).endCell();
export const suint = (value: number | BN, bitLength: number) => builder().storeUint(value, bitLength).endCell();


export const cell = (...content: Cell[]) => {
	// const b = builder();
	const c = new Cell();

	for (let v of content) {
		c.writeCell(v);
	}

	return c;
};

export const internalMessage = (body: Cell) => new InternalMessage({
	to: Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t'),
	value: toNano(0),
	bounce: false,
	body: new CommonMessageInfo({
		body: new ton.CellMessage(body),
	}),
});




// ------------------------ Assertions ------------------------

export function assertEmpty(value: Slice) {
	if (value.remaining != 0) {
		throw new Error(`remaining bits: ${value.remaining}, value: ${value}`);
	}
	if (value.remainingRefs != 0) {
		throw new Error(`remaining refs: ${value.remainingRefs}, value: ${value}`);
	}
}
export function assertExitSuccess(result: executor.ExecutionResult) {
	if (result.type != 'success' || result.exit_code > 0) {
		throw new Error(`exit_code = ${result.exit_code}`);
	}
}


