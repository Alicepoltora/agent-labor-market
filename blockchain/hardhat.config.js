require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: '../backend/.env' });

module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    arc: {
      url: 'https://rpc.testnet.arc.network',
      chainId: 5042002,
      accounts: [process.env.EXCHANGE_PRIVATE_KEY || '0x' + '0'.repeat(63) + '1'],
    },
  },
};
