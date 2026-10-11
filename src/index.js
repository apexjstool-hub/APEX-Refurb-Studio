export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, app: 'APEX Cloud Inventory' }, {headers:{'Cache-Control':'no-store'}});
    if (url.pathname === '/cloud-config.js') {
      const project = env.APEX_SUPABASE_URL || '';
      const publishable = env.APEX_SUPABASE_PUBLISHABLE_KEY || '';
      const valid = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(project) && publishable.startsWith('sb_publishable_');
      const config = valid ? { url: project, anonKey: publishable } : {};
      return new Response('window.APEX_CLOUD_CONFIG = ' + JSON.stringify(config) + ';', {
        headers: {
          'Content-Type':'application/javascript; charset=utf-8',
          'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff',
          'Referrer-Policy':'no-referrer'
        }
      });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Frame-Options', 'DENY');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};
