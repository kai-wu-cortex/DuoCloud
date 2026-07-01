<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bc2822f2-bcb2-4f71-91d3-96e82e17e277

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy the environment template and set MongoDB/session values:
   `cp .env.example .env`
3. Create the first Knowledge Cloud user:
   `npm run create:knowledge-user -- --username admin --password 'change-me' --role admin`
4. Run the app:
   `npm run dev`

Knowledge Cloud uses `MONGODB_URI`, optional `MONGODB_DIRECT_URI`, `KNOWLEDGE_DB_NAME`, and `SESSION_SECRET` from the environment. The login database collection is `system_users`.
