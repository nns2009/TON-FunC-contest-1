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

# Author
**Igor Konyakhin** <br>
Telegram: [@nns2009](https://t.me/nns2009) <br>
https://codeforces.com/profile/nns2009 <br>
https://vk.com/nns2009 <br>
https://facebook.com/nns2009
