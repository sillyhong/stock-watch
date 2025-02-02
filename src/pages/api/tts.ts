import axios from 'axios';

export default async function handler(req, res) {
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
      }
      res.status(200).json({ audioUrl: response.data.audio_url });
    } catch (error) {
      console.error('TTS Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
