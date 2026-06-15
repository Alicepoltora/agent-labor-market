require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: './backend/.env' });

module.exports = {
  solidity: { version: '0.8.24', settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    arc: {
      url: 'https://rpc.testnet.arc.network',
      chainId: 5042002,
      accounts: [process.env.EXCHANGE_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001'],
    },
  },
  paths: { sources: './contracts', cache: './cache', artifacts: './artifacts' },
};
