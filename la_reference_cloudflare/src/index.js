/** LA RÉFÉRENCE – Cloudflare Worker static assets entry point */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
