const bip39 = require('bip39');
const ecc = require('tiny-secp256k1');
const inquirer = require('inquirer');
const bitcoin = require('bitcoinjs-lib');
const {ECPairFactory} = require('ecpair');
const { BIP32Factory } = require('bip32')

const logger = require('./utils/setLogger');
const writeToJsonFile = require('./utils/fileWrite');

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc)
const network = bitcoin.networks.bitcoin; // 主网

function getAddress(p2pkhKeyPair, p2shP2wpkhKeyPair, p2wpkhPair, p2trKeyPair) {
    const addresses = {
        p2pkh: { addresses: [], privateKeys: [] },
        p2shP2wpkh: { addresses: [], privateKeys: [] },
        p2wpkh: { addresses: [], privateKeys: [] },
        p2tr: { addresses: [], privateKeys: [] }
    };

    // Legacy 地址（P2PKH）1开头地址
    const p2pkh = bitcoin.payments.p2pkh({ 
        pubkey: p2pkhKeyPair.publicKey,
        network
    });
    addresses.p2pkh.addresses.push(p2pkh.address);
    addresses.p2pkh.privateKeys.push(p2pkhKeyPair.toWIF());
    logger.success(`   P2PKH 地址:         ${p2pkh.address}`);
    logger.success(`   P2PKH 私钥:         ${p2pkhKeyPair.toWIF()}`);

    // Nested Segwit 地址（P2SH-P2WPKH)）3开头地址
    const p2sh = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ 
            pubkey: p2shP2wpkhKeyPair.publicKey,
            network
        }),
    });
    addresses.p2shP2wpkh.addresses.push(p2sh.address);
    addresses.p2shP2wpkh.privateKeys.push(p2shP2wpkhKeyPair.toWIF());
    logger.success(`   P2SH(P2WPKH) 地址:  ${p2sh.address}`);
    logger.success(`   P2SH(P2WPKH) 私钥:  ${p2shP2wpkhKeyPair.toWIF()}`);

    // Native Segwit 地址（P2WPKH）bc1开头地址
    const p2wpkh = bitcoin.payments.p2wpkh({ 
        pubkey: p2wpkhPair.publicKey,
        network
    });
    addresses.p2wpkh.addresses.push(p2wpkh.address);
    addresses.p2wpkh.privateKeys.push(p2wpkhPair.toWIF());
    logger.success(`   P2WPKH 地址:        ${p2wpkh.address}`);
    logger.success(`   P2WPKH 私钥:        ${p2wpkhPair.toWIF()}`);

    // Taproot 地址（P2TR）bc1p开头地址
    const toXOnly = pubKey => (pubKey.length === 32 ? pubKey : pubKey.slice(1, 33));
    const p2tr = bitcoin.payments.p2tr({
        internalPubkey: toXOnly(p2trKeyPair.publicKey),
        network
    });
    addresses.p2tr.addresses.push(p2tr.address);
    addresses.p2tr.privateKeys.push(p2trKeyPair.toWIF());
    logger.success(`   P2TR 地址:          ${p2tr.address}`);
    logger.success(`   P2TR 私钥:          ${p2trKeyPair.toWIF()}`);

    return addresses;
}

async function getKeypair(createMnemonic = true, importMnemonic = false, keyPairNum = 10) {
    let root = null;
    let mnemonic = '';
    const allAddresses = {
        p2pkh: { addresses: [], privateKeys: [] },
        p2shP2wpkh: { addresses: [], privateKeys: [] },
        p2wpkh: { addresses: [], privateKeys: [] },
        p2tr: { addresses: [], privateKeys: [] }
    };

    if (createMnemonic) {
        mnemonic = bip39.generateMnemonic();
        logger.warn(`随机生成的助记词(注意保存): ${mnemonic}`);
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        root = bip32.fromSeed(seed);
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
        root = bip32.fromSeed(seed);
    }

    for (let pathIndex = 0; pathIndex < keyPairNum; pathIndex++) {
        logger.info(`第${pathIndex + 1}/${keyPairNum}个地址`);
        if (createMnemonic || importMnemonic) {
            const paths = {
                p2pkh: `m/44'/0'/0'/0/${pathIndex}`,
                p2sh_p2wpkh: `m/49'/0'/0'/0/${pathIndex}`,
                p2wpkh: `m/84'/0'/0'/0/${pathIndex}`,
                p2tr: `m/86'/0'/0'/0/${pathIndex}`
            };

            const p2pkhKeyPair = root.derivePath(paths.p2pkh);
            const p2shP2wpkhKeyPair = root.derivePath(paths.p2sh_p2wpkh);
            const p2wpkhPair = root.derivePath(paths.p2wpkh);
            const p2wpkhKeyPair = root.derivePath(paths.p2tr);
            const addresses = getAddress(p2pkhKeyPair, p2shP2wpkhKeyPair, p2wpkhPair, p2wpkhKeyPair);
            Object.keys(addresses).forEach(type => {
                allAddresses[type].addresses.push(...addresses[type].addresses);
                allAddresses[type].privateKeys.push(...addresses[type].privateKeys);
            });
        } else {
            const keyPair = ECPair.makeRandom();
            const addresses = getAddress(keyPair, keyPair, keyPair, keyPair);
            Object.keys(addresses).forEach(type => {
                allAddresses[type].addresses.push(...addresses[type].addresses);
                allAddresses[type].privateKeys.push(...addresses[type].privateKeys);
            });
        }
    }

    return { mnemonic, addresses: allAddresses };
}

async function createBTCWallet () {
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
            choices: choices,
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
        writeToJsonFile(result, 'btc地址');
    } catch(error) {
        logger.error(`生成btc地址失败: ${error.message}`);
    }
}

module.exports = {
    createBTCWallet
}
