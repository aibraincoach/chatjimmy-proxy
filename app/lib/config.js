import { Agent } from 'undici';

export const upstreamAgent = new Agent({ connect: { rejectUnauthorized: false } });
