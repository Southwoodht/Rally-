import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = req.method === 'POST' ? req.body : { ok: true };
    // eslint-disable-next-line no-console
    console.log('[diag] client report:', JSON.stringify(body));
    res.status(200).json({ received: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
