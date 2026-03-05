# Vessel Pay Frontend
Frontend web app for the Vessel Pay dApp built with Next.js that provides wallet onboarding, QR payments, swaps, top up IDRX or USDC via IDRX API and activity views for Base Sepolia and Etherlink Shadownet.

## Overview
Vessel Pay Frontend provides:

- **Multichain**: Support Base Sepolia and Etherlink Shadownet
- **Seamless Wallet Onboarding**: Automatic smart account initialization with zero manual steps
- **Gasless Transactions**: All transactions sponsored by paymaster (no native tokens required)
- **Multi-Token Support**: 9 stablecoins with automatic paymaster approval
- **Send & Receive**: Single transfer, batch transfer, and multi-token payments
- **ENS Support**: Send to Base mainnet and Etherlink mainnet ENS names (via mainnet resolver)
- **QR Payments**: Scan and generate payment requests
- **QRIS Supported**: Pay to QRIS (Quick Response Code Indonesian Standard)
- **Stablecoin Swaps**: Quote and execute swaps via StableSwap
- **IDRX Top Up**: IDRX API integration for top-up flow
- **Activity Views**: Recent transfers and payment receipts
- **Configurable Network + Tokens**: Chain, contract, and token metadata via env

## Architecture
### Core Modules
#### 1. **Next.js App Router** - UI Shell
Main UI under `src/app` with layouts and routes.

**Key Features:**

- App router pages and layouts
- Global styles and assets
- SSR/CSR support via Next.js

#### 2. **Web3 Provider** - Wallet + Chain Context
Wraps viem configuration and smart account hooks with automatic initialization.

**Key Features:**

- Chain and contract config from env
- Automatic smart account initialization (no manual activation required)
- Signature-based paymaster flow with automatic token approval
- Privy-based login with Base App wallet support
- Deterministic smart account address computation
- Lazy deployment on first transaction

#### 3. **API Clients** - Backend + On-chain Helpers
Frontend calls the backend signer and IDRX helpers.

**Key Features:**

- Signer API integration for paymaster signatures
- IDRX top-up requests (server-side API keys)
- Bundler health checks and retry logic

#### 4. **Feature Modules** - Payments + Swap UI
Composable UI for payments, swaps, and activity.

**Key Features:**

- QR scan and generate flows
- Send/receive (single + batch) and swap views
- Activity list and receipts
- Immediate feature access (no activation screens)

## Fee Structure
Frontend surfaces the same on-chain fee model defined in `vessel-sc`.

| Fee Type       | Rate          | Paid By | Token      |
| -------------- | ------------- | ------- | ---------- |
| Platform Fee   | 0.3% (30 BPS) | Payer   | Stablecoin |
| Swap Fee       | 0.1% (10 BPS) | User    | Stablecoin |

## Seamless Wallet Onboarding

Vessel Pay implements a zero-friction onboarding experience that eliminates manual activation steps.

### How It Works

1. **Connect Wallet**: User connects their wallet (Privy embedded or external)
2. **Automatic Initialization**: Smart account client initializes automatically in the background
3. **Deterministic Address**: Smart account address is computed deterministically (same address every time)
4. **Lazy Deployment**: Smart account deploys on-chain during the first transaction
5. **Immediate Access**: All features (swap, send, top-up) are immediately available

### Key Features

- **No Activation Screen**: Users never see a manual activation prompt
- **Gasless by Default**: All transactions are sponsored by the paymaster
- **Multi-Token Support**: 9 stablecoins automatically approved for gasless transactions
- **Backward Compatible**: Existing deployed smart accounts continue working seamlessly
- **Network Validation**: Automatic network switching to correct chain
- **Error Recovery**: Automatic retry logic for bundler failures

### Supported Tokens for Gasless Transactions

All transactions with these tokens are sponsored by the paymaster:

- USDC (USD Coin)
- USDS (Sky Dollar)
- EURC (Euro Coin)
- BRZ (Brazilian Digital)
- AUDD (Australian Dollar)
- CADC (Canadian Dollar)
- ZCHF (Swiss Franc)
- TGBP (Tokenised GBP)
- IDRX (Indonesian Rupiah)

### Error Messages and Recovery

Common errors and how to resolve them:

