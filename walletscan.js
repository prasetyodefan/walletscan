const axios = require('axios');
const readline = require('readline');

const NETWORKS = {
    '1': { name: 'Soneium', url: 'https://soneium.blockscout.com/api' },
    '2': { name: 'Optimism', url: 'https://optimism.blockscout.com/api' },
    '3': { name: 'Base', url: 'https://base.blockscout.com/api' },
    '4': { name: 'Mode', url: 'https://explorer.mode.network/api' },
    '5': { name: 'Unichain', url: 'https://unichain.blockscout.com/api' },
    '6': { name: 'Inkonchain', url: 'https://explorer.inkonchain.com/api' },
    '7': { name: 'Arbitrum', url: 'https://arbitrum.blockscout.com/api' },
    '8': { name: 'Ethereum', url: 'https://eth.blockscout.com/api' }
};

const ETH_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function getWalletSummary(network, address) {
    try {
        const BASE_URL = network.url;
        console.log(`\n🔍 Fetching data from ${network.name}...`);
        
        const txResponse = await axios.get(`${BASE_URL}?module=account&action=txlist&address=${address}`);
        const transactions = txResponse.data.result;

        if (!transactions || transactions.length === 0) {
            console.log('\n❌ No transactions found for this address.');
            return;
        }

        const totalTx = transactions.length;
        const firstTxTimestamp = Math.min(...transactions.map(tx => parseInt(tx.timeStamp)));
        const walletAge = Math.ceil((Date.now() / 1000 - firstTxTimestamp) / (24 * 60 * 60));
        const firstTxDate = new Date(firstTxTimestamp * 1000).toISOString().split('T')[0];
        const avgTxPerDay = totalTx / walletAge;
        
        let totalVolumeETH = 0;
        let totalDepositETH = 0;
        let totalFeesETH = 0;
        let balanceETH = 0;
        let totalSpentETH = 0;
        let dailySpend = {};
        let monthlySpend = {};
        let yearlySpend = {};
        let contractInteractions = {};
        let successfulTx = 0;
        let failedTx = 0;
        
        transactions.forEach(tx => {
            const valueETH = parseFloat(tx.value) / 1e18;
            const gasUsedETH = (parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice)) / 1e18;
            totalVolumeETH += valueETH;
            totalFeesETH += gasUsedETH;
            if (tx.to.toLowerCase() === address.toLowerCase()) {
                totalDepositETH += valueETH;
                balanceETH += valueETH;
            }
            if (tx.from.toLowerCase() === address.toLowerCase()) {
                totalSpentETH += valueETH;
                balanceETH -= (valueETH + gasUsedETH);
            }
            
            const date = new Date(parseInt(tx.timeStamp) * 1000);
            const dateStr = date.toISOString().split('T')[0];
            const monthStr = `${date.getFullYear()}-${date.getMonth() + 1}`;
            const yearStr = `${date.getFullYear()}`;
            
            dailySpend[dateStr] = (dailySpend[dateStr] || 0) + valueETH;
            monthlySpend[monthStr] = (monthlySpend[monthStr] || 0) + valueETH;
            yearlySpend[yearStr] = (yearlySpend[yearStr] || 0) + valueETH;
            
            if (tx.to) {
                contractInteractions[tx.to] = contractInteractions[tx.to] || { count: 0, volume: 0 };
                contractInteractions[tx.to].count += 1;
                contractInteractions[tx.to].volume += valueETH;
            }
            
            if (tx.isError === '0') {
                successfulTx++;
            } else {
                failedTx++;
            }
        });

        const priceResponse = await axios.get(ETH_PRICE_API);
        const ethPriceUSD = priceResponse.data.ethereum.usd;
        const totalVolumeUSD = totalVolumeETH * ethPriceUSD;
        const totalDepositUSD = totalDepositETH * ethPriceUSD;
        const totalFeesUSD = totalFeesETH * ethPriceUSD;
        const totalSpentUSD = totalSpentETH * ethPriceUSD;
        const avgDailyFeesUSD = totalFeesUSD / walletAge;
        const balanceEstimationUSD = balanceETH * ethPriceUSD;
        const depositToSpendRatio = totalDepositETH > 0 ? (totalSpentETH / totalDepositETH).toFixed(2) : 'N/A';
        const avgGasFeeETH = totalFeesETH / totalTx;
        const avgGasFeeETHUSD = avgGasFeeETH * ethPriceUSD;
        const mostActiveDay = Object.keys(dailySpend).reduce((a, b) => dailySpend[a] > dailySpend[b] ? a : b, '');




        
        const currentMonth = new Date().toISOString().split('T')[0].slice(0, 7);
        const currentYear = new Date().getFullYear().toString();

        const topContracts = Object.entries(contractInteractions)
            .sort((a, b) => b[1].volume - a[1].volume)
            .slice(0, 10)
            .map(([contract, data]) => `${contract} - ${data.count} tx, ${data.volume.toFixed(4)} ETH ($${(data.volume * ethPriceUSD).toFixed(2)})`)
            .join('\n   ');
        
        console.log(`\n📊 Wallet Summary for ${address}`);
        console.log(`📌 Total Transactions    : ${totalTx}`);
        console.log(`📌 Wallet Age            : ${walletAge} days (Since ${firstTxDate})`);
        console.log(`📌 Most Active Day       : ${mostActiveDay} (${dailySpend[mostActiveDay].toFixed(4)} ETH)`);
        console.log(`📌 Avg Transactions/Day  : ${avgTxPerDay.toFixed(2)}`);
        console.log(`📌 Success/Failed Tx     : ${successfulTx}/${failedTx}`);
        console.log(`\n💰 Financial Summary`);
        console.log(`🔹 Total Volume          : ${totalVolumeETH.toFixed(4)} ETH $${totalVolumeUSD.toFixed(2)}`);
        console.log(`🔹 Total Deposits        : ${totalDepositETH.toFixed(4)} ETH $${totalDepositUSD.toFixed(2)}`);
        console.log(`🔹 Total Fees Used       : ${totalFeesETH.toFixed(4)} ETH $${totalFeesUSD.toFixed(2)}`);
        console.log(`🔹 Avg Gas Fee per Tx    : ${avgGasFeeETH.toFixed(6)} ETH $${avgGasFeeETHUSD.toFixed(2)}`);
        console.log(`🔹 Total Spent           : ${totalSpentETH.toFixed(4)} ETH $${totalSpentUSD.toFixed(2)}`);
        console.log(`🔹 Avg Daily Fees        : $${avgDailyFeesUSD.toFixed(2)}`);
        console.log(`🔹 Deposit to Spend Ratio: ${depositToSpendRatio}`);
        console.log(`\n📅 Spending Overview`);
        console.log(`🔹 Most Spent (1 Day)    : ${Math.max(...Object.values(dailySpend)).toFixed(4)} ETH ($${(Math.max(...Object.values(dailySpend)) * ethPriceUSD).toFixed(2)})`);
        console.log(`🔹 Most Spent (${currentMonth})  : ${monthlySpend[currentMonth] ? monthlySpend[currentMonth].toFixed(4) : '0.0000'} ETH ($${(monthlySpend[currentMonth] ? monthlySpend[currentMonth] * ethPriceUSD : 0).toFixed(2)})`);
        console.log(`🔹 Most Spent (${currentYear})     : ${yearlySpend[currentYear] ? yearlySpend[currentYear].toFixed(4) : '0.0000'} ETH ($${(yearlySpend[currentYear] ? yearlySpend[currentYear] * ethPriceUSD : 0).toFixed(2)})`);
        console.log(`\n📡 Top Interacted Contracts:\n   ${topContracts || 'No contracts interacted'}`);
    } catch (error) {
        console.error('\n❌ Error fetching data:', error);
    }
}

console.log('\nSelect a network:');
Object.keys(NETWORKS).forEach(key => {
    console.log(`${key}: ${NETWORKS[key].name}`);
});

rl.question('\nEnter network number: ', networkKey => {
    if (!NETWORKS[networkKey]) {
        console.log('\n❌ Invalid network selection.');
        rl.close();
        return;
    }
    rl.question('Enter wallet address: ', address => {
        getWalletSummary(NETWORKS[networkKey], address);
        rl.close();
    });
});
