import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { nanoid } from 'nanoid';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CheckoutRequest {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  delivery: {
    address: string;
    borough: string;
    city: string;
    zip: string;
    date: string;
    time: string;
    instructions?: string;
  };
  items: CartItem[];
  paymentMethod: 'stripe' | 'paypal';
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const data: CheckoutRequest = await request.json();
    const { customer, delivery, items, paymentMethod } = data;

    // Validate items
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Check for custom cakes (price >= 150) and calculate deposit
    const hasCustomCakes = items.some(item => item.price >= 150);
    const customCakeTotal = items
      .filter(item => item.price >= 150)
      .reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const depositAmount = hasCustomCakes ? Math.ceil(customCakeTotal * 0.5 * 100) : 0; // In cents
    
    // Determine amount to charge (deposit for custom cakes, full amount otherwise)
    const amountToCharge = hasCustomCakes ? depositAmount : Math.ceil(subtotal * 100);

    // Generate order number
    const orderNumber = `DRH-${nanoid(8).toUpperCase()}`;

    // Get Stripe key from environment
    const stripeSecretKey = (locals as any).runtime?.env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      console.error('Stripe secret key not found');
      return new Response(JSON.stringify({ error: 'Payment configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecretKey);

    // Create line items for Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = hasCustomCakes
      ? [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Order Deposit (50%)',
                description: `Deposit for order ${orderNumber} - Balance due upon delivery`,
              },
              unit_amount: amountToCharge,
            },
            quantity: 1,
          },
        ]
      : items.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              images: item.image ? [item.image] : [],
            },
            unit_amount: Math.ceil(item.price * 100),
          },
          quantity: item.quantity,
        }));

    // Get base URL
    const baseUrl = (locals as any).runtime?.env?.SITE_URL || 'http://localhost:4321';

    if (paymentMethod === 'stripe') {
      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: lineItems,
        customer_email: customer.email,
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${orderNumber}`,
        cancel_url: `${baseUrl}/checkout?cancelled=true`,
        metadata: {
          orderNumber,
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerPhone: customer.phone,
          deliveryAddress: JSON.stringify(delivery),
          items: JSON.stringify(items),
          isDeposit: hasCustomCakes ? 'true' : 'false',
          totalAmount: subtotal.toString(),
          depositAmount: (depositAmount / 100).toString(),
        },
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: 0, currency: 'usd' },
              display_name: 'Free Delivery',
              delivery_estimate: {
                minimum: { unit: 'business_day', value: 1 },
                maximum: { unit: 'business_day', value: 5 },
              },
            },
          },
        ],
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (paymentMethod === 'paypal') {
      // For PayPal, we'd redirect to PayPal's checkout
      // For now, we'll create a Stripe session with PayPal payment method
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['paypal'],
        line_items: lineItems,
        customer_email: customer.email,
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${orderNumber}`,
        cancel_url: `${baseUrl}/checkout?cancelled=true`,
        metadata: {
          orderNumber,
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerPhone: customer.phone,
          deliveryAddress: JSON.stringify(delivery),
          items: JSON.stringify(items),
          isDeposit: hasCustomCakes ? 'true' : 'false',
          totalAmount: subtotal.toString(),
          depositAmount: (depositAmount / 100).toString(),
        },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid payment method' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
