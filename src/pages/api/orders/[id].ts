import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db';
import { orders, orderItems } from '../../../db/schema';
import { eq } from 'drizzle-orm';

// This is a server-rendered API route
export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Order ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const runtime = (locals as any).runtime;
    const db = createDb(runtime.env.DB);

    // Find order by orderNumber or id
    const order = await db.query.orders.findFirst({
      where: (orders, { or, eq }) => 
        or(eq(orders.orderNumber, id), eq(orders.id, id)),
    });

    if (!order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get order items
    const items = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, order.id),
    });

    // Parse delivery address
    let deliveryAddress = null;
    if (order.deliveryAddress) {
      try {
        deliveryAddress = JSON.parse(order.deliveryAddress);
      } catch {
        deliveryAddress = { address: order.deliveryAddress };
      }
    }

    const response = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      items: items.map((item) => ({
        id: item.productId,
        name: item.productName,
        quantity: item.quantity,
        price: item.priceAtPurchase,
      })),
      subtotal: order.subtotal,
      totalAmount: order.totalAmount,
      depositAmount: order.depositAmount,
      depositPaid: order.depositPaid,
      amountPaid: order.amountPaid,
      delivery: {
        ...deliveryAddress,
        borough: order.deliveryBorough,
        date: order.deliveryDate,
        time: order.deliveryTime,
      },
      specialInstructions: order.specialInstructions,
      createdAt: order.createdAt,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch order' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
