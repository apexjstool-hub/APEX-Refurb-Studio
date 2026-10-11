export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/health') {
      return Response.json({ ok: true, app: 'APEX Web Studio Phase 1' });
    }
    if (path === '/cloud-config.js') {
      // Text or Secret bindings both work. Normalise accidental whitespace / trailing slash.
      const rawUrl = typeof env.APEX_SUPABASE_URL === 'string' ? env.APEX_SUPABASE_URL.trim() : '';
      const rawKey = typeof env.APEX_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.APEX_SUPABASE_PUBLISHABLE_KEY.trim() : '';
      let projectUrl = '';
      let urlValid = false;
      try {
        const parsed = new URL(rawUrl);
        urlValid = parsed.protocol === 'https:' &&
          /^[a-z0-9-]+\\.supabase\\.co$/i.test(parsed.hostname) &&
          (parsed.pathname === '/' || parsed.pathname === '') &&
          !parsed.search && !parsed.hash && !parsed.username && !parsed.password;
        if (urlValid) projectUrl = parsed.origin;
      } catch (_) { /* invalid or missing URL */ }
      const keyValid = rawKey.startsWith('sb_publishable_') && rawKey.length > 20;
      const ready = urlValid && keyValid;
      const status = !rawUrl ? 'missing_url' : !rawKey ? 'missing_key' :
        !urlValid ? 'invalid_url_format' : !keyValid ? 'invalid_publishable_key' : 'ready';
      const data = ready ? { url: projectUrl, anonKey: rawKey } : {};
      // No private credentials in diagnostics. The publishable key is deliberately public.
      const output = 'window.APEX_CLOUD_CONFIG = ' + JSON.stringify(data) +
        ';\\n// APEX config status: ' + status + '\\n';
      return new Response(output, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Frame-Options', 'DENY');
    return new Response(response.body, { status: response.status, headers });
  }
};
