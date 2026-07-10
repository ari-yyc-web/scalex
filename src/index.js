async function getGoogleAccessToken(clientEmail, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const unsignedToken = `${encode(header)}.${encode(claimSet)}`;

const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '')
    .trim();

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${unsignedToken}.${encodedSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handleAvailability(request, env) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!date) {
    return new Response(JSON.stringify({ error: 'date query param required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const accessToken = await getGoogleAccessToken(env.GOOGLE_CLIENT_EMAIL, env.GOOGLE_PRIVATE_KEY);

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
}

async function handleBook(request, env) {
  const body = await request.json();
  const { name, email, phone, service, startTime } = body;

  if (!name || !email || !startTime) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const accessToken = await getGoogleAccessToken(env.GOOGLE_CLIENT_EMAIL, env.GOOGLE_PRIVATE_KEY);

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

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Scalex <bookings@scalex.ink>',
      to: email,
      subject: `You're booked — ${start.toLocaleString('en-US', { timeZone: 'America/Edmonton', dateStyle: 'long', timeStyle: 'short' })}`,
      html: `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Stack+Sans+Headline&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body { background: #ffffff !important; margin: 0; padding: 0; }
  .logo-text {
    font-family: 'Stack Sans Headline', 'Century Gothic', 'Futura', -apple-system, sans-serif;
    font-size: 42px;
    letter-spacing: 2px;
    color: #ffffff;
    margin: 0;
  }
  @media screen and (max-width: 480px) {
    .email-container { width: 100% !important; }
    .header-title { font-size: 18px !important; }
    .content-padding { padding: 24px 16px !important; }
    .logo-text { font-size: 32px !important; }
    .footer-padding { padding: 32px 16px !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff;">
<tr><td align="center">
<table role="presentation" class="email-container" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <tr>
    <td bgcolor="#0a0a0a" style="background-color: #0a0a0a; padding: 32px 24px; text-align: center;">
      <h1 class="header-title" style="color: #ffffff; font-size: 20px; margin: 0;">You're all set, ${name.split(' ')[0]}!</h1>
    </td>
  </tr>
  <tr>
    <td class="content-padding" style="padding: 32px 24px;">
      <p style="font-size: 16px; color: #1a1a1a; line-height: 1.6;">
        Your call with Scalex is confirmed. Here's what to expect:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f5f5" style="background-color: #f5f5f5; border-radius: 8px;">
        <tr><td style="padding: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #7a7a7a; text-transform: uppercase; letter-spacing: 0.5px;">Date &amp; Time</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">
            ${start.toLocaleString('en-US', { timeZone: 'America/Edmonton', weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">
            ${start.toLocaleString('en-US', { timeZone: 'America/Edmonton', hour: 'numeric', minute: '2-digit' })} MT
          </p>
        </td></tr>
      </table>
      <p style="font-size: 15px; color: #5a5a5a; line-height: 1.6; margin-top: 20px;">
        We'll call you at <strong>${phone || 'the number you provided'}</strong> at that time — no need to dial in or click a link. Just be ready to chat for 15–30 minutes.
      </p>
      <p style="font-size: 15px; color: #5a5a5a; line-height: 1.6;">
        Need to reschedule or have a question before then? Just reply to this email or reach us at <a href="mailto:info@scalex.ink" style="color:#1a1a1a;">info@scalex.ink</a> or <a href="tel:+18253952510" style="color:#1a1a1a;">(825) 395-2510</a>.
      </p>
    </td>
  </tr>
  <tr>
    <td class="footer-padding" bgcolor="#0a0a0a" style="background-color: #0a0a0a; padding: 40px 24px; text-align: center;">
      <p class="logo-text">SCALEX</p>
      <p style="color: #aaaaaa; font-size: 12px; margin: 12px 0 0 0;">
        Digital services for small businesses.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`,

    }),
  });

  return new Response(JSON.stringify({ success: true, eventId: eventData.id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/availability' && request.method === 'GET') {
        return await handleAvailability(request, env);
      }
      if (url.pathname === '/api/book' && request.method === 'POST') {
        return await handleBook(request, env);
      }
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};