| Error | Cause | Recovery |
|-------|-------|----------|
| "Bundler RPC unreachable" | Network connectivity issue | Wait and retry (automatic retry after 2s) |
| "Please switch to {chain}" | Wrong network connected | Switch network in wallet |
| "Token not supported by paymaster" | Using unsupported token | Use one of the 9 supported tokens |
| "Insufficient balance to cover amount + gas fee" | Not enough tokens for transaction + gas | Add more tokens or reduce amount |
| "Rate limit reached" | Too many requests to bundler | Wait 1 minute and retry |
| "Paymaster deposit too low" | Paymaster needs ETH refill | Contact support (operator issue) |

### Technical Details

**Smart Account:**
- Uses ERC-4337 SimpleAccount implementation
- Deterministic address via CREATE2 (factory + owner + salt)
- EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

**Paymaster:**
- Signature-based validation (no on-chain allowance required for gas)
- Supports 9 stablecoins for gas payment
- Requires ETH deposit in EntryPoint for sponsorship

**Bundler:**
- Pimlico bundler service
- Automatic health checks on initialization
- Retry logic for network failures (1 retry with 2s delay)

## Setup & Installation
### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# From repo root
cd vessel-fe

# Install dependencies
npm install
```

### Environment Setup
Create a `.env` file in the root directory:

```bash
#=====================================================
# Environment Variables for Vessel Pay Frontend
#=====================================================
NEXT_PUBLIC_PIMLICO_API_KEY=
NEXT_PUBLIC_SIGNER_API_URL=http://localhost:3001
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_DEFAULT_TOKEN_SYMBOL=USDC
NEXT_PUBLIC_DEFAULT_CHAIN=etherlink

IDRX_API_KEY=
IDRX_SECRET_KEY=
IDRX_BASE_URL=https://idrx.co/api
IDRX_NETWORK_CHAIN_ID=8453
IDRX_NETWORK_CHAIN_ID_ETHERLINK=42793

#=====================================================
# Base Sepolia Testnet Configuration
#=====================================================
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_CHAIN_NAME=Base Sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_MAINNET_RPC_URL=https://ethereum-rpc.publicnode.com
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=Blockscout
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://base-sepolia.blockscout.com
NEXT_PUBLIC_NATIVE_CURRENCY_NAME=Ether
NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL=ETH
NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS=18

NEXT_PUBLIC_ENTRY_POINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY=
NEXT_PUBLIC_PAYMASTER_ADDRESS=
NEXT_PUBLIC_STABLE_SWAP_ADDRESS=
NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS=
NEXT_PUBLIC_STABLECOIN_REGISTRY_ADDRESS=
NEXT_PUBLIC_QRIS_REGISTRY_ADDRESS=

NEXT_PUBLIC_TOKEN_USDC_ADDRESS=
NEXT_PUBLIC_TOKEN_USDC_DECIMALS=6
NEXT_PUBLIC_TOKEN_USDS_ADDRESS=
NEXT_PUBLIC_TOKEN_USDS_DECIMALS=6
NEXT_PUBLIC_TOKEN_EURC_ADDRESS=
NEXT_PUBLIC_TOKEN_EURC_DECIMALS=6
NEXT_PUBLIC_TOKEN_BRZ_ADDRESS=
NEXT_PUBLIC_TOKEN_BRZ_DECIMALS=6
NEXT_PUBLIC_TOKEN_AUDD_ADDRESS=
NEXT_PUBLIC_TOKEN_AUDD_DECIMALS=6
NEXT_PUBLIC_TOKEN_CADC_ADDRESS=
NEXT_PUBLIC_TOKEN_CADC_DECIMALS=6
NEXT_PUBLIC_TOKEN_ZCHF_ADDRESS=
NEXT_PUBLIC_TOKEN_ZCHF_DECIMALS=6
NEXT_PUBLIC_TOKEN_TGBP_ADDRESS=
NEXT_PUBLIC_TOKEN_TGBP_DECIMALS=18
NEXT_PUBLIC_TOKEN_IDRX_ADDRESS=
NEXT_PUBLIC_TOKEN_IDRX_DECIMALS=6
NEXT_PUBLIC_ACTIVITY_LOOKBACK_BLOCKS=20000

