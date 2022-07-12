const EthereumService = require(".");

EthereumService.init({
    NODE: "https://rpc-bsc.bnb48.club",
    CHAIN: "bsc_mainnet"
})

EthereumService.getCurrentBlock().then(block => {
    console.log(block);
}).catch(err => {
    console.log(err);
})