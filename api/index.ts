import app from "../server.js";

// Vercel detects this file as the single Node.js function for all Express API
// routes. The original request path is preserved by the rewrite in vercel.json.
export default app;
