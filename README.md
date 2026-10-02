# Arc Commerce

Integrate USDC as a payment method for purchasing credits on Arc. This sample application uses Next.js, Supabase, and Circle Developer Controlled Wallets to demonstrate a credit purchase flow with USDC payments on Arc testnet.

<img width="830" height="646" alt="User dashboard for credit purchase" src="public/screenshot.png" />

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Environment Variables](#environment-variables)
- [User Accounts](#user-accounts)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Security & Usage Model](#security--usage-model)

## Prerequisites

- **Node.js v22+** — Install via [nvm](https://github.com/nvm-sh/nvm) (`nvm use` will read the `.nvmrc` file)
- **Docker Desktop** — Runs Supabase locally. [Install Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **[ngrok](https://ngrok.com/)** - for local webhook testing)
- Circle Developer Controlled Wallets **[API key](https://console.circle.com/signin)** and **[Entity Secret](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)**

## Getting Started

1. Clone the repository and install dependencies:

   ```bash
   git clone git@github.com:akelani-circle/arc-commerce.git
   cd arc-commerce
   npm install
   ```

2. Start the local Supabase instance (requires Docker Desktop running):

   ```bash
   npx supabase start
   npx supabase migration up
   ```

   The output of `npx supabase start` will display the Supabase URL and API keys needed in the next step.

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` and fill in all required values. Use the Supabase URL and keys from the previous step's output (see [Environment Variables](#environment-variables) section below).

4. Start the development server:

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`. The admin wallet is automatically created on first startup.

5. Set up Circle Webhooks (for local development):

   In a separate terminal, expose your local server:

   ```bash
   ngrok http 3000
   ```

   Copy the HTTPS URL from ngrok (e.g., `https://your-ngrok-url.ngrok.io`) and add it to your Circle Console webhooks section:
   - Navigate to Circle Console → Webhooks
   - Add a new webhook endpoint: `https://your-ngrok-url.ngrok.io/api/circle/webhook`
   - Keep ngrok running while developing to receive webhook events

## How It Works

- Built with [Next.js](https://nextjs.org/) and [Supabase](https://supabase.com/)
- Uses [Circle Developer Controlled Wallets](https://developers.circle.com/wallets/dev-controlled) for USDC transactions
- Wallet operations handled server-side with `@circle-fin/developer-controlled-wallets`
- Admin transfers use `@circle-fin/app-kit` with the Circle Wallets adapter: `kit.send` for same-chain transfers and `kit.bridge` for cross-chain transfers
- User payments are sent from the browser with [wagmi](https://wagmi.sh/) and [viem](https://viem.sh/); the server verifies the transaction receipt before granting credits
- Webhook signature verification ensures secure transaction notifications
- Admin wallet automatically initialized on first run

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# Circle
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_BLOCKCHAIN=ARC-TESTNET

# Misc
ADMIN_EMAIL=admin@admin.com
```

| Variable                              | Scope       | Purpose                                                                  |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`            | Public      | Supabase project URL.                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public     | Supabase publishable key.                                                |
| `SUPABASE_SECRET_KEY`           | Server-side | Secret key for privileged writes (e.g., transaction inserts).                  |
| `CIRCLE_API_KEY`                      | Server-side | Used to fetch Circle webhook public keys for signature verification.     |
| `CIRCLE_ENTITY_SECRET`                | Server-side | Circle entity secret for wallet operations.                              |
| `CIRCLE_BLOCKCHAIN`                   | Server-side | Blockchain network identifier (e.g., "ARC-TESTNET").                     |
| `ADMIN_EMAIL`                         | Server-side | Admin user email address.                                                |

## User Accounts

### Admin Account

On first startup, an admin user is automatically created with the following credentials:

- **Email:** `admin@admin.com`
- **Password:** `123456`

The admin account has access to the **Admin Dashboard**, which provides an overview of all users, wallets, and transactions in the system.

Regular users who sign up will see the **User Dashboard**, which allows them to purchase credits with USDC and view their own transaction history.

### Signup Rate Limits

Supabase limits email signups to **2 per hour** by default (unless custom SMTP is configured). If you hit an "email rate limit exceeded" error during testing:

Email verification is handled by the built-in [Inbucket](http://127.0.0.1:54324) mail server — check it to confirm signups. The rate limit can be adjusted in `supabase/config.toml` under `[auth.rate_limit]`.

## Available Scripts

- `npm run dev`: Start Next.js development server with auto-reload
- `npx supabase start`: Start local Supabase instance
- `npx supabase migration up`: Apply database migrations
- `npm test`: Run the unit tests (no services needed)
- `npm run test:integration`: Run database tests against the local Supabase

## Testing

Unit tests live in `tests/unit` and mock Supabase, Circle and the chain. Integration tests in `tests/integration` run against the local Supabase stack and read connection settings from `.env.local`.

## Security & Usage Model

This sample application:
- Assumes testnet usage only
- Handles secrets via environment variables
- Verifies webhook signatures for security
- Is not intended for production use without modification

See `SECURITY.md` for vulnerability reporting guidelines. Please report issues privately via Circle's bug bounty program.

## Legal

Sample apps provided for demonstration and educational purposes only, intended for Arc testnet use only, and not production-ready. See [Arc.io](https://arc.io) for more.
