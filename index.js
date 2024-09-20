const inquirer = require('inquirer');

const { createBTCWallet } = require('./src/Bitcoin');
const { createSOLWallet } = require('./src/Solana');
const { createETHWallet } = require('./src/Ethereum');

(async () => {
    const choices = [
        `1 创建BTC钱包`,
        `2 创建ETH钱包`,
        `3 创建SOL钱包`,
    ];

    const { option } = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: '请选择一个操作:',
            choices: choices
        }
    ]);

    switch (option) {
        case choices[0]:
            await createBTCWallet();
            break;
        case choices[1]:
            await createETHWallet();
            break;
        case choices[2]:
            await createSOLWallet();
            break;
    }
})();