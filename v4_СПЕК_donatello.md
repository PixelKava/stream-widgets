# 🇺🇦 v4 — Donatello як джерело донатів (спека)

> **Мета:** живий Goal Bar працює і з **Donatello** (популярна укр. платформа), а не лише Ko-fi.
> **Стан: ЧЕРНЕТКА** (дослідження зроблено; точний формат endpoint звіримо при збірці — не вгадуємо).
> Створено 2026-06-24. 🔗 `v3_СПЕК_multi-tenant.md` · `ФУНКЦІОНАЛ.md` · `БЕЗПЕКА_чеклист-продуктів.md`

---

## 🔑 Ключова відмінність від Ko-fi
| | Ko-fi | Donatello |
|---|---|---|
| Модель | **push** — платформа стукає до нас (`/webhook`) | **pull** — *ми* опитуємо платформу |
| Дані | приходять самі | беремо з `https://donatello.to/widget/<WIDGET_ID>/token/<API_KEY>` |
| Подія | webhook payload | `on_donate` (через long-polling / опитування) |

> Тобто Donatello потребує **серверного опитувача**, а не просто прийому вебхука.

## 🧠 Архітектура (pull через Cron)
```
⏰ Cloudflare Cron Trigger (напр. кожну 1 хв)
   │ для кожного стрімера з джерелом "donatello":
   ▼
☁️ Worker → GET donatello widget/token endpoint
   1) отримує останні донати
   2) порівнює з курсором «останній оброблений донат» (щоб не рахувати двічі)
   3) нові суми → додає в goal:<id>
   4) оновлює курсор
   ▼
🗄️ KV goal:<id>  →  📊 віджет опитує /total?id=… (як завжди)
```

## 🗄️ Зміни в даних (KV)
Розширюємо `cfg:<id>`, щоб тримати **джерело** і його креди:
```
cfg:<id> = {
  source: "kofi" | "donatello",
  token:    "<Ko-fi verification token>",   // для kofi
  widgetId: "<Donatello widget id>",          // для donatello
  apiKey:   "<Donatello api key>",            // для donatello (СЕКРЕТ, не віддаємо)
  cursor:   "<id останнього обробленого донату>", // для donatello (анти-дубль)
  resetKey: "..."
}
```
`goal:<id>` (лічильник) лишається спільним — сумує донати з будь-якого джерела.

## 🔧 Зміни в коді
- **Worker:** новий обробник Cron (`scheduled()`), що проходить по donatello-стрімерах, опитує endpoint, додає нові суми, рухає курсор. `/register` приймає `source` + потрібні креди.
- **connect.html:** вибір платформи (Ko-fi / Donatello) → відповідні поля (Ko-fi token АБО Donatello widgetId+apiKey) + пояснення, де їх узяти.
- **`wrangler.toml`:** додати `[triggers] crons = ["* * * * *"]` (або рідше).

## 🔐 Безпека
`apiKey` Donatello — як Ko-fi-токен: у KV, **ніколи** в GET/логах. Валідація вводу. Rate-limit реєстрацій (вже є). Turnstile (вже є). Курсор — щоб донат не зарахувався двічі.

## ❓ Звірити при збірці (НЕ вгадуємо)
1. **Точний формат відповіді** endpoint `widget/<ID>/token/<KEY>` — це JSON списку донатів? long-poll? Які поля (сума, id, час)?
2. Чи є **пагінація / "since"** параметр, щоб брати лише нові (інакше курсуємо за id/часом).
3. **Ліміти** опитування (як часто можна).
4. Чи endpoint **CORS-доступний серверно** (Worker → ок; з браузера НЕ робимо — apiKey секрет).
> Джерело-підказка: бібліотека `donatello-py` (PyPI) — має `on_donate`/`on_ready` і цей формат URL. Звіримо її код/їхній віджет при збірці.

## 🗺️ Фази (коли беремось)
1. **Підтвердити формат** endpoint (1 реальний запит зі справжнім widget/key — на собі).
2. **Worker:** `scheduled()` poller + курсор + `source` у `/register`.
3. **connect.html:** вибір платформи (5 мов).
4. **Тест наживо** (донат у Donatello → за ~1 хв з'явився у смужці).

## 🌐 На потім — інші платформи (той самий патерн)
- **push (легко, як Ko-fi):** Streamlabs, StreamElements, Buy Me a Coffee, Patreon, Twitch EventSub (Bits/субки + auto-reset).
- **pull/особливе:** Monobank (опитування банки, 🇺🇦), YouTube Super Chat.
- 🚫 **Уникаємо за цінностями:** DonationAlerts (рос. походження), Boosty (рос.).
> Архітектура `source` у `cfg:<id>` навмисне зроблена розширюваною — кожна нова платформа = новий `source` + її обробник.
