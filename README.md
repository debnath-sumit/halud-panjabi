# Halud Panjabi

A responsive Bengali musical band website, built with HTML, CSS, and JavaScript. No package installation is needed. Requires Node.js to run the local preview.

## Local preview

Run `npm run dev` and open http://localhost:3000.

Run `npm run check` for JavaScript syntax validation.

## Content

Edit `index.html` for band copy, upcoming shows, and album content. Styling is in `style.css`, and menu and inquiry preview interactions are in `script.js`.

The homepage uses the supplied image at `assets/dhak.png`. Photo areas are intentionally designed placeholders awaiting the band's images. No member identities, event dates, or contact details have been invented. The form only previews an inquiry locally; it does not send or store submissions. Google Fonts supplies Bengali and Latin typefaces, with system fallbacks when offline.

This is a static site configured for Vercel hosting through `vercel.json`. Import the GitHub repository into Vercel, or run `npx vercel --prod` from this directory. No build step or environment variables are required. A live form submission service is not configured.
