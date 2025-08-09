import express from 'express';
import fetch from 'node-fetch';

const app = express();

app.get('/book', async (req, res) => {
  const uuid = req.query.uuid;
  if (!uuid) {
    return res.status(400).json({ error: 'Missing book uuid' });
  }

  try {
    const response = await fetch(
      `https://api.bookmate.yandex.net/api/v5/books/${uuid}/content/v4`,
      {
        headers: {
          Authorization: `Token ${process.env.BOOKMATE_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: 'Failed to fetch book from Bookmate' });
    }

    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${uuid}.epub"`
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 80;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});
