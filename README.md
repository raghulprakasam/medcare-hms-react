# MedCare HMS — React Edition

A modern, production-ready React 18 + Vite conversion of the original static
HTML/CSS/JS Hospital Management System (Main site, Admin, Doctor and
Pharmacy dashboards, Patient portal).

All business logic — REST endpoints, request/response payload shapes, JWT
handling, form validation, appointment booking, PDF slip/invoice generation,
and role-based redirects — has been preserved exactly as in the original
vanilla-JS code. Nothing was changed in *how* the app talks to the backend;
only *how the UI is built* changed (React components instead of
`document.getElementById` + template strings).

## Stack

- **React 18** + **Vite 5** (fast dev server, instant HMR)
- **react-router-dom v6** — client-side routing between the 5 dashboards
- **html2pdf.js** — same PDF slip/invoice generation as the original CDN
  script, now an npm dependency
- Plain CSS (no framework) — each page's original stylesheet is preserved
  1:1 and scoped to only be active while that page is mounted (see
  "How styling was preserved" below)

## Getting started

```bash
npm install
npm run dev       # start local dev server on http://localhost:5173
npm run build      # production build -> dist/
npm run preview    # preview the production build locally
```

### Backend

The app expects the existing Spring Boot backend at
`http://localhost:8080` (same as the original hardcoded URL). To point at a
different backend, edit `.env`:

```
VITE_API_URL=https://spring-boot-jwt-rbac.onrender.com
```

No other code changes are required — every API call in the app goes through
`src/api/client.js`, which reads this single environment variable.

## Project structure

```
src/
  api/
    client.js          # fetch wrapper: base URL, Bearer token, JSON helper
  components/
    usePageStyles.js   # hook that scopes a page's CSS to only be active
                        # while that page is mounted
  pages/
    MainPage/           MainPage.jsx + MainPage.css   → route "/"
    AdminPage/           AdminPage.jsx + AdminPage.css → route "/admin"
    DoctorPage/          DoctorPage.jsx + DoctorPage.css → route "/doctor"
    PharmacyPage/        PharmacyPage.jsx + PharmacyPage.css → route "/pharmacy"
    PatientPage/         PatientPage.jsx + PatientPage.css → route "/patient"
    StaffPage/            StaffPage.jsx  → route "/staff" (placeholder, see below)
  assets/img/           # logo & hero images copied from the original project
  App.jsx               # <BrowserRouter> + <Routes>
  main.jsx               # ReactDOM root
```

## Route map (mirrors the original page redirects)

| Original file                                  | New route     |
|--------------------------------------------------|---------------|
| `Mainpage/index.html`                             | `/`           |
| `PatientPage/index.html`                          | `/patient`    |
| `AdminPage/admin.html`                            | `/admin`      |
| `DoctorPage/doctor.html`                          | `/doctor`     |
| `PharmacyDashboard/pharmacy-dashboard.html`       | `/pharmacy`   |
| *(referenced by login but not in the source zip)* | `/staff`      |

Every place the old code did `window.location.href = "../X/y.html"` now
calls `navigate("/x")` from `react-router-dom` instead — the destination and
the condition under which it fires are unchanged.

## What was preserved exactly

- **All fetch calls** — same HTTP method, same path, same JSON body shape,
  same headers (`Authorization: Bearer <token>` from `localStorage`).
- **Auth/session handling** — `accessToken` is still read/written to
  `localStorage` under the exact same key, and the JWT `sub` claim is
  decoded the same way for greeting text.
- **Validation rules** — required fields, password-match checks, "already
  booked on this date" checks, etc., all run the same checks in the same
  order before hitting the network.
- **PDF generation** — the pharmacy invoice and the patient OPD slip use
  the identical `html2pdf.js` options (margins, scale, format) and produce
  the same HTML markup that gets rasterized, just built via a React
  component tree rather than a template string.
- **Role-based access checks** — e.g. the department login still checks
  `roles.includes('ROLE_DOCTOR')` etc. before allowing navigation.

## How styling was preserved

The original app was 5 independent static HTML pages, each with its own
`<style>` block — so a class like `.card` or `.btn` could (and did) mean
completely different things on different pages. Merging everything into one
React single-page app would normally make all of that CSS global at once,
causing the pages to visually corrupt each other.

To avoid rewriting (and risking breaking) any of the original, carefully
tuned CSS, each page's stylesheet is imported as a raw string
(`import cssText from "./AdminPage.css?raw"`) and injected into a `<style>`
tag only while that page's component is mounted, via the
`usePageStyles` hook. This exactly reproduces the original "one page loaded
at a time" isolation with zero selector rewriting.

## Notes / things to double check against your backend

- `role="ROLE_USER"` is sent on patient self-registration and
  `role="ROLE_DOCTOR" / "ROLE_STAFF" / "ROLE_ACCOUNTS"` on admin-created
  accounts, exactly as before.
- The `/staff` route (Medical Staff dashboard) is a placeholder — the
  original ZIP did not include a `StaffPage/staff-dashboard.html` source
  file, even though the login flow referenced one. Drop the real markup
  into `src/pages/StaffPage/StaffPage.jsx` when you have it.
