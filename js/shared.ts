import fs from 'fs';
import executor, { SmartContract } from "ton-contract-executor";
import ton, { Address, Cell, Slice, Builder, InternalMessage, CommonMessageInfo, toNano } from "ton";
import BN from "bn.js";



export function readString(filename: string): string {
	return fs.readFileSync(new URL(filename, import.meta.url), 'utf-8');
}

export const contractLoader = (filename: string) => {
	const sourceCode = readString(filename);
	return (dataCell: Cell) => SmartContract.fromFuncSource(sourceCode, dataCell);		
};




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


