# BigBakeBatter Admin

Admin console for the BigBakeBatter bakery storefront: orders, payments, cakes and stock,
categories, coupons, banners, announcements, website text and business settings.

React 19 + Vite, plain JavaScript, Zustand, React Router 7. It talks to the BigBakeBatter REST API
(admin account required).

## Setup

```bash
npm install
cp .env.example .env   # then edit the values
npm run dev            # http://localhost:5173
```

### Environment variables

| Variable              | What it is                                                                 | Example                          |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------- |
| `VITE_API_BASE_URL`   | Backend API base URL, **including** `/api`. Uploaded images (`/uploads/…`) are served from this host without `/api`. | `https://api.bigbakebatter.com/api` |
| `VITE_STOREFRONT_URL` | Public storefront URL, used for the "Storefront" links.                    | `https://bigbakebatter.com`      |

Vite bakes these in at build time, so rebuild after changing them.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/`
- `npm run lint` — oxlint

## Deploy (Vercel)

1. Import the repo in Vercel; framework preset **Vite** (build `npm run build`, output `dist`).
2. Set `VITE_API_BASE_URL` and `VITE_STOREFRONT_URL` in Project → Settings → Environment Variables.
3. Deploy. `vercel.json` rewrites every path to `index.html` so deep links like `/orders/123` work.

The backend must allow the admin's domain in its CORS settings.