# =====================================================
# Etherlink Shadownet Testnet Configuration
# =====================================================
NEXT_PUBLIC_CHAIN_ID_ETHERLINK=127823
NEXT_PUBLIC_CHAIN_NAME_ETHERLINK=Etherlink Shadownet
NEXT_PUBLIC_RPC_URL_ETHERLINK=https://node.shadownet.etherlink.com
NEXT_PUBLIC_MAINNET_RPC_URL_ETHERLINK=https://ethereum-rpc.publicnode.com
NEXT_PUBLIC_BLOCK_EXPLORER_NAME_ETHERLINK=Etherlink Explorer
NEXT_PUBLIC_BLOCK_EXPLORER_URL_ETHERLINK=https://shadownet.explorer.etherlink.com
NEXT_PUBLIC_NATIVE_CURRENCY_NAME_ETHERLINK=Tezos
NEXT_PUBLIC_NATIVE_CURRENCY_SYMBOL_ETHERLINK=XTZ
NEXT_PUBLIC_NATIVE_CURRENCY_DECIMALS_ETHERLINK=18

NEXT_PUBLIC_ENTRY_POINT_ADDRESS_ETHERLINK=0x0000000071727De22E5E9d8BAf0edAc6f37da032
NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY_ETHERLINK=
NEXT_PUBLIC_PAYMASTER_ADDRESS_ETHERLINK=
NEXT_PUBLIC_STABLE_SWAP_ADDRESS_ETHERLINK=
NEXT_PUBLIC_PAYMENT_PROCESSOR_ADDRESS_ETHERLINK=
NEXT_PUBLIC_STABLECOIN_REGISTRY_ADDRESS_ETHERLINK=
NEXT_PUBLIC_QRIS_REGISTRY_ADDRESS_ETHERLINK=

NEXT_PUBLIC_TOKEN_USDT_ADDRESS_ETHERLINK=
NEXT_PUBLIC_TOKEN_USDT_DECIMALS_ETHERLINK=6
NEXT_PUBLIC_TOKEN_USDC_ADDRESS_ETHERLINK=
NEXT_PUBLIC_TOKEN_USDC_DECIMALS_ETHERLINK=6
NEXT_PUBLIC_TOKEN_IDRX_ADDRESS_ETHERLINK=
NEXT_PUBLIC_TOKEN_IDRX_DECIMALS_ETHERLINK=6

NEXT_PUBLIC_ACTIVITY_LOOKBACK_BLOCKS_ETHERLINK=20000
```

Note: Use `.env.example` for the full list of token variables.

## Deployment
### Run Locally (Dev)

```bash
npm run dev
```

### Build Production

```bash
npm run build
```

### Run Production Server

```bash
npm run start
```

## Network Information
### Base Sepolia Testnet

- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Block Explorer**: https://base-sepolia.blockscout.com
- **EntryPoint v0.7**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

### Etherlink Shadownet Testnet

- **Chain ID**: 127823
- **RPC URL**: https://node.shadownet.etherlink.com
- **Block Explorer**: https://shadownet.explorer.etherlink.com
- **Faucet**: https://shadownet.faucet.etherlink.com/

### ENS Resolution

- ENS lookups use `NEXT_PUBLIC_MAINNET_RPC_URL` (Base mainnet) and `NEXT_PUBLIC_MAINNET_RPC_URL_ETHERLINK` (Etherlink mainnet).

## Supported Stablecoins

| Symbol | Name               | Decimals | Region |
| ------ | ------------------ | -------- | ------ |
| USDC   | USD Coin          | 6        | US     |
| USDS   | Sky Dollar        | 6        | US     |
| EURC   | Euro Coin         | 6        | EU     |
| BRZ    | Brazilian Digital | 6        | BR     |
| AUDD   | AUDD              | 6        | AU     |
| CADC   | CAD Coin          | 6        | CA     |
| ZCHF   | Frankencoin       | 6        | CH     |
| TGBP   | Tokenised GBP     | 18       | GB     |
| IDRX   | Indonesia Rupiah  | 6        | ID     |

## Contract Addresses
### Base Sepolia (Testnet)

```
EntryPoint:            0x0000000071727De22E5E9d8BAf0edAc6f37da032
StablecoinRegistry:    0x573f4D2b5e9E5157693a9Cc0008FcE4e7167c584
Paymaster:             0x1b14BF9ab47069a77c70Fb0ac02Bcb08A9Ffe290
StableSwap:            0x822e1dfb7bf410249b2bE39809A5Ae0cbfae612f
PaymentProcessor:      0x4D053b241a91c4d8Cd86D0815802F69D34a0164B
SimpleAccountFactory:  0xfEA9DD0034044C330c0388756Fd643A5015d94D2
QRISRegistry:          0x5268D80f943288bBe50fc20142e09EcC9B6b1F3e

