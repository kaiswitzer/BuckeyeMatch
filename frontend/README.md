# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Buckeye Match API and deployment (Render)

- **Frontend API base URL:** Set `VITE_API_URL` at build time to your backend origin plus `/api`, e.g. `https://your-api.onrender.com/api`. The client defaults to a production URL in `src/api/axios.js` if unset; for local dev, use `http://localhost:5001/api` (or your Flask port).
- **CORS:** The Flask app must allow your deployed frontend origin (see `backend/app.py`). Add your exact Render frontend URL if it is not already listed.
- **Database:** Use a persistent database on Render for production. The default SQLite file on a web service can be reset on deploy, which wipes users and matches.
- **Matching:** Matches are created when a student completes onboarding (which calls `POST /api/matches/run`) or when they click **Look for matches** on the student dashboard if they still have no matches. Alumni must be **open** or **limited** (not closed), and the student’s **target companies** should overlap the alum’s **current company** or **work history**; otherwise the engine may find no eligible pair. Creating an alumni account alone does not retroactively match existing students until matching runs again for a student.
