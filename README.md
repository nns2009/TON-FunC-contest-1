# Based on

https://github.com/disintar/task-1-playground

# Example of tests usage on first contest task

## Usage

[Install](https://github.com/disintar/toncli/blob/master/INSTALLATION.md) toncli and TON binaries, then run:

```
toncli run_tests
```

## Project structure

```
.
├── build
│   ├── contract.fif - auto build of func/code.fc
│   └──contract_tests.fif - auto build of tests/example.fc
├── func
│   └── code.fc - code of first contest task
├── project.yaml - project structure for toncli
├── README.md
└── tests
    └── example.fc - tests code
```

P.S. If you really interest in how tests works - check
out [here](https://github.com/disintar/toncli/blob/master/docs/advanced/func_tests.md)