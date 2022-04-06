import fs from 'fs';
import executor, { SmartContract } from "ton-contract-executor";
import ton, { Address, Cell, Slice, InternalMessage, CommonMessageInfo, toNano } from "ton";
import BN from "bn.js";



export function readString(filename: string): string {
	return fs.readFileSync(new URL(filename, import.meta.url), 'utf-8');
}

export const contractLoader = (filename: string) => {
	const sourceCode = readString(filename);
	return (dataCell: Cell) => SmartContract.fromFuncSource(sourceCode, dataCell);		
};




export function assertExitSuccess(result: executor.ExecutionResult) {
	if (result.type != 'success' || result.exit_code > 0) {
		throw new Error(`exit_code = ${result.exit_code}`);
	}
}


