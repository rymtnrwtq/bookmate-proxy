// server.js
import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Простая логика запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Статика (положи frontend в папку public)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Простой health-check
app.get('/ping', (req, res) => res.send('pong'));

// Main proxy endpoint
app.get('/book', async (req, res) => {
  const uuid = req.query.uuid;
  if (!uuid) {
    return res.status(400).json({ error: 'Missing book uuid' });
  }

  const bookmateUrl = `https://api.bookmate.yandex.net/api/v5/books/${uuid}/content/v4`;

  try {
    // Bookmate ожидает заголовок 'auth-token'
    const response = await fetch(bookmateUrl, {
      headers: {
        'auth-token': process.env.BOOKMATE_TOKEN || '',
        // при необходимости можно добавить user-agent или другие заголовки
      },
      // можно настроить таймаут/редиректы если нужно
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`Bookmate fetch failed: ${response.status} ${response.statusText} ${text}`);
      return res.status(response.status).json({ error: 'Failed to fetch book from Bookmate', details: text });
    }

    // Подставляем корректные заголовки для скачивания
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${uuid}.epub"`);

    // Stream response body прямо клиенту, чтобы не держать весь файл в памяти
    const body = response.body;
    if (!body) {
      // На случай, если body отсутствует, всё же прочитать буфером
      const buf = await response.arrayBuffer();
      return res.send(Buffer.from(buf));
    }

    // Pipe readable stream from node-fetch to express response
    body.pipe(res);

    // На всякий случай обработка ошибок стрима
    body.on('error', (err) => {
      console.error('Stream error from Bookmate response:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
      else res.destroy(err);
    });

  } catch (err) {
    console.error('Server error in /book:', err);
    res.status(500).json({ error: err.message });
  }
});

// Запуск
const port = process.env.PORT || 80;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});
