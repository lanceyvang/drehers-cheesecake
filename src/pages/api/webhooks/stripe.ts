import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createDb } from '../../../lib/db';
import { orders, orderItems } from '../../../db/schema';
import { nanoid } from 'nanoid';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface DeliveryAddress {
  address: string;
  borough: string;
  city: string;
  zip: string;
  date: string;
  time: string;
  instructions?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as any).runtime;
  const env = runtime?.env;

  // Get Stripe keys from environment
  const stripeSecretKey = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  const webhookSecret = env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Stripe configuration missing');
    return new Response('Webhook configuration error', { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);

  // Get the raw body and signature
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('No Stripe signature found');
    return new Response('No signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${message}`);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      
      try {
        await handleCheckoutSessionCompleted(session, env);
        console.log(`Order created for session ${session.id}`);
      } catch (error) {
        console.error('Error handling checkout session:', error);
        // Return 200 to acknowledge receipt but log the error
        // Stripe will not retry on 200, so we handle errors separately
      }
      break;
    }

    case 'payment_intent.succeeded': {
      // Can be used for additional confirmation logic
      console.log('Payment intent succeeded:', event.data.object.id);
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.error('Payment failed:', paymentIntent.id, paymentIntent.last_payment_error?.message);
      // Could update order status to 'payment_failed' if needed
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  // Return 200 to acknowledge receipt of the event
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  env: any
) {
  const metadata = session.metadata;
  
  if (!metadata) {
    throw new Error('No metadata in checkout session');
  }

  const {
    orderNumber,
    customerName,
    customerPhone,
    deliveryAddress: deliveryAddressJson,
    items: itemsJson,
    isDeposit,
    totalAmount,
    depositAmount,
  } = metadata;

  // Parse JSON fields
  const deliveryAddress: DeliveryAddress = JSON.parse(deliveryAddressJson || '{}');
  const items: CartItem[] = JSON.parse(itemsJson || '[]');

  // Get database connection
  const db = createDb(env.DB);

  // Determine order status based on payment type
  const orderStatus = isDeposit === 'true' ? 'deposit_paid' : 'confirmed';
  const subtotal = parseFloat(totalAmount || '0');
  const deposit = parseFloat(depositAmount || '0');
  const amountPaid = session.amount_total ? session.amount_total / 100 : 0;

  // Create order record
  const orderId = nanoid();
  
  await db.insert(orders).values({
    id: orderId,
    orderNumber: orderNumber || `DRH-${nanoid(8).toUpperCase()}`,
    guestEmail: session.customer_email || session.customer_details?.email || undefined,
    guestName: customerName || session.customer_details?.name || undefined,
    guestPhone: customerPhone || session.customer_details?.phone || undefined,
    status: orderStatus,
    subtotal: subtotal,
    depositAmount: deposit > 0 ? deposit : null,
    depositPaid: isDeposit === 'true',
    totalAmount: subtotal,
    amountPaid: amountPaid,
    paymentMethod: 'stripe',
    stripePaymentIntentId: session.payment_intent as string || null,
    deliveryBorough: deliveryAddress.borough || null,
    deliveryAddress: deliveryAddressJson || null,
    deliveryDate: deliveryAddress.date || null,
    deliveryTime: deliveryAddress.time || null,
    specialInstructions: deliveryAddress.instructions || null,
  });

  // Create order items
  for (const item of items) {
    await db.insert(orderItems).values({
      id: nanoid(),
      orderId: orderId,
      productId: item.id,
      productName: item.name,
      quantity: item.quantity,
      priceAtPurchase: item.price,
    });
  }

  // Send confirmation email (if Resend is configured)
  const resendApiKey = env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
  
  if (resendApiKey && session.customer_email) {
    try {
      await sendOrderConfirmationEmail({
        resendApiKey,
        customerEmail: session.customer_email,
        customerName: customerName || 'Valued Customer',
        orderNumber: orderNumber!,
        items,
        subtotal,
        amountPaid,
        isDeposit: isDeposit === 'true',
        deliveryDate: deliveryAddress.date,
        deliveryBorough: deliveryAddress.borough,
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't throw - order is still created successfully
    }
  }

  return { orderId, orderNumber };
}

interface EmailParams {
  resendApiKey: string;
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  amountPaid: number;
  isDeposit: boolean;
  deliveryDate?: string;
  deliveryBorough?: string;
}

async function sendOrderConfirmationEmail({
  resendApiKey,
  customerEmail,
  customerName,
  orderNumber,
  items,
  subtotal,
  amountPaid,
  isDeposit,
  deliveryDate,
  deliveryBorough,
}: EmailParams) {
  const { Resend } = await import('resend');
  const resend = new Resend(resendApiKey);

  const itemsList = items
    .map((item) => `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`)
    .join('\n');

  const balanceDue = isDeposit ? subtotal - amountPaid : 0;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Georgia', serif; line-height: 1.6; color: #3d2314; background-color: #faf7f2; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #3d2314; }
        .logo span { color: #c9a227; }
        .order-box { background: white; border-radius: 12px; padding: 30px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .order-number { font-size: 14px; color: #c9a227; text-transform: uppercase; letter-spacing: 1px; }
        h1 { color: #3d2314; margin: 10px 0; }
        .items { border-top: 1px solid #ede8df; border-bottom: 1px solid #ede8df; padding: 20px 0; margin: 20px 0; }
        .item { display: flex; justify-content: space-between; margin: 8px 0; }
        .totals { margin-top: 20px; }
        .total-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .total-row.highlight { font-weight: bold; font-size: 18px; color: #3d2314; border-top: 2px solid #c9a227; padding-top: 10px; margin-top: 10px; }
        .balance { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .delivery { background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .btn { display: inline-block; background: #3d2314; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Dreher's <span>Cheesecake</span></div>
          <p style="color: #6b7280; margin-top: 5px;">Brooklyn's Finest Since 2015</p>
        </div>
        
        <div class="order-box">
          <div class="order-number">Order Confirmation</div>
          <h1>Thank You, ${customerName}!</h1>
          <p>Your order <strong>${orderNumber}</strong> has been ${isDeposit ? 'received' : 'confirmed'}.</p>
          
          <div class="items">
            <h3 style="margin-top: 0;">Order Details</h3>
            ${items.map((item) => `
              <div class="item">
                <span>${item.name} x${item.quantity}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="totals">
            <div class="total-row">
              <span>Subtotal</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Delivery</span>
              <span>FREE</span>
            </div>
            ${isDeposit ? `
            <div class="total-row">
              <span>Deposit Paid (50%)</span>
              <span>$${amountPaid.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row highlight">
              <span>${isDeposit ? 'Amount Paid' : 'Total'}</span>
              <span>$${amountPaid.toFixed(2)}</span>
            </div>
          </div>
          
          ${isDeposit ? `
          <div class="balance">
            <strong>Balance Due on Delivery: $${balanceDue.toFixed(2)}</strong>
            <p style="margin: 5px 0 0; font-size: 14px; color: #92400e;">We accept cash, card, Venmo, or Zelle</p>
          </div>
          ` : ''}
          
          ${deliveryDate ? `
          <div class="delivery">
            <strong>📍 Delivery Details</strong>
            <p style="margin: 10px 0 0;">
              ${deliveryDate}${deliveryBorough ? ` • ${deliveryBorough}` : ''}
            </p>
          </div>
          ` : ''}
        </div>
        
        <div style="text-align: center;">
          <a href="https://dreherscheesecake.com/account" class="btn">Track Your Order</a>
        </div>
        
        <div class="footer">
          <p>Questions? Reply to this email or call us at (718) 555-CAKE</p>
          <p style="margin-top: 20px;">
            Dreher's Cheesecake LLC<br>
            Brooklyn, NY<br>
            <a href="https://instagram.com/DrehersCheesecake" style="color: #c9a227;">@DrehersCheesecake</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: 'Dreher\'s Cheesecake <orders@dreherscheesecake.com>',
    to: [customerEmail],
    subject: `Order Confirmed: ${orderNumber} 🍰`,
    html: emailHtml,
  });
}
