import { NextResponse } from 'next/server';

// In-memory storage for events (in production, use a database)
let events: any[] = [];

export async function GET() {
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const event = await request.json();
  events.push({
    ...event,
    timestamp: Date.now(),
  });

  // Keep only last 100 events
  if (events.length > 100) {
    events = events.slice(-100);
  }

  return NextResponse.json({ success: true });
}
