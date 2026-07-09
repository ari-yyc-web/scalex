import { getGoogleAccessToken } from './_google-auth.js';

export async function onRequestGet({ request, env }) {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    if (!date) {
      return new Response(JSON.stringify({ error: 'date query param required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const accessToken = await getGoogleAccessToken(
      env.GOOGLE_CLIENT_EMAIL,
      env.GOOGLE_PRIVATE_KEY
    );

    const dayStart = new Date(`${date}T09:00:00-06:00`);
    const dayEnd = new Date(`${date}T17:00:00-06:00`);

    const calendarId = encodeURIComponent(env.GOOGLE_CALENDAR_ID);
    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${dayStart.toISOString()}&timeMax=${dayEnd.toISOString()}&singleEvents=true&orderBy=startTime`;

    const eventsRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const eventsData = await eventsRes.json();

    const busy = (eventsData.items || []).map((e) => ({
      start: new Date(e.start.dateTime || e.start.date),
      end: new Date(e.end.dateTime || e.end.date),
    }));

    const slots = [];
    let cursor = new Date(dayStart);
    while (cursor < dayEnd) {
      const slotEnd = new Date(cursor.getTime() + 30 * 60000);
      const overlaps = busy.some((b) => cursor < b.end && slotEnd > b.start);
      if (!overlaps) slots.push(cursor.toISOString());
      cursor = slotEnd;
    }

    return new Response(JSON.stringify({ date, slots }), {
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}