function retryPromise(name, fn, retriesLeft = 10, interval = 1000) {
    return new Promise((resolve, reject) => {
        return fn
            .then(resolve)
            .catch((error) => {
                if (retriesLeft === 1) {
                    // reject('maximum retries exceeded');
                    console.log(`${name} maximum retries exceeded`);
                    resolve(false)
                    return
                }

                setTimeout(() => {
                    console.log(`${name} catch error: ${error}`);
                    console.log(`${name} retrying... - and we have ${retriesLeft} retries left`);
                    // Passing on "reject" is the important part
                    retryPromise(name, fn, retriesLeft - 1, interval).then(resolve).catch(reject)
                }, interval)
            })
    })
}

module.exports = {
    stripHexPrefix(string) {
        if (string[0] === "0" && string[1] === "x") {
            return string.substr(2, string.length)
        }
        return string
    },

    randomInt(min, max) { // min and max included 
        return Math.floor(Math.random() * (max - min + 1) + min);
    },

    randomFloat(min, max, fixed = 2) {
        return (Math.random() * (min - max) + max).toFixed(fixed)
    },

    parseLogsData(data) {
        return data.match(new RegExp('.{1,' + 66 + '}', 'g'));
    },

    decodeAddress(hex) {
        return `0x${hex.substr(26)}`
    },

    retryPromise: retryPromise
}