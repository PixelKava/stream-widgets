// PixelKava Goal Bar — Worker (API для живого goal-бара)
// © 2026 PixelKava

export default {
  // Cloudflare викликає цю функцію на КОЖЕН запит до нашого Worker
  async fetch(request, env, ctx) {
    // розбираємо адресу запиту, щоб дізнатись шлях (напр. "/total")
    const url = new URL(request.url);

    // дозвіл віджету читати наш Worker з іншого домену (CORS)
    const cors = { "Access-Control-Allow-Origin": "*" };

    // endpoint:  POST /webhook  → Ko-fi надсилає сюди КОЖЕН донат
    if (url.pathname === "/webhook" && request.method === "POST") {
      try {
        // Ko-fi шле дані як форму з полем "data" = JSON-рядок
        const form = await request.formData();
        const raw = form.get("data");
        if (!raw) return new Response("OK", { status: 200 }); // порожній пінг — не падаємо

        const payload = JSON.parse(raw);

        // 🔐 БЕЗПЕКА: токен має збігтися з нашим секретом
        if (payload.verification_token !== env.KOFI_TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }

        // сума донату (рядок → число); якщо нема — 0
        const amount = parseFloat(payload.amount) || 0;

        // читаємо ціль → додаємо донат → зберігаємо назад у KV
        const saved = await env.GOALS.get("pixelkava");
        const data = saved ? JSON.parse(saved) : { current: 0, goal: 100 };
        data.current = Math.round((data.current + amount) * 100) / 100;
        await env.GOALS.put("pixelkava", JSON.stringify(data));

        return new Response("OK", { status: 200 });
      } catch (e) {
        // будь-яка несподіванка — відповідаємо 200, але нічого не змінюємо (не падаємо)
        return new Response("OK", { status: 200 });
      }
    }

    // endpoint:  GET /total  → читає поточну суму з KV-сховища
    if (url.pathname === "/total") {
      // env.GOALS — наше KV. .get(ключ) повертає збережений рядок або null
      const saved = await env.GOALS.get("pixelkava");
      // якщо ще нічого не збережено — дефолт; інакше перетворюємо JSON-рядок на обʼєкт
      const data = saved ? JSON.parse(saved) : { current: 0, goal: 100 };
      return Response.json(data, { headers: cors });
    }

    // endpoint:  GET /reset?key=СЕКРЕТ[&goal=200]  → скид лічильника на 0 перед стрімом
    if (url.pathname === "/reset") {
      // 🔐 БЕЗПЕКА: без секрету RESET_KEY або з невірним ключем — відмова
      if (!env.RESET_KEY || url.searchParams.get("key") !== env.RESET_KEY) {
        return new Response("Forbidden", { status: 403 });
      }
      // лишаємо стару ціль, якщо нову не передали через ?goal=
      const saved = await env.GOALS.get("pixelkava");
      const prev = saved ? JSON.parse(saved) : { current: 0, goal: 100 };
      const goal = parseFloat(url.searchParams.get("goal")) || prev.goal || 100;
      const data = { current: 0, goal };
      await env.GOALS.put("pixelkava", JSON.stringify(data));
      return Response.json(data, { headers: cors });
    }

    // усе інше — проста коренева відповідь
    return new Response("PixelKava Goal Bar API ✓", { status: 200 });
  },
};