Mock Tokens:
  USDC:  0x74FB067E49CBd0f97Dc296919e388CB3CFB62b4D
  USDS:  0x79f3293099e96b840A0423B58667Bc276Ea19aC0
  EURC:  0xfF4dD486832201F6DC41126b541E3b47DC353438
  BRZ:   0x9d30F685C04f024f84D9A102d0fE8dF348aE7E7d
  AUDD:  0x9f6b8aF49747304Ce971e2b9d131B2bcd1841d83
  CADC:  0x6BB3FFD9279fBE76FE0685Df7239c23488bC96e4
  ZCHF:  0xF27edF22FD76A044eA5B77E1958863cf9A356132
  tGBP:  0xb4db79424725256a6E6c268fc725979b24171857
  IDRX:  0x34976B6c7Aebe7808c7Cab34116461EB381Bc2F8
```

### Etherlink Shadownet (Testnet)

```
EntryPoint:            0x0000000071727De22E5E9d8BAf0edAc6f37da032
StablecoinRegistry:    0x6fe372ef0B695ec05575D541e0DA60bf18A3D0f0
Paymaster:             0xFC7E8c60315e779b1109B252fcdBFB8f3524F9B6
StableSwap:            0xB67b210dEe4C1A744c1d51f153b3B3caF5428F60
PaymentProcessor:      0x5D4748951fB0AF37c57BcCb024B3EE29360148bc
SimpleAccountFactory:  0xb7E56FbAeC1837c5693AAf35533cc94e35497d86
QRISRegistry:          0xD17d8f2819C068A57f0F4674cF439d1eC96C56f5

Mock Tokens:
  USDC:  0x60E48d049EB0c75BF428B028Da947c66b68f5dd2
  USDT:  0xcaF86109F34d74DE0e554FD5E652C412517374fb
  IDRX:  0x8A272505426D4F129EE3493A837367B884653237
```

## Security Considerations

- **Public Env Vars**: `NEXT_PUBLIC_*` values are exposed to the browser. Do not put secrets here.
- **API Keys**: `IDRX_*` values are server-side only; do not expose them in `NEXT_PUBLIC_*`.
- **Network Mismatch**: Keep contract addresses aligned with the selected chain.
- **QR Validation**: Validate and sanitize QR payloads before use.

## Development
### Code Style
This project uses:

- TypeScript
- Next.js App Router
- Tailwind CSS
- wagmi/viem + Privy for wallet/auth

### Testing

The project includes comprehensive test coverage for the seamless onboarding feature:

**Unit Tests:**
- Smart account initialization
- Network validation and switching
- EntryPoint validation
- Bundler health checks
- Paymaster deposit verification
- Token validation
- Error handling

**Property-Based Tests:**
- Activation flow properties
- Paymaster signature integration
- Token validation across all supported tokens

**Integration Tests:**
- End-to-end activation flow
- Backend integration with signer API
- Frontend modal behavior

**Running Tests:**

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- activation-unit.test.ts

# Run with coverage
npm test -- --coverage
```

**Test Coverage:**
- Line coverage: >80%
- Branch coverage: >75%
- Function coverage: >85%

### Project Structure

```
vessel-fe/
|-- src/
|   |-- app/              # Next.js app router pages
|   |-- components/       # UI components
|   |-- config/           # Chain, ABI, and env config
|   |-- hooks/            # Web3 hooks (useSmartAccount, useActiveChain)
|   |-- api/              # Backend API helpers (signerApi)
|   |-- lib/              # Utilities (paymasterData, wallet-activation-check)
|   |-- __tests__/        # Test files
|-- public/               # Static assets
|-- package.json
|-- next.config.ts
```

## License
MIT License - see LICENSE file for details
