const Axios = require('axios')
const Web3EthABI = require('web3-eth-abi');
const { numberToHex, hexToNumber, toWei } = require('web3-utils')
const Web3EthAccounts = require('web3-eth-accounts');
const parseLog = require('eth-log-parser');

const EthereumService = {
    transactionQueue: [],
    CHAIN: "eth_mainnet",
    chainIds: {
        eth_mainnet: 1,
        bsc_mainnet: 56
    },
    init(config) {
        for (key in config) {
            this[key] = config[key]
        }
    },
    createWallet() {
        return accounts.create()
    },
    privateKeyToAddress(privateKey) {
        const newAccount = new Web3EthAccounts()
        const account = newAccount.privateKeyToAccount(privateKey)
        return account.address.toLowerCase()
    },
    getCurrentBlock() {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []
            }).then(res => {
                resolve(hexToNumber(res.data.result))
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    getBalance(address) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getBalance", "params": [address, "latest"]
            }).then(res => {
                resolve(parseInt(res.data.result))
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    getBlockByNum(blockNumber, showFullTransaction = true) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getBlockByNumber", "params": [numberToHex(blockNumber), showFullTransaction]
            }).then(res => {
                if (res.data.result) {
                    resolve(res.data.result)
                } else {
                    reject("Block not exist")
                }
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    getTransactionLogs(txid) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionReceipt", "params": [txid]
            }).then(res => {
                resolve(res.data.result.logs || [])
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    getTransactionReceipt(txid) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionReceipt", "params": [txid]
            }).then(res => {
                resolve(res.data.result || [])
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    getTransaction(txid) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionByHash", "params": [txid]
            }).then(res => {
                if (res.data.result) {
                    resolve(res.data.result)
                } else {
                    reject(`Can't find transaction`)
                }
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    sendCoin(privateKey, to, value, nonce = false) {
        return new Promise((resolve, reject) => {
            const txParams = {
                from: this.privateKeyToAddress(privateKey),
                to: to,
                value: numberToHex(toWei(value.toString())),
            }

            if (nonce) txParams.nonce = numberToHex(nonce)

            this.sendTransaction(txParams, privateKey).then(txid => resolve(txid)).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    callSmartContract(contractAddress, abi, method, params, enableDecode = true, usePreventiveNode = false) {
        var _this = this
        return new Promise((resolve, reject) => {
            // encode data
            const { err, data, outputs } = this.encodeSmartContract(abi, method, params)

            if (err) return reject(err)

            Axios.post(usePreventiveNode ? this.PREVENTIVE_NODE : this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{
                    to: contractAddress,
                    data
                }, "latest"]
            }).then(res => {
                if(!res || !res.data || !res.data.result) {
                    if(_this.PREVENTIVE_NODE && usePreventiveNode === false) {
                        console.log(`[callSmartContract ${contractAddress} - ${method}(${params.join(",")})] result is null. try preventive node...`)
                        return _this.callSmartContract(contractAddress, abi, method, params, enableDecode, true).then(resolve).catch(reject)
                    } else {
                        return reject("result is null")
                    }
                }
                if (!enableDecode) return resolve(res.data.result)
                const decode = Web3EthABI.decodeParameters(outputs, res.data.result)
                let result = {};
                for (let i = 0; i < outputs.length; i++) {
                    result[outputs[i].name] = decode[outputs[i].name]
                }
                resolve(result)
            }).catch( error => {
                if(_this.PREVENTIVE_NODE && usePreventiveNode === false) {
                    console.log(`[callSmartContract ${contractAddress} - ${method}(${params.join(",")})] error. try preventive node...`)
                    console.log(error);
                    return _this.callSmartContract(contractAddress, abi, method, params, enableDecode, true).then(resolve).catch(reject)
                } else {
                    if (error.response) {
                        reject(error.response)
                    } else {
                        reject(error)
                    }
                }
            })
        })
    },

    sendSmartContract(privateKey, contractAddress, abi, method, params, nonce = false, value = 0) {
        return new Promise((resolve, reject) => {
            // encode data
            const { err, data } = this.encodeSmartContract(abi, method, params)

            if (err) return reject(err)

            const txParams = {
                from: this.privateKeyToAddress(privateKey),
                to: contractAddress,
                value: numberToHex(toWei(value.toString())),
                data
            }

            if (nonce) txParams.nonce = numberToHex(nonce)

            this.sendTransaction(txParams, privateKey).then(txid => resolve(txid)).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    estimate(privateKey, contractAddress, abi, method, params, nonce = false, value = 0) {
        return new Promise((resolve, reject) => {
            // encode data
            const { err, data } = this.encodeSmartContract(abi, method, params)

            if (err) return reject(err)

            const txParams = {
                from: this.privateKeyToAddress(privateKey),
                to: contractAddress,
                value: numberToHex(toWei(value.toString())),
                data
            }

            this.estimateGas(txParams).then(async gasLimit => {
                let gasPrice = await this.getGasPrice()
                gasPrice = hexToNumber(gasPrice)
                gasLimit = hexToNumber(gasLimit) + 200
                resolve(gasPrice * gasLimit)
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },
    parseLog: parseLog,

    // Internal Functions
    sendTransaction(txParams, privateKey) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.chainIds[this.CHAIN]) {
                    return reject(`${this.CHAIN} is not support`)
                }

                if (!txParams.gasPrice) txParams.gasPrice = await this.getGasPrice()
                if (!txParams.gasLimit) {
                    try {
                        txParams.gasLimit = await this.estimateGas(txParams)
                    } catch (error) {
                        reject(error)
                    }
                }
                if (!txParams.nonce) txParams.nonce = await this.getTransactionCount(this.privateKeyToAddress(privateKey))
                if (!txParams.chainId) txParams.chainId = this.chainIds[this.CHAIN]

                const newAccount = new Web3EthAccounts()
                const account = newAccount.privateKeyToAccount(privateKey)
                const tx = await account.signTransaction(txParams)

                Axios.post(this.NODE, {
                    "jsonrpc": "2.0", "id": 1, "method": "eth_sendRawTransaction", "params": [tx.rawTransaction]
                }).then(res => {
                    console.log(res);
                    resolve(res.data.result)
                }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
            } catch (error) {
                reject(error)
            }
        })
    },

    getTransactionCount(address) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionCount", "params": [address, "latest"]
            }).then(res => {
                if(!res || !res.data || !res.data.result) {
                    return reject("result is null")
                }
                resolve(res.data.result)
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    estimateGas(txParams) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_estimateGas", "params": [txParams]
            }).then(res => {
                if (res.data.error) {
                    reject(res.data.error)
                } else {
                    resolve(res.data.result)
                }
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    getGasPrice() {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_gasPrice", "params": []
            }).then(res => {
                if(!res || !res.data || !res.data.result) {
                    return reject("result is null")
                }
                resolve(res.data.result)
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    encodeSmartContract(abi, method, params) {
        var abiMethod = false;
        for (let i = 0; i < abi.length; i++) {
            let obj = abi[i]

            if (obj.name === method) {
                abiMethod = obj
                break;
            }
        }

        if (!abiMethod) return { error: `Can't find ${method} in abi`, data: null }

        const data = Web3EthABI.encodeFunctionCall(abiMethod, params)
        return { error: null, data, outputs: abiMethod.outputs }
    },

    getCode(address) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getCode", "params": [address, 'latest']
            }).then(res => {
                if(!res || !res.data || !res.data.result) {
                    return reject("result is null")
                }
                resolve(res.data.result)
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    getLogs(fromBlock, toBlock, usePreventiveNode = false) {
        var _this = this
        return new Promise((resolve, reject) => {
            Axios.post(usePreventiveNode ? this.PREVENTIVE_NODE : this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getLogs", "params": [{ fromBlock: numberToHex(fromBlock), toBlock: numberToHex(toBlock) }]
            }).then(res => {
                if(!res || !res.data || !res.data.result) {
                    if(_this.PREVENTIVE_NODE && usePreventiveNode === false) {
                        console.log(`[getLogs ${fromBlock} -> ${toBlock}] result is null. try preventive node...`)
                        return _this.getLogs(fromBlock, toBlock, true).then(resolve).catch(reject)
                    } else {
                        return reject("result is null")
                    }
                }
                if(res.data.result.length === 0) {
                    if(_this.PREVENTIVE_NODE && usePreventiveNode === false) {
                        console.log(`[getLogs ${fromBlock} -> ${toBlock}] result length is 0. try preventive node...`)
                        return _this.getLogs(fromBlock, toBlock, true).then(resolve).catch(reject)
                    } else {
                        return reject("result length is 0")
                    }
                }
                resolve(res.data.result)
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    },

    getLogsByAddress(fromBlock, toBlock, address) {
        return new Promise((resolve, reject) => {
            Axios.post(this.NODE, {
                "jsonrpc": "2.0", "id": 1, "method": "eth_getLogs", "params": [{ fromBlock: numberToHex(fromBlock), toBlock: numberToHex(toBlock), address }]
            }).then(res => {
                if(!res || !res.data || !res.data.result) {
                    return reject("result is null")
                }
                resolve(res.data.result)
            }).catch(error => {
                if (error.response && error.response.data) {
                    reject(error.response.data)
                } else if(error.message) {
                    reject(error.message)
                } else {
                    reject(error)
                }
            })
        })
    }
}

module.exports = EthereumService