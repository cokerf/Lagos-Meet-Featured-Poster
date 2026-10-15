# Lagos Meet — Notion to Instagram generator

Complete static frontend plus Netlify Functions. No build framework or production npm dependencies.

## 1. Connect Notion

Create an internal Notion integration at https://www.notion.so/profile/integrations with Read content capability. Copy its integration secret.
Open your original editorial database in Notion, open its menu → Connections, and add the integration. If you use a linked database view, connect the original database.
Copy the database ID from its URL: the 32-character identifier before `?v=`. Do not use the view ID after `?v=`. This project does not assume the ID in an export filename is your API database ID.

The source must contain these exact properties:

| Property | Accepted type | Rule |
| --- | --- | --- |
| Title of Story | Text (rich text) or Title | Nonempty |
| Date of Publication | Date | Set; today or earlier in Africa/Lagos |
| Cover Image | Files & media or URL | At least one image; uses first file |
| Status | Status or Select | Exactly Published |

The title is text; there is no separate title-image field in your supplied schema. Creator's Name is not used as the headline. Page-level covers do not substitute for the Cover Image property. Your CSV is not needed for the live integration, and filenames exported in CSV are not used as image URLs.

## 2. Deploy on Netlify

1. Unzip this folder and push its contents, including netlify.toml and netlify/functions, to a Git repository.
2. In Netlify create a project by importing that repository. Base directory: repository root. Build command: `npm run build`. Publish directory: `public`. netlify.toml supplies these defaults.
3. In the site's environment variables add `NOTION_TOKEN` and `NOTION_DATABASE_ID`. Ensure the variables are available to Functions/runtime. Do not paste the token into public files or commit .env.
4. If the database has more than one data source, also set `NOTION_DATA_SOURCE_ID` to the desired source ID. A single source is discovered automatically.
5. Redeploy after adding/changing environment variables. Open the site and click Choose article.

Use Git import or a Netlify CLI deployment of the whole project. Dragging only public/index.html into Netlify Drop does not deploy the server functions.

For local use, copy .env.example to .env, add the values, then run `npm run dev` (requires Node 22+ and network access to install the Netlify CLI). Open the address printed by Netlify Dev, not the HTML file directly.

## 3. Use

Choose article opens a searchable picker. It paginates through the database and includes only eligible stories. Select a title to load its actual date, headline and image. Refresh reloads the picker from Notion. Re-select an article to load subsequent Notion edits into the canvas.
Click the title/date to edit locally; double-click the image to upload your own. These edits do not write to Notion. Select 4:5, 1:1, 1.91:1 or 9:16, change the background, and export a PNG at 1080×1350, 1080×1080, 1080×565 or 1080×1920 respectively. Long titles are clamped as in the original generator; shorten them in the canvas if necessary.

## Images and access

The image endpoint looks up the page again, verifies it belongs to the configured data source and still passes screening, then retrieves a fresh Notion image URL. It returns image bytes from the same origin for palette sampling and PNG export. JPEG, PNG, WebP, GIF and AVIF are supported, up to 4 MiB per image. GIF export captures a still frame. SVG covers are not supported.

Notion S3, secure.notion-static.com, www.notion.so, images.unsplash.com and ik.imagekit.io hosts are supported. If your external cover uses another host, add its exact trusted hostname to `IMAGE_ALLOWED_HOSTS`, separated by commas, and redeploy. Redirect targets must also be allowed. Use public image CDN hostnames only, never private/internal services. The Notion token is sent only to api.notion.com.

This version makes eligible published article titles, dates and covers publicly accessible through the site and its endpoints. It does not expose email, phone, creator contact details, draft content, or the integration token. If the generator should be private, protect the entire Netlify deployment (including Functions) with access controls before sharing its URL; the app does not include a login.

## Troubleshooting

- Notion 401: check NOTION_TOKEN; redeploy after changing it.
- Notion 404: check database ID and the integration's access to the original database.
- Missing-property error: check spelling and property type in the table above.
- No eligible articles: check Published status, date, headline and Cover Image.
- Image-host error: allow its trusted exact hostname using IMAGE_ALLOWED_HOSTS.
- Image over 4 MB: upload a smaller cover to Notion.
- Logo/font/export library fail: the original ImageKit assets, Google Fonts and cdnjs need to be available to the browser. If ImageKit does not allow cross-origin font/image use, host licensed copies under public and update their URLs.

## Validation

Run `npm test` and `npm run build`. Tests cover screening, field types, Lagos dates, pagination cursor handling and omission of private fields. A live Notion connection and browser PNG export still need checking after your credentials are configured.

References: https://developers.notion.com/reference/query-a-data-source
https://developers.notion.com/reference/retrieve-a-database
https://developers.notion.com/reference/file-object
https://docs.netlify.com/build/functions/get-started/
https://docs.netlify.com/build/functions/environment-variables/
