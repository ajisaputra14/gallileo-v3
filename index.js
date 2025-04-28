require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');
const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bold: "\x1b[1m"
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  process: (msg) => console.log(`\n${colors.white}[➤] ${msg}${colors.reset}`),
  debug: (msg) => console.log(`${colors.gray}[…] ${msg}${colors.reset}`),
  bye: (msg) => console.log(`${colors.yellow}[…] ${msg}${colors.reset}`),
  critical: (msg) => console.log(`${colors.red}${colors.bold}[❌] ${msg}${colors.reset}`),
  summary: (msg) => console.log(`${colors.white}[✓] ${msg}${colors.reset}`),
  section: (msg) => {
    const line = '='.repeat(50);
    console.log(`\n${colors.cyan}${line}${colors.reset}`);
    if (msg) console.log(`${colors.cyan}${msg}${colors.reset}`);
    console.log(`${colors.cyan}${line}${colors.reset}\n`);
  },
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(` █████╗       ██╗ ██╗███████╗      ███████╗`);
    console.log(`██╔══██╗      ██║ ██║██╔════╝      ██╔════╝`);
    console.log(`███████║      ██║ ██║█████╗        ███████╗`);
    console.log(`██╔══██║      ██║ ██║██╔══╝        ╚════██║`);
    console.log(`██║  ██║ ███████╗ ██║███████╗ ██╗  ███████║`);
    console.log(`╚═╝  ╚═╝ ╚══════╝ ╚═╝╚══════╝ ╚═╝  ╚══════╝${colors.reset}\n`);
  }
};

const CHAIN_ID = 80087;
const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const CONTRACT_ADDRESS = '0x56A565685C9992BF5ACafb940ff68922980DBBC5';
const METHOD_ID = '0xef3e12dc';
const PROXY_FILE = 'proxies.txt';
const INDEXER_URL = 'https://indexer-storage-testnet-turbo.0g.ai';
const EXPLORER_URL = 'https://chainscan-galileo.0g.ai/tx/';

const IMAGE_SOURCES = [
  { url: 'https://picsum.photos/800/600', responseType: 'arraybuffer' },
  { url: 'https://loremflickr.com/800/600', responseType: 'arraybuffer' }
];

let privateKeys = [];
let currentKeyIndex = 0;

const isEthersV6 = ethers.version.startsWith('6');
const parseUnits = isEthersV6 ? ethers.parseUnits : ethers.utils.parseUnits;
const parseEther = isEthersV6 ? ethers.parseEther : ethers.utils.parseEther;
const formatEther = isEthersV6 ? ethers.formatEther : ethers.utils.formatEther;

const provider = isEthersV6
  ? new ethers.JsonRpcProvider(RPC_URL)
  : new ethers.providers.JsonRpcProvider(RPC_URL);

function loadPrivateKeys() {
  try {
    let index = 1;
    let key = process.env[`PRIVATE_KEY_${index}`];

    if (!key && index === 1 && process.env.PRIVATE_KEY) {
      key = process.env.PRIVATE_KEY;
    }

    while (key) {
      if (isValidPrivateKey(key)) {
        privateKeys.push(key);
      } else {
        logger.error(`Kesalahan pada PRIVATE_KEY_${index}`);
      }
      index++;
      key = process.env[`PRIVATE_KEY_${index}`];
    }

    if (privateKeys.length === 0) {
      logger.critical('Tidak di temukan private key pada .env file');
      process.exit(1);
    }

    logger.success(`Membuka ${privateKeys.length} private key(s)`);
  } catch (error) {
    logger.critical(`Gagal saat membuka private key: ${error.message}`);
    process.exit(1);
  }
}

function isValidPrivateKey(key) {
  key = key.trim();
  if (!key.startsWith('0x')) key = '0x' + key;
  try {
    const bytes = Buffer.from(key.replace('0x', ''), 'hex');
    return key.length === 66 && bytes.length === 32;
  } catch (error) {
    return false;
  }
}

function getNextPrivateKey() {
  return privateKeys[currentKeyIndex];
}

