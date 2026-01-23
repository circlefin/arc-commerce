# Arc Commerce

Integrate USDC as a payment method for purchasing credits on Arc. This sample application uses Next.js, Supabase, and Circle Developer Controlled Wallets to demonstrate a credit purchase flow with USDC payments on Arc testnet.

<img width="830" height="646" alt="User dashboard for credit purchase" src="public/screenshot.png" />

## Prerequisites

- Node.js 20.x or newer
- npm (automatically installed when Node.js is installed)
- Docker (for running Supabase locally)
- [ngrok](https://ngrok.com/) (for local webhook testing)
- Circle Developer Controlled Wallets [API key](https://console.circle.com/signin) and [Entity Secret](https://developers.circle.com/wallets/dev-controlled/register-entity-secret)

## Getting Started

1. Clone the repository and install dependencies:

   ```bash
   git clone git@github.com:circlefin/arc-commerce.git
   cd arc-commerce
   npm install
   ```

2. Create a `.env.local` file in the project root:

   ```bash
   cp .env.example .env.local
   ```

   Required variables:

   ```bash
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Circle
   CIRCLE_API_KEY=your_circle_api_key
   CIRCLE_ENTITY_SECRET=your_entity_secret
   CIRCLE_BLOCKCHAIN=ARC-TESTNET
   CIRCLE_USDC_TOKEN_ID=15dc2b5d-0994-58b0-bf8c-3a0501148ee8

   # Misc
   ADMIN_EMAIL=admin@admin.com
   ```

3. Start Supabase locally:

   ```bash
   npx supabase start
   npx supabase migration up
   ```

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

   Add the webhook endpoint in Circle Console:
   - Navigate to Circle Console → Webhooks
   - Add endpoint: `https://your-ngrok-url.ngrok.io/api/circle/webhook`
   - Keep ngrok running to receive webhook events

## How It Works

- Built with [Next.js](https://nextjs.org/) and [Supabase](https://supabase.com/)
- Uses [Circle Developer Controlled Wallets](https://developers.circle.com/wallets/dev-controlled) for USDC transactions
- Wallet operations handled server-side with `@circle-fin/developer-controlled-wallets`
- Webhook signature verification ensures secure transaction notifications
- Admin wallet automatically initialized on first run

## Environment Variables

| Variable                              | Scope       | Purpose                                                                  |
| ------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`            | Public      | Supabase project URL                                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` | Public | Supabase anonymous/public key                                           |
| `SUPABASE_SERVICE_ROLE_KEY`           | Server-side | Service role for privileged database operations                          |
| `CIRCLE_API_KEY`                      | Server-side | Circle API key for webhook signature verification                        |
| `CIRCLE_ENTITY_SECRET`                | Server-side | Circle entity secret for wallet operations                               |
| `CIRCLE_BLOCKCHAIN`                   | Server-side | Blockchain network identifier (e.g., "ARC-TESTNET")                      |
| `CIRCLE_USDC_TOKEN_ID`                | Server-side | USDC token ID for the specified blockchain                               |
| `ADMIN_EMAIL`                         | Server-side | Email address that determines which user gets admin dashboard access     |

## Usage Notes

- Designed for Arc testnet only
- Requires valid Circle API credentials and Supabase configuration
- Admin wallet must have sufficient USDC and gas fees
- ngrok (or similar) required for local webhook testing

## Scripts

- `npm run dev`: Start Next.js development server with auto-reload
- `npx supabase start`: Start local Supabase instance
- `npx supabase migration up`: Apply database migrations

## Security & Usage Model

This sample application:
- Assumes testnet usage only
- Handles secrets via environment variables
- Verifies webhook signatures for security
- Is not intended for production use without modification

See `SECURITY.md` for vulnerability reporting guidelines. Please report issues privately via Circle's bug bounty program.