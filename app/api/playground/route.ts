import { parseRequest } from '../../../lib/playground';
import { signedIn, signInRequired } from '../../../lib/session-server';
import { authorizeModel, infer, InferenceError, MAX_BODY_BYTES, ownedModels, playgroundConfig, readLimited } from '../../../lib/playground-server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const bearer = (request: Request) => request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1] ?? '';

export async function GET(request: Request) {
  const config = playgroundConfig();
  const token = bearer(request);
  // Signed-in callers also see their own ready models; a failed lookup still leaves the shared model.
  const own = token ? await ownedModels(token).catch(() => []) : [];
  return Response.json({ ...config, models: [...config.models, ...own] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!(await signedIn(request))) return signInRequired(headers);
  try {
    const text = await readLimited(request, MAX_BODY_BYTES);
    let input;
    try { input = parseRequest(JSON.parse(text)); }
    catch (error) { return Response.json({ error: error instanceof SyntaxError ? 'Request must be valid JSON.' : (error as Error).message }, { status: 400, headers }); }
    // The caller's own API key arrives in a header so it never enters the body, a URL or a log line.
    const { apiKey } = await authorizeModel(input.model, bearer(request), request.headers.get('x-zils-api-key'));
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
    return Response.json(await infer(input, signal, apiKey), { headers });
  } catch (error) {
    const known = error instanceof InferenceError;
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return Response.json({ error: known ? error.message : timedOut ? 'The Zils model timed out. Try fewer questions or try again later.' : 'Could not reach the Zils model. Try again shortly.' }, { status: known ? error.status : timedOut ? 504 : 502, headers });
  }
}
