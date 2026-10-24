import fs from 'fs';
import path from 'path';
import { api, createTestUser, auth, relativeDate } from './helpers';
import { config } from '../src/config';

/** A 1x1 PNG — the smallest valid image we can attach to a multipart request. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('POST /api/uploads/receipt', () => {
  it('stores an image and returns its URL', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/uploads/receipt')
      .set(auth(user.token))
      .attach('receipt', PNG_1X1, { filename: 'receipt.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.receiptUrl).toMatch(/^\/api\/uploads\/receipt\/.+\.png$/);
    expect(fs.existsSync(path.join(config.uploadDir, res.body.filename))).toBe(true);

    const download = await api().get(res.body.receiptUrl).set(auth(user.token));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toMatch(/image\/png/);
  });

  it('does not let another account download a private receipt', async () => {
    const owner = await createTestUser('9000000001');
    const other = await createTestUser('9000000002');
    const upload = await api()
      .post('/api/uploads/receipt')
      .set(auth(owner.token))
      .attach('receipt', PNG_1X1, { filename: 'receipt.png', contentType: 'image/png' });

    const download = await api().get(upload.body.receiptUrl).set(auth(other.token));
    expect(download.status).toBe(404);
  });

  it('rejects image files whose contents do not match the declared MIME type', async () => {
    const user = await createTestUser();
    const res = await api()
      .post('/api/uploads/receipt')
      .set(auth(user.token))
      .attach('receipt', Buffer.from('not actually a png'), {
        filename: 'fake.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a non-image upload', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/uploads/receipt')
      .set(auth(user.token))
      .attach('receipt', Buffer.from('#!/bin/bash\nrm -rf /'), {
        filename: 'evil.sh',
        contentType: 'application/x-sh',
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a request with no file', async () => {
    const user = await createTestUser();

    const res = await api().post('/api/uploads/receipt').set(auth(user.token));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const res = await api()
      .post('/api/uploads/receipt')
      .attach('receipt', PNG_1X1, { filename: 'receipt.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });
});

describe('loans with a receipt', () => {
  it('attaches the receipt URL to the created loan', async () => {
    const user = await createTestUser();

    const upload = await api()
      .post('/api/uploads/receipt')
      .set(auth(user.token))
      .attach('receipt', PNG_1X1, { filename: 'receipt.png', contentType: 'image/png' });

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({
        friendName: 'Amit',
        amount: 250,
        dueDate: relativeDate(7),
        receiptUrl: upload.body.receiptUrl,
      });

    expect(res.status).toBe(201);
    expect(res.body.loan.receiptUrl).toBe(upload.body.receiptUrl);
  });
});
