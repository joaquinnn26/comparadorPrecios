import serverless from 'serverless-http';

// The modern Netlify runtime provides the Blobs context for each request.
process.env.COMPARADOR_STORAGE = 'netlify';
let adapter;
export default async function handler(request) {
  adapter ||= import('../../backend/src/server.js').then(({ app }) => serverless(app));
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '/api');
  const body = Buffer.from(await request.arrayBuffer());
  const result = await (
    await adapter
  )(
    {
      httpMethod: request.method,
      path,
      rawUrl: request.url,
      headers: Object.fromEntries(request.headers),
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: body.length ? body.toString('base64') : null,
      isBase64Encoded: true,
      requestContext: {},
    },
    {},
  );
  return new Response(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
}
