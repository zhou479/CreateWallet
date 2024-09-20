// fileWriter.js
const fs = require('fs');
const logger = require('./setLogger');

function writeToJsonFile(data, fileName) {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth()+1;
    const day = date.getDate();
    const hour = date.getHours();
    const filenameWithDate = `./data/${year}-${month}-${day}-${hour}_${fileName}.json`;

    const jsonContent = JSON.stringify(data, null, 2);
    
    try {
        fs.writeFileSync(filenameWithDate, jsonContent, 'utf8');
    } catch(error) {
        logger.error(`写入json文件出错: ${error.message}`);
    }
}

module.exports = writeToJsonFile;
