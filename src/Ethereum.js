const { ethers } = require('ethers');
const inquirer = require('inquirer');
const logger = require('./utils/setLogger');
const writeToJsonFile = require('./utils/fileWrite');

async function getWallet(createMnemonic = true, importMnemonic = false, walletNum = 10) {
    const basePath = "m/44'/60'/0'/0";
    let hdNodewallet = null, mnemonic = '';
    const allAddresses = {
        addresses: [],
        privateKeys: []
    };

    if (createMnemonic) {
        hdNodewallet = ethers.HDNodeWallet.createRandom(undefined, basePath, undefined);
        mnemonic = hdNodewallet.mnemonic.phrase;
        logger.warn(`随机生成的助记词(注意保存): ${mnemonic}`);
    } else if(importMnemonic) {
        const { importedMnemonic } = await inquirer.prompt([
            {
              type: 'input',
              name: 'importedMnemonic',
              message: '请输入助记词:',
            },
        ]);

        mnemonic = importedMnemonic;
        logger.success(`你输入的助记词是: ${mnemonic}`);

        if (!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
            throw new Error("助记词不正确!");
        }
        const mnemonicInstance = ethers.Mnemonic.fromPhrase(mnemonic);
        hdNodewallet = ethers.HDNodeWallet.fromMnemonic(mnemonicInstance, basePath);
    }

    for (let pathIndex = 0; pathIndex < walletNum; pathIndex++) {
        logger.info(`第${pathIndex + 1}/${walletNum}个地址`);
        let wallet;
        if (createMnemonic || importMnemonic) {
            wallet = hdNodewallet.derivePath(pathIndex.toString());
        } else {
            wallet = ethers.Wallet.createRandom();
        }
        const address = wallet.address;
        const privateKey = wallet.privateKey;
        
        allAddresses.addresses.push(address);
        allAddresses.privateKeys.push(privateKey);
        logger.success(`地址: ${address}`);
        logger.success(`私钥: ${privateKey}`);
    }
    return {mnemonic, addresses: allAddresses}
}

async function createETHWallet() {
    let createMnemonic = false;
    let importMnemonic = false;
    let keyPairNum = 10;

    const { keyPairNumInput } = await inquirer.prompt([
        {
            type: 'input',
            name: 'keyPairNumInput',
            message: '输入要生成的地址数量: ',
            validate: function (value) {
                var valid = !isNaN(parseInt(value)) && parseInt(value) > 0;
                return valid || '请输入一个有效的正整数';
            },
            filter: Number,
        }
    ]);
    keyPairNum = keyPairNumInput;

    const choices = [
        `1 随机生成 ${keyPairNum} 个地址`,
        `2 生成助记词派生 ${keyPairNum} 个地址`,
        `3 导入助记词派生 ${keyPairNum} 个地址`,
    ];

    const { option } = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: '请选择一个操作:',
            choices: [
                `1 随机生成 ${keyPairNum} 个地址`,
                `2 生成助记词派生 ${keyPairNum} 个地址`,
                `3 导入助记词派生 ${keyPairNum} 个地址`,
            ],
        },
    ]);

    switch (option) {
        case choices[0]:
            createMnemonic = false;
            importMnemonic = false;
            break;
        case choices[1]:
            createMnemonic = true;
            importMnemonic = false;
            break;
        case choices[2]:
            createMnemonic = false;
            importMnemonic = true;
            break;
    }
    try {
        const result = await getWallet(createMnemonic, importMnemonic, keyPairNum);
        writeToJsonFile(result, 'evm地址');
    } catch(error) {
        logger.error(`生成evm地址失败: ${error.message}`);
    }
}

module.exports = {
    createETHWallet
}