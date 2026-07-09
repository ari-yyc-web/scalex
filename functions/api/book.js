import { getGoogleAccessToken } from './_google-auth.js';

export async function onRequestPost({ request, env }) {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  try {
    const body = await request.json();
    const { name, email, phone, service, startTime } = body;

    if (!name || !email || !startTime) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const accessToken = await getGoogleAccessToken(
      env.GOOGLE_CLIENT_EMAIL,
      env.GOOGLE_PRIVATE_KEY
    );

    const start = new Date(startTime);
    const end = new Date(start.getTime() + 30 * 60000);
    const calendarId = encodeURIComponent(env.GOOGLE_CALENDAR_ID);

    const insertRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `Scalex Call — ${name}`,
          description: `Service interested in: ${service || 'Not specified'}\nPhone: ${phone || 'N/A'}\nEmail: ${email}`,
          start: { dateTime: start.toISOString(), timeZone: 'America/Edmonton' },
          end: { dateTime: end.toISOString(), timeZone: 'America/Edmonton' },
        }),
      }
    );

    const eventData = await insertRes.json();
    if (!insertRes.ok) throw new Error(JSON.stringify(eventData));

    // Send confirmation email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Scalex <bookings@scalex.ink>',
        to: email,
        subject: 'Your call with Scalex is confirmed',
        html: `<p>Hi ${name},</p><p>Your call is booked for <strong>${start.toLocaleString('en-US', { timeZone: 'America/Edmonton', dateStyle: 'full', timeStyle: 'short' })}</strong>.</p><p>Talk soon,<br/>Scalex</p>`,
      }),
    });

    return new Response(JSON.stringify({ success: true, eventId: eventData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}