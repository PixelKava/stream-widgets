// PixelKava Goal Bar — Worker (multi-tenant API для живого goal-бара)
// © 2026 PixelKava
//
// Один Worker обслуговує БАГАТЬОХ стрімерів. Кожен має унікальний `id`,
// а дані лежать у KV за цим id:
//   goal:<id>  → лічильник {current, goal}        (читання публічне через /total)
//   cfg:<id>   → приватний конфіг {token, resetKey, created}  (НІКОЛИ не віддаємо назовні)
//   pixelkava  → наш власний лічильник (legacy, сумісність із v2)
// Деталі — v3_СПЕК_multi-tenant.md.

// CORS: дозволяємо віджету/сторінці звертатись із іншого домену
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// зручний JSON-відповідач із CORS
function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

// випадковий невгадуваний код (crypto) — для id та resetKey
function randomId(bytes = 9) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); // 18 hex-символів
}

// чистимо id з URL — лишаємо лише безпечні символи (анти-інʼєкція ключів KV)
function cleanId(raw) {
  return (raw || "").replace(/[^a-z0-9]/gi, "").slice(0, 64);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // preflight-запит браузера перед POST з іншого домену
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── POST /register {token} → реєструє нового стрімера ──────────────────
    // Генерує id + resetKey, зберігає його Ko-fi-токен, ініціалізує лічильник.
    if (url.pathname === "/register" && request.method === "POST") {
      // антиспам: не більше 5 реєстрацій за годину з однієї IP
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const rlKey = "rl:" + ip;
      const rl = parseInt(await env.GOALS.get(rlKey)) || 0;
      if (rl >= 5) return json({ error: "rate_limited" }, 429);

      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "bad_json" }, 400);
      }
      const token = (body.token || "").trim();
      // валідація формату токена (розумна довжина, не довіряємо вводу)
      if (token.length < 6 || token.length > 200) {
        return json({ error: "bad_token" }, 400);
      }

      const id = randomId(); // публічний — іде в посилання
      const resetKey = randomId(); // секрет — лише для скиду

      await env.GOALS.put(
        "cfg:" + id,
        JSON.stringify({ token, resetKey, created: Date.now() })
      );
      await env.GOALS.put("goal:" + id, JSON.stringify({ current: 0, goal: 100 }));
      await env.GOALS.put(rlKey, String(rl + 1), { expirationTtl: 3600 });

      const base = url.origin;
      return json({
        id,
        resetKey,
        webhookUrl: `${base}/webhook?id=${id}`,
        totalUrl: `${base}/total?id=${id}`,
        resetUrl: `${base}/reset?id=${id}&key=${resetKey}`,
      });
    }

    // ── POST /webhook?id=<id> → Ko-fi надсилає сюди КОЖЕН донат ─────────────
    if (url.pathname === "/webhook" && request.method === "POST") {
      try {
        const id = cleanId(url.searchParams.get("id"));
        const goalKey = id ? "goal:" + id : "pixelkava";

        const form = await request.formData();
        const raw = form.get("data");
        if (!raw) return new Response("OK", { status: 200 }); // порожній пінг — не падаємо
        const payload = JSON.parse(raw);

        // який токен очікуємо: для id — з його cfg; без id — наш env-секрет (legacy)
        let expected;
        if (id) {
          const cfgRaw = await env.GOALS.get("cfg:" + id);
          if (!cfgRaw) return new Response("Not found", { status: 404 });
          expected = JSON.parse(cfgRaw).token;
        } else {
          expected = env.KOFI_TOKEN;
        }

        // 🔐 БЕЗПЕКА: токен має збігтися
        if (payload.verification_token !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        const amount = parseFloat(payload.amount) || 0;
        const saved = await env.GOALS.get(goalKey);
        const data = saved ? JSON.parse(saved) : { current: 0, goal: 100 };
        data.current = Math.round((data.current + amount) * 100) / 100;
        await env.GOALS.put(goalKey, JSON.stringify(data));

        return new Response("OK", { status: 200 });
      } catch (e) {
        return new Response("OK", { status: 200 }); // не падаємо на несподіванках
      }
    }

    // ── GET /total?id=<id> → поточна сума (публічне читання) ────────────────
    if (url.pathname === "/total") {
      const id = cleanId(url.searchParams.get("id"));
      const goalKey = id ? "goal:" + id : "pixelkava";
      const saved = await env.GOALS.get(goalKey);
      const data = saved ? JSON.parse(saved) : { current: 0, goal: 100 };
      return json(data);
    }

    // ── GET /reset?id=<id>&key=<resetKey>[&goal=N] → скид перед стрімом ─────
    if (url.pathname === "/reset") {
      const id = cleanId(url.searchParams.get("id"));
      const key = url.searchParams.get("key");

      let goalKey, expectedKey;
      if (id) {
        const cfgRaw = await env.GOALS.get("cfg:" + id);
        if (!cfgRaw) return new Response("Not found", { status: 404 });
        expectedKey = JSON.parse(cfgRaw).resetKey;
        goalKey = "goal:" + id;
      } else {
        expectedKey = env.RESET_KEY; // legacy (наш власний)
        goalKey = "pixelkava";
      }

      // 🔐 БЕЗПЕКА: без вірного ключа — відмова
      if (!expectedKey || key !== expectedKey) {
        return new Response("Forbidden", { status: 403 });
      }

      const saved = await env.GOALS.get(goalKey);
      const prev = saved ? JSON.parse(saved) : { current: 0, goal: 100 };
      const goal = parseFloat(url.searchParams.get("goal")) || prev.goal || 100;
      const data = { current: 0, goal };
      await env.GOALS.put(goalKey, JSON.stringify(data));
      return json(data);
    }

    // усе інше — проста коренева відповідь
    return new Response("PixelKava Goal Bar API ✓", { status: 200 });
  },
};
