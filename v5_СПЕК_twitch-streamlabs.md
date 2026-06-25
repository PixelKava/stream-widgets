# 🌍 v5 — Twitch + Streamlabs як джерела донатів (спека)

> **Мета:** живий Goal Bar працює і з **Twitch** (бітси/субки) та **Streamlabs**, не лише Ko-fi.
> **Стан: ЧЕРНЕТКА** (дослідження зроблено; точні поля/скоупи звіримо при збірці).
> Створено 2026-06-25. 🔗 `v3_СПЕК_multi-tenant.md` · `v4_СПЕК_donatello.md` · `БЕЗПЕКА_чеклист-продуктів.md`

---

## 🧠 Архітектура (спільна)
Розширюємо `cfg:<id>` полем **`source`** (`kofi`/`twitch`/`streamlabs`); `goal:<id>` (лічильник) спільний — сумує з будь-якого джерела. Кожна платформа = свій обробник.

---

## 🟣 Twitch — EventSub (PUSH, лягає найкраще)
**Модель:** Twitch сам шле вебхуки на наш endpoint (як Ko-fi). 
**Події → донати:**
- `channel.cheer` → **бітси** (1 біт ≈ $0.01) *(скоуп `bits:read`)*
- `channel.subscribe` / `channel.subscription.message` / `channel.subscription.gift` → **субки** (tier → сума, налаштовувана) *(скоуп `channel:read:subscriptions`)*
- ⭐ `stream.online` → **авто-скид цілі** на старті стріму (бонус!)

**Авторизація:** наш Twitch-додаток (client id/secret) + **OAuth кожного стрімера** (дозволяє скоупи). Потік: кнопка «Підключити Twitch» → OAuth → отримуємо токен → створюємо EventSub-підписки → Twitch шле на `…/twitch-webhook`.
**Безпека:** перевірка **HMAC-підпису** кожного вебхука (секрет), відповідь на verification-challenge.
**Інфра:** звичайний Worker (push), як Ko-fi. ✅

## 🟢 Streamlabs — Socket API (real-time)
**Модель:** постійний **socket.io**-конект → події `type === 'donation'` (поля: amount, name, currency…).
**Токен:** `GET https://streamlabs.com/api/v1.0/socket/token` (через OAuth стрімера) → конект до `https://sockets.streamlabs.com?token=…`.
**Інфра-виклик:** Worker НЕ тримає постійний сокет. Варіанти (звірити при збірці):
- **Durable Object** — тримає socket-конект на стрімера (Cloudflare вміє WebSocket у DO), АБО
- **Cron-опитування** REST-ендпоінта донатів (як Donatello).
**Авторизація:** Streamlabs OAuth-додаток (client id/secret) + токен стрімера.

---

## 🔐 Безпека / цінності
Секрети (Twitch/Streamlabs client secret) — у env Worker, не в коді. HMAC-перевірка Twitch-вебхуків. Токени стрімерів — у `cfg:<id>`, ніколи в GET/логах. Turnstile на реєстрації (вже є). 🚫 без російського.

## 🧩 Що потрібно від капітана (для збірки)
1. **Twitch dev-додаток** → `dev.twitch.tv/console` → Register App → отримати **Client ID + Secret** (у Worker-секрети).
2. **Streamlabs OAuth-додаток** → `streamlabs.com/dashboard` → Settings → API → отримати Client ID + Secret.
*(Це разова реєстрація додатків; OAuth кожного стрімера — через кнопку «Підключити», без засвічування капітана.)*

## 🗺️ Фази (рекомендований порядок)
**Спершу Twitch** (push, лягає на наявну архітектуру + дає авто-скид):
1. Twitch-додаток (капітан) → секрети.
2. OAuth-потік «Підключити Twitch» + створення EventSub-підписок.
3. `/twitch-webhook` (HMAC-перевірка) → бітси/субки → `goal:<id>`; `stream.online` → скид.
4. Тест наживо (тестова подія через `twitch-cli`).

**Потім Streamlabs** (складніша інфра):
5. Рішення: Durable Object vs Cron-poll (звірити ліміти).
6. OAuth + socket-обробник → донати → `goal:<id>`.
7. Тест наживо.

## ❓ Звірити при збірці (не вгадуємо)
- Точні назви/поля подій EventSub + актуальні скоупи.
- Чи EventSub-callback потребує публічного HTTPS (Worker дає ✅) + формат challenge/HMAC.
- Streamlabs: чи REST-донати придатні для polling, чи лише socket → тоді Durable Object.
- Перерахунок субки tier → сума (налаштувати).

---
> 🔗 Sources: [Twitch EventSub Subscription Types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/) · [Streamlabs Socket API](https://dev.streamlabs.com/docs/socket-api). Стратегія — пам'ять `post-donatello-global` (курс на глобальний ринок).
