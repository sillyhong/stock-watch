import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { text, engine } = req.body; // engine: 'volc' 或 'cosyvoice'
    try {
      let response;
      if (engine === 'volc') {
        response = await axios.post('https://open.volcengine.com/api/tts', {
          text,
          voice: 'xiaoyan',
        }, {
          headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
        });
      } else if (engine === 'cosyvoice') {
        response = await axios.post('https://api.cosyvoice.com/tts', {
          text,
          config: { voice: 'custom', style: 'formal' },
        }, {
          headers: { 'Authorization': 'Bearer YOUR_API_KEY' },
        });
      } else {
        res.status(400).json({ error: 'Unsupported TTS engine' });
        return;
      }
      res.status(200).json({ audioUrl: response.data.audio_url });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('TTS Error:', errorMessage);
      res.status(500).json({ error: errorMessage });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
