import { Context } from './context.js';
import { CTX_TOKEN } from '../constants/context-constant.js';

export const tokenContextMiddleware = (req, res, next) => {
  const bearerToken = req.get('Authorization');

  if (bearerToken) {
    Context.set(CTX_TOKEN, bearerToken);
  }

  next();
};
