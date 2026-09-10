# Halud Panjabi

A responsive Bengali musical band website with a protected media studio, built with HTML, CSS, JavaScript, and Vercel Functions. Requires Node.js 22.12 or newer.

## Local preview

Run `npm ci`, then `npm run dev` and open http://localhost:3000.

Run `npm run check` for JavaScript syntax validation, `npm test` for API and authentication tests, and `npm run build` to prepare browser assets in `dist/`.

## Content

Edit `index.html` for band copy, upcoming shows, and album content. Styling is in `style.css`, and menu and inquiry preview interactions are in `script.js`.

The homepage uses the supplied image at `assets/dhak.png`. The media studio publishes photos and YouTube links into the public galleries. Empty galleries retain the designed placeholders. Photos are validated, resized, stripped of metadata, and stored as WebP. Each media item has its own immutable Blob pathname so simultaneous uploads do not overwrite each other. Administrators can remove items from the website. Google Fonts supplies Bengali and Latin typefaces, with system fallbacks when offline.

Vercel runs `npm run build` and deploys `api/` as serverless functions. A connected public Vercel Blob store persists published media across deployments. The admin page is omitted from public navigation and marked `noindex`; all media changes require a server-verified session and a matching request origin.

Configure these server environment variables in Vercel (or an ignored `.env.local` for local development):

- `BLOB_READ_WRITE_TOKEN`: supplied by the connected Vercel Blob store.
- `ADMIN_USERNAME`: the administrator's login name.
- `ADMIN_PASSWORD_HASH`: `salt:hash`, where `hash` is a 64-byte scrypt result encoded as hex.
- `ADMIN_SESSION_SECRET`: a randomly generated secret of at least 32 characters. Rotate to invalidate all sessions.
- `APP_ORIGIN`: the canonical site origin, or `http://localhost:3000` locally.

Credentials are never included in browser assets. Sessions expire after eight hours, and shared storage enforces eight sign-in attempts per IP per 15-minute window across function instances. Changing the password should also rotate the session secret. Preview deployments need their own environment configuration and matching origin for admin writes.

The booking form still only previews an inquiry locally; it does not send or store submissions.
