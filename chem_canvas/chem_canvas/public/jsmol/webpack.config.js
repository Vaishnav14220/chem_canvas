const path = require('path')

module.exports = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'jsmol.js',
        library: 'JSmol',
        libraryTarget: 'umd',
        globalObject: 'this'
    }
}