function rotatePrivateKey() {
  currentKeyIndex = (currentKeyIndex + 1) % privateKeys.length;
  return privateKeys[currentKeyIndex];
}

function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

let proxies = [];
let currentProxyIndex = 0;

function loadProxies() {
  try {
    if (fs.existsSync(PROXY_FILE)) {
      const data = fs.readFileSync(PROXY_FILE, 'utf8');
      proxies = data.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      if (proxies.length > 0) {
        logger.info(`Memuat ${proxies.length} proxy dari ${PROXY_FILE}`);
      } else {
        logger.warn(`Tidak ada proxy tersedia di ${PROXY_FILE}`);
      }
    } else {
      logger.warn(`File proxy ${PROXY_FILE} tidak di temukan`);
    }
  } catch (error) {
    logger.error(`Gagal memuat proxy: ${error.message}`);
  }
}

function getNextProxy() {
  if (proxies.length === 0) return null;
  const proxy = proxies[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
  return proxy;
}

function extractProxyIP(proxy) {
  try {
    let cleanProxy = proxy.replace(/^https?:\/\//, '').replace(/.*@/, '');
    const ip = cleanProxy.split(':')[0];
    return ip || cleanProxy;
  } catch (error) {
    return proxy; 
  }
}

function createAxiosInstance() {
  const config = {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.8',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'sec-gpc': '1',
      'Referer': 'https://storagescan-galileo.0g.ai/',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  };

  const proxy = getNextProxy();
  if (proxy) {
    const proxyIP = extractProxyIP(proxy);
    logger.debug(`Menggunakan IP proxy: ${proxyIP}`);
    config.httpsAgent = new HttpsProxyAgent(proxy);
  }

  return axios.create(config);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function initializeWallet() {
  const privateKey = getNextPrivateKey();
  return new ethers.Wallet(privateKey, provider);
}

async function checkNetworkSync() {
  try {
    logger.loading('Pengecekan sinkronisasi jaringan');
    const blockNumber = await provider.getBlockNumber();
    logger.success(`Singkronisasi jaringan pada blok ${blockNumber}`);
    return true;
  } catch (error) {
    logger.error(`Singkronisasi jaringan gagal: ${error.message}`);
    return false;
  }
}

async function fetchRandomImage() {
  try {
    logger.loading('Membuat file gambar random....');
    const axiosInstance = createAxiosInstance();
    const source = IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)];
    const response = await axiosInstance.get(source.url, {
      responseType: source.responseType,
      maxRedirects: 5
    });
    logger.success('File gambar berhasil dibuat');
    return response.data;
  } catch (error) {
    logger.error(`Gagal membuat file gambar: ${error.message}`);
    throw error;
  }
}

async function checkFileExists(fileHash) {
  try {
    logger.loading(`Pengecekan file hash ${fileHash}...`);
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.get(`${INDEXER_URL}/file/info/${fileHash}`);
    return response.data.exists || false;
  } catch (error) {
    logger.warn(`Gagal melakukan cek pada file hash: ${error.message}`);
    return false;
  }
}

async function prepareImageData(imageBuffer) {
  const MAX_HASH_ATTEMPTS = 5;
  let attempt = 1;

  while (attempt <= MAX_HASH_ATTEMPTS) {
    try {
      const salt = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now().toString();
      const hashInput = Buffer.concat([
        Buffer.from(imageBuffer),
        Buffer.from(salt),
        Buffer.from(timestamp)
      ]);
      const hash = '0x' + crypto.createHash('sha256').update(hashInput).digest('hex');
      const fileExists = await checkFileExists(hash);
      if (fileExists) {
        logger.warn(`Hash ${hash} sudah ada, mencoba kembali...`);
        attempt++;
        continue;
      }
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');
      logger.success(`Membuat file hash: ${hash}`);
      return {
        root: hash,
        data: imageBase64
      };
    } catch (error) {
      logger.error(`Gagal membuat hash (percobaan ke ${attempt}): ${error.message}`);
      attempt++;
      if (attempt > MAX_HASH_ATTEMPTS) {
        throw new Error(`Gagal membuat hash setelah ${MAX_HASH_ATTEMPTS} kali percobaan`);
      }
    }
  }
}

async function uploadToStorage(imageData, wallet, walletIndex) {
  const MAX_RETRIES = 3;
  const TIMEOUT_SECONDS = 300;
  let attempt = 1;

  logger.loading(`Melakukan pengecekan saldo pada wallet ${wallet.address}...`);
  const balance = await provider.getBalance(wallet.address);
  const minBalance = parseEther('0.0015');
  if (BigInt(balance) < BigInt(minBalance)) {
    throw new Error(`Saldo tidak mencukupi: ${formatEther(balance)} OG`);
  }
  logger.success(`Saldo wallet anda: ${formatEther(balance)} OG`);

  while (attempt <= MAX_RETRIES) {
    try {
      logger.loading(`Melakukan upload file untuk wallet #${walletIndex + 1} [${wallet.address}] (Percobaan ke ${attempt}/${MAX_RETRIES})...`);
      const axiosInstance = createAxiosInstance();
      await axiosInstance.post(`${INDEXER_URL}/file/segment`, {
        root: imageData.root,
        index: 0,
        data: imageData.data,
        proof: {
          siblings: [imageData.root],
          path: []
        }
      }, {
        headers: {
          'content-type': 'application/json'
        }
      });
      logger.success('Segmen file berhasil di unggah');

      const contentHash = crypto.randomBytes(32);
      const data = ethers.concat([
        Buffer.from(METHOD_ID.slice(2), 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000020', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000014', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000060', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000080', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'),
        contentHash,
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
      ]);

      const value = parseEther('0.000839233398436224');
      const gasPrice = parseUnits('1.029599997', 'gwei');

      logger.loading('Estimasi gas...');
      let gasLimit;
      try {
        const gasEstimate = await provider.estimateGas({
          to: CONTRACT_ADDRESS,
          data,
          from: wallet.address,
          value
        });
        gasLimit = BigInt(gasEstimate) * 15n / 10n;
        logger.success(`Gas terbatas di: ${gasLimit}`);
      } catch (error) {
        gasLimit = 300000n;
        logger.warn(`Estimasi gas gagal, menggunakan gas standar: ${gasLimit}`);
      }

      const gasCost = BigInt(gasPrice) * gasLimit;
      const requiredBalance = gasCost + BigInt(value);
      if (BigInt(balance) < requiredBalance) {
        throw new Error(`Saldo tidak mencukupi untuk melakukan transaksi saldo anda: ${formatEther(balance)} OG`);
      }

      logger.loading('Mengirim transaksi...');
      const nonce = await provider.getTransactionCount(wallet.address, 'latest');
      const txParams = {
        to: CONTRACT_ADDRESS,
        data,
        value,
        nonce,
        chainId: CHAIN_ID,
        gasPrice,
        gasLimit
      };

      const tx = await wallet.sendTransaction(txParams);
      const txLink = `${EXPLORER_URL}${tx.hash}`;
      logger.info(`Transaksi terkirim: ${tx.hash}`);
      logger.info(`Explorer: ${txLink}`);

      logger.loading(`Menunggu konfirmasi (${TIMEOUT_SECONDS}s)...`);
      let receipt;
      try {
        receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Waktu habis setelah ${TIMEOUT_SECONDS} detik`)), TIMEOUT_SECONDS * 1000))
        ]);
      } catch (error) {
        if (error.message.includes('Waktu habis')) {
          logger.warn(`Transaksi berakhir setelah ${TIMEOUT_SECONDS}s`);
          receipt = await provider.getTransactionReceipt(tx.hash);
          if (receipt && receipt.status === 1) {
            logger.success(`Konfirmasi transaksi pada blok ${receipt.blockNumber}`);
          } else {
            throw new Error(`Transaksi gagal atau tertunda: ${txLink}`);
          }
        } else {
          throw error;
        }
      }

      if (receipt.status === 1) {
        logger.success(`Mengonfirmasi transaksi pada blok ${receipt.blockNumber}`);
        logger.success(`File diunggah, root hash: ${imageData.root}`);
        return receipt;
      } else {
        throw new Error(`Transaksi gagal: ${txLink}`);
      }
    } catch (error) {
      logger.error(`Percobaan unggah ke ${attempt} gagal: ${error.message}`);
      if (attempt < MAX_RETRIES) {
        const delay = 10 + Math.random() * 20;
        logger.warn(`Mencoba kembali setelah ${delay.toFixed(2)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
        attempt++;
        continue;
      }
      throw error;
    }
  }
}

async function main() {
  try {
    logger.banner();
    loadPrivateKeys();
    loadProxies();

    logger.loading('Mengecek status jaringan');
    const network = await provider.getNetwork();
    if (BigInt(network.chainId) !== BigInt(CHAIN_ID)) {
      throw new Error(`ChainID tidak valid: permintaan ${CHAIN_ID}, dihasilkan ${network.chainId}`);
    }
    logger.success(`Terhubung ke jaringan: chainId ${network.chainId}`);

    const isNetworkSynced = await checkNetworkSync();
    if (!isNetworkSynced) {
      throw new Error('Jaringan tidak tersingkronisasi');
    }

    console.log(colors.cyan + "Wallet tersedia:" + colors.reset);
    privateKeys.forEach((key, index) => {
      const wallet = new ethers.Wallet(key);
      console.log(`${colors.green}[${index + 1}]${colors.reset} ${wallet.address}`);
    });
    console.log();

    rl.question('Berapa banyak file yang akan di unggah? ', async (count) => {
      count = parseInt(count);
      if (isNaN(count) || count <= 0) {
        logger.error('Angka tidak valid. tolong masukan lebih besar dari 0.');
        rl.close();
        process.exit(1);
        return;
      }

      const totalUploads = count * privateKeys.length;
      logger.info(`Memulai ${totalUploads} unggah (${count} per wallet)`);

      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      let successful = 0;
      let failed = 0;

      for (let walletIndex = 0; walletIndex < privateKeys.length; walletIndex++) {
        currentKeyIndex = walletIndex;
        const wallet = initializeWallet();
        logger.section(`Wallet diproses #${walletIndex + 1} [${wallet.address}]`);

        for (let i = 1; i <= count; i++) {
          const uploadNumber = (walletIndex * count) + i;
          logger.process(`Mengunggah ${uploadNumber} dari ${totalUploads} (Wallet ke #${walletIndex + 1}, Gambar ke #${i})`);

          try {
            const imageBuffer = await fetchRandomImage();
            const imageData = await prepareImageData(imageBuffer);
            await uploadToStorage(imageData, wallet, walletIndex);
            successful++;
            logger.success(`${uploadNumber} unggah selesai`);

            if (uploadNumber < totalUploads) {
              logger.loading('Melanjutkan ke proses berikutnya...');
              await delay(5000);
            }
          } catch (error) {
            failed++;
            logger.error(`Unggah ${uploadNumber} gagal: ${error.message}`);
            await delay(5000);
          }
        }

        if (walletIndex < privateKeys.length - 1) {
          logger.loading('Mengganti ke wallet berikutnya...');
          await delay(10000);
        }
      }

      logger.section('Ringkasan unggah');
      logger.summary(`Jumlah wallet: ${privateKeys.length}`);
      logger.summary(`Unggah per wallet: ${count}`);
      logger.summary(`Jumlah percobaan: ${totalUploads}`);
      if (successful > 0) logger.success(`Sukses terunggah: ${successful}`);
      if (failed > 0) logger.error(`Gagal terunggah: ${failed}`);
      logger.success('Semua operasi selesai');

      rl.close();
      process.exit(0);
    });

    rl.on('close', () => {
      logger.bye('Proses selesai ~ @ajie.s');
    });

  } catch (error) {
    logger.critical(`Error pada proses utama: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

main();