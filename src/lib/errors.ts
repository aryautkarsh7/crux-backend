/** Error carrying an HTTP status; anything else becomes a 500. */
export class HttpError extends Error {
  constructor(public statusCode: number, message: string, public code = 'error') {
    super(message);
  }
}

export const badRequest = (m: string, code = 'bad_request') => new HttpError(400, m, code);
export const unauthorized = (m = 'Sign in to continue') => new HttpError(401, m, 'unauthorized');
export const notFound = (m = 'Not found') => new HttpError(404, m, 'not_found');
export const conflict = (m: string, code = 'conflict') => new HttpError(409, m, code);
