const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function delay(timeMs, range = 0) {
   // Calculate random delay if range is provided
    const delayTime = range > 0 ? Math.floor(Math.random() * range) + timeMs : timeMs;
    await sleep(delayTime);
}

module.exports = {
    delay,
}