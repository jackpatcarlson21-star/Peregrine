import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Proxy NOAA RIDGE2 GetCapabilities to extract real scan timestamps
// (browser can't fetch this directly due to NOAA's Sec-Fetch-Mode block)
app.get('/api/radar/times', async (req, res) => {
  const { station } = req.query;
  if (!station || !/^[A-Za-z0-9]{3,5}$/.test(station)) {
    return res.status(400).json({ error: 'Invalid station' });
  }
  try {
    const url = `https://opengeo.ncep.noaa.gov/geoserver/${station.toLowerCase()}/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`NOAA responded ${r.status}`);
    const xml = await r.text();

    const dimMatch = xml.match(/Dimension[^>]+name="time"[^>]*>([\s\S]*?)<\/Dimension>/i);
    if (!dimMatch) return res.json({ times: [] });

    const raw = dimMatch[1].trim();
    let times = [];
    if (raw.includes(',')) {
      times = raw.split(',').map(t => t.trim()).filter(Boolean);
    } else if (raw.includes('/')) {
      const [start, end, period] = raw.split('/');
      const m = period?.match(/PT?(\d+(?:\.\d+)?)M/);
      if (m) {
        const step = parseFloat(m[1]) * 60000;
        let t = new Date(start).getTime();
        const endT = new Date(end).getTime();
        while (t <= endT && times.length < 60) {
          times.push(new Date(t).toISOString().replace('.000Z', 'Z'));
          t += step;
        }
      }
    }

    res.json({ times });
  } catch (e) {
    res.status(500).json({ error: e.message, times: [] });
  }
});

// Serve Vite build
app.use(express.static(path.join(__dirname, 'dist')));
app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Peregrine running on :${PORT}`));
