export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const target = body.url;
  if (!target) return json({ error: "Missing url" }, 400);

  if (isYouTube(target)) {
    return json({ ok: false, reason: "YouTube URLs are not supported." }, 200);
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: "Invalid URL" }, 400);
  }

  let res;
  try {
    res = await fetch(parsed.toString(), { method: "HEAD", redirect: "follow" });
  } catch {
    return json({ ok: false, reason: "Could not reach the URL." }, 200);
  }

  if (!res || res.status >= 400) {
    try {
      res = await fetch(parsed.toString(), {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
      });
    } catch {
      return json({ ok: false, reason: "Could not fetch the URL." }, 200);
    }
  }

  const contentType = res.headers.get("content-type") || "";
  const contentLength = res.headers.get("content-length") || "";

  if (contentType.toLowerCase().includes("text/html")) {
    return json({ ok: false, reason: "This looks like HTML, not a direct file." }, 200);
  }

  if (res.ok) {
    return json({
      ok: true,
      directUrl: parsed.toString(),
      contentType,
      contentLength,
    });
  }

  return json({ ok: false, reason: `Upstream status ${res.status}` }, 200);
}

function isYouTube(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.includes("youtube.com") || h.includes("youtu.be");
  } catch {
    return false;
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
