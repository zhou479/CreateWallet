const bs58 = require('bs58');
const bip39 = require('bip39');
const inquirer = require('inquirer');
const { HDKey } = require("micro-ed25519-hdkey");
const { Keypair } = require('@solana/web3.js');

const logger = require('./utils/setLogger');
const writeToJsonFile = require('./utils/fileWrite');

async function getAddress(keyPair) {
    const addresses = {
        addresses: [],
        privateKeys: []
    };
    const address = keyPair.publicKey.toBase58();
    const privateKey = bs58.encode(keyPair.secretKey);

    addresses.addresses.push(address);
    addresses.privateKeys.push(privateKey);
    logger.success(`地址: ${address}`);
    logger.success(`私钥: ${privateKey}`);
    return addresses;
}
async function getKeypair(createMnemonic = true, importMnemonic = false, keyPairNum = 10) {
    let hdKey = null, mnemonic = '';
    const allAddresses = {
        addresses: [],
        privateKeys: []
    };

    if (createMnemonic) {
        mnemonic = bip39.generateMnemonic();
        logger.warn(`随机生成的助记词(注意保存): ${mnemonic}`);
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        hdKey = HDKey.fromMasterSeed(seed);
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
    
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error("助记词不正确!");
        }
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        hdKey = HDKey.fromMasterSeed(seed);
    }

    for (let pathIndex = 0; pathIndex < keyPairNum; pathIndex++) {
        logger.info(`第${pathIndex + 1}/${keyPairNum}个地址`);

        if (createMnemonic || importMnemonic) {
            const path = `m/44'/501'/${pathIndex}'/0'`;
            const keyPair = Keypair.fromSeed(hdKey.derive(path).privateKey);
            const addresses = await getAddress(keyPair);
            allAddresses.addresses.push(...addresses.addresses);
            allAddresses.privateKeys.push(...addresses.privateKeys);

        } else {
            const keyPair = Keypair.generate();
            const addresses = await getAddress(keyPair);
            allAddresses.addresses.push(...addresses.addresses);
            allAddresses.privateKeys.push(...addresses.privateKeys);
        }
    }
    return {mnemonic, allAddresses};
}

async function createSOLWallet() {
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
        const result = await getKeypair(createMnemonic, importMnemonic, keyPairNum);
        writeToJsonFile(result, 'sol地址');
    } catch (error) {
        logger.error(`生成sol地址失败: ${error.message}`);
        
    }
}

module.exports = {
    createSOLWallet
}
