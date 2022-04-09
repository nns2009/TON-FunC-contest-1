# TON FunC Contest #1 - solutions and tests
These are my solutions and tests for the TON Foundations's 1st smart contract developement contest for TON blockchain:

https://ton.org/contest

https://github.com/ton-blockchain/func-contest1

## Project structure

- `/func` - my contest solutions (all tasks)
- `/tests` - toncli tests (tasks 1, 2, 3)
- `/js` - TypeScript tests (tasks 1, 4, 5)

## toncli tests
[Install](https://github.com/disintar/toncli/blob/master/INSTALLATION.md) toncli and TON binaries, then run `toncli` tests with:
```
toncli run_tests -c task2
```
Initial project structure and toncli tests are based on: https://github.com/disintar/task-1-playground

## TypeScript tests
Install TypeScript and project dependencies (once, in the root folder):
```
npm install -g typescript
npm install -g ts-node
npm install
```

To lanuch tests, run (from the root folder):
```
ts-node-esm ./js/tests_N.ts
```

Make sure this line in the `tests_N.ts` file:
```js
let contract = await contractLoader('./../func/4.fc')(initialData);
```
points at the correct contract location

## Errors

### No exported member 'ExecutionResult'
If you get:
```
TSError: ⨯ Unable to compile TypeScript:
js/shared.ts:151:52 - error TS2694: Namespace '"/root/TON-FunC-contest-1/node_modules/ton-contract-executor/dist/index"' has no exported member 'ExecutionResult'.
```
then in the file:
```/node_modules/ton-contract-executor/dist/executor/SmartContract.d.ts```
change line 24 to:
```ts
export declare type ExecutionResult = FailedExecutionResult | SuccessfulExecutionResult;
```
(add "export" at the beginning)

### Windows, Linux
If you are not on Mac, you'll get something like:
```
/bin/sh: 1: /root/TON-FunC-contest-1/node_modules/ton-compiler/bin/macos/func: Exec format error
/root/TON-FunC-contest-1/node_modules/ton-contract-executor/dist/vm-exec/vm-exec.js:147
      throw ex;
```
that's because `ton-compiler` package only officially works on MacOS. I found a way to fix it on Windows: [install](https://github.com/disintar/toncli/blob/master/INSTALLATION.md) `toncli` and then replace the `macos` folder from above with the TON binaries folder (the one containing `func.exe`, `fift.exe` and where you placed `libcrypto-1_1-x64.dll`). It should work after this. Something similar will probably work on Linux.

Installing `toncli` is _likely_ not necessary, you may try the fix above with just TON binaries. It's also _probably_ not necessary to copy the entire TON binaries folder. _Maybe_ copying just `func.exe` and `fift.exe` is going to be enough. But I tried neither of this. Storage is cheap.

# Author
### Igor Konyakhin
Telegram: [@nns2009](https://t.me/nns2009) <br>
https://codeforces.com/profile/nns2009 <br>
https://vk.com/nns2009 <br>
https://facebook.com/nns2009
