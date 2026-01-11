# Dreher's Cheesecake - Deployment Guide

This guide walks you through deploying the Dreher's Cheesecake e-commerce website to Cloudflare Pages.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Stripe account](https://dashboard.stripe.com/register)
- [Resend account](https://resend.com/signup) (for emails)
- Node.js 18+ installed
- Wrangler CLI installed (`npm install -g wrangler`)

## Step 1: Create Cloudflare Resources

### 1.1 Login to Wrangler

```bash
npx wrangler login
```

### 1.2 Create D1 Database

```bash
npx wrangler d1 create drehers-cheesecake-db
```

Copy the `database_id` from the output and update `wrangler.jsonc`.

### 1.3 Create KV Namespace (for sessions)

```bash
npx wrangler kv namespace create SESSION
```

Copy the `id` from the output and update `wrangler.jsonc`.

### 1.4 Update wrangler.jsonc

Replace placeholder IDs with your actual IDs:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "drehers-cheesecake-db",
      "database_id": "your-actual-database-id"  // <-- Update this
    }
  ],
  "kv_namespaces": [
    {
      "binding": "SESSION",
      "id": "your-actual-kv-id"  // <-- Update this
    }
  ]
}
```

## Step 2: Set Up Database

### 2.1 Push Schema to D1

```bash
# Generate SQL migrations
npx drizzle-kit generate

# Push to D1 (remote)
npx wrangler d1 execute drehers-cheesecake-db --remote --file=./drizzle/0000_*.sql
```

Or use Drizzle push:

```bash
npx drizzle-kit push
```

## Step 3: Configure Environment Variables

In the [Cloudflare Dashboard](https://dash.cloudflare.com):

1. Go to **Workers & Pages** > **drehers-cheesecake** > **Settings** > **Variables**
2. Add these **Secrets** (encrypted):

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | From Stripe Dashboard > Developers > API Keys |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard > Developers > Webhooks |
| `RESEND_API_KEY` | From Resend Dashboard > API Keys |
| `AUTH_SECRET` | Random 32+ character string (use `openssl rand -base64 32`) |

3. Add these **Variables** (plain text):

| Variable | Value |
|----------|-------|
| `SITE_URL` | `https://your-domain.com` |

## Step 4: Configure Stripe Webhooks

1. Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Set endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** and add to Cloudflare as `STRIPE_WEBHOOK_SECRET`

## Step 5: Deploy

### Option A: Manual Deploy

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist
```

### Option B: GitHub Integration (Recommended)

1. Push your code to GitHub
2. In Cloudflare Dashboard:
   - Go to **Workers & Pages** > **Create** > **Pages**
   - Connect to GitHub
   - Select your repository
3. Configure build settings:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Click **Save and Deploy**

## Step 6: Custom Domain (Optional)

1. In Cloudflare Dashboard:
   - Go to **Workers & Pages** > **drehers-cheesecake** > **Custom domains**
   - Click **Set up a custom domain**
2. Enter your domain (e.g., `dreherscheesecake.com`)
3. If domain is on Cloudflare, DNS will be configured automatically
4. If domain is elsewhere, add the provided CNAME record

## Step 7: Verify Deployment

### Test Checklist

- [ ] Homepage loads correctly
- [ ] Products page shows products
- [ ] Cart functionality works
- [ ] Checkout redirects to Stripe
- [ ] User registration works
- [ ] Admin panel accessible (for admin users)
- [ ] Order confirmation emails send

### Test Stripe Payments

Use Stripe test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC
- Any 5-digit ZIP

## Troubleshooting

### "Invalid binding `SESSION`"

Make sure KV namespace is configured in wrangler.jsonc and deployed.

### Database errors

Verify D1 database is created and schema is pushed:

```bash
npx wrangler d1 execute drehers-cheesecake-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Environment variables not working

Check that secrets are added in Cloudflare Dashboard (not in wrangler.jsonc for sensitive values).

### Webhook errors

1. Verify webhook URL is correct
2. Check webhook secret matches `STRIPE_WEBHOOK_SECRET`
3. View webhook logs in Stripe Dashboard

## Going Live

Before going live with real payments:

1. Switch from Stripe test keys to live keys
2. Update `SITE_URL` to production domain
3. Update Stripe webhook endpoint to production URL
4. Test with a small real transaction
5. Set up Stripe fraud protection

## Support

For issues with:
- **Cloudflare**: [Cloudflare Community](https://community.cloudflare.com/)
- **Stripe**: [Stripe Support](https://support.stripe.com/)
- **Astro**: [Astro Discord](https://astro.build/chat)
