import { api, createTestUser, auth, relativeDate } from './helpers';

describe('POST /api/loans', () => {
  it('creates a loan and returns it', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({
        friendName: 'Amit',
        amount: 1500.5,
        dueDate: relativeDate(10),
        note: 'Birthday gift',
      });

    expect(res.status).toBe(201);
    expect(res.body.loan.friendName).toBe('Amit');
    expect(res.body.loan.amount).toBe(1500.5);
    expect(res.body.loan.amountCents).toBe(150050);
    expect(res.body.loan.status).toBe('pending');
    expect(res.body.loan.isOverdue).toBe(false);
    expect(res.body.loan.repaidAt).toBeNull();
  });

  it('accepts an amount sent as a string', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Neha', amount: '250.75', dueDate: relativeDate(3) });

    expect(res.status).toBe(201);
    expect(res.body.loan.amountCents).toBe(25075);
  });

  it('rejects a missing friend name', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ amount: 100, dueDate: relativeDate(3) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a zero amount', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 0, dueDate: relativeDate(3) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a negative amount', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: -50, dueDate: relativeDate(3) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an amount with more than two decimal places', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: '10.999', dueDate: relativeDate(3) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a missing due date', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed due date', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 100, dueDate: '15-01-2026' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an impossible calendar date', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 100, dueDate: '2026-02-31' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const res = await api()
      .post('/api/loans')
      .send({ friendName: 'Amit', amount: 100, dueDate: relativeDate(3) });

    expect(res.status).toBe(401);
  });

  it('trims whitespace from the friend name', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: '   Amit   ', amount: 100, dueDate: relativeDate(3) });

    expect(res.status).toBe(201);
    expect(res.body.loan.friendName).toBe('Amit');
  });

  it('rejects an amount above the maximum', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 100_000_000, dueDate: relativeDate(3) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a note longer than 500 characters', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({
        friendName: 'Amit',
        amount: 100,
        dueDate: relativeDate(3),
        note: 'x'.repeat(501),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a friend name longer than 120 characters', async () => {
    const user = await createTestUser();

    const res = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'A'.repeat(121), amount: 100, dueDate: relativeDate(3) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/loans', () => {
  it('returns only the loans of the authenticated user', async () => {
    const alice = await createTestUser('9000000001');
    const bob = await createTestUser('9000000002');

    await api()
      .post('/api/loans')
      .set(auth(alice.token))
      .send({ friendName: 'Amit', amount: 100, dueDate: relativeDate(3) });

    await api()
      .post('/api/loans')
      .set(auth(bob.token))
      .send({ friendName: 'Neha', amount: 500, dueDate: relativeDate(3) });

    const res = await api().get('/api/loans').set(auth(alice.token));

    expect(res.status).toBe(200);
    expect(res.body.loans).toHaveLength(1);
    expect(res.body.loans[0].friendName).toBe('Amit');
  });

  it('returns an empty list for a user with no loans', async () => {
    const user = await createTestUser();

    const res = await api().get('/api/loans').set(auth(user.token));

    expect(res.status).toBe(200);
    expect(res.body.loans).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('flags overdue loans and puts them first', async () => {
    const user = await createTestUser();

    await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Future', amount: 100, dueDate: relativeDate(30) });

    await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Late', amount: 200, dueDate: relativeDate(-5) });

    const res = await api().get('/api/loans').set(auth(user.token));

    expect(res.body.loans).toHaveLength(2);
    expect(res.body.loans[0].friendName).toBe('Late');
    expect(res.body.loans[0].isOverdue).toBe(true);
    expect(res.body.loans[0].daysOverdue).toBe(5);
    expect(res.body.loans[1].isOverdue).toBe(false);
  });

  it('does not flag a loan due today as overdue', async () => {
    const user = await createTestUser();

    await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'DueToday', amount: 100, dueDate: relativeDate(0) });

    const res = await api().get('/api/loans').set(auth(user.token));

    expect(res.body.loans[0].isOverdue).toBe(false);
    expect(res.body.loans[0].daysUntilDue).toBe(0);
  });

  it('filters by status=overdue', async () => {
    const user = await createTestUser();

    await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Late', amount: 200, dueDate: relativeDate(-5) });

    await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Current', amount: 100, dueDate: relativeDate(5) });

    const res = await api().get('/api/loans?status=overdue').set(auth(user.token));

    expect(res.body.loans).toHaveLength(1);
    expect(res.body.loans[0].friendName).toBe('Late');
  });

  it('filters by status=repaid', async () => {
    const user = await createTestUser();

    const created = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 200, dueDate: relativeDate(-5) });

    await api()
      .patch(`/api/loans/${created.body.loan.id}/repay`)
      .set(auth(user.token))
      .send({});

    const res = await api().get('/api/loans?status=repaid').set(auth(user.token));

    expect(res.body.loans).toHaveLength(1);
    expect(res.body.loans[0].status).toBe('repaid');
  });

  it('searches by friend name', async () => {
    const user = await createTestUser();

    await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 100, dueDate: relativeDate(3) });

    await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Neha', amount: 100, dueDate: relativeDate(3) });

    const res = await api().get('/api/loans?search=ami').set(auth(user.token));

    expect(res.body.loans).toHaveLength(1);
    expect(res.body.loans[0].friendName).toBe('Amit');
  });

  it('rejects an invalid status filter', async () => {
    const user = await createTestUser();

    const res = await api().get('/api/loans?status=bogus').set(auth(user.token));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/loans/:id', () => {
  it('returns a single loan', async () => {
    const user = await createTestUser();

    const created = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 100, dueDate: relativeDate(3) });

    const res = await api()
      .get(`/api/loans/${created.body.loan.id}`)
      .set(auth(user.token));

    expect(res.status).toBe(200);
    expect(res.body.loan.id).toBe(created.body.loan.id);
  });

  it('returns 404 for a loan that does not exist', async () => {
    const user = await createTestUser();

    const res = await api()
      .get('/api/loans/11111111-1111-4111-8111-111111111111')
      .set(auth(user.token));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not leak another user\'s loan', async () => {
    const alice = await createTestUser('9000000001');
    const bob = await createTestUser('9000000002');

    const created = await api()
      .post('/api/loans')
      .set(auth(alice.token))
      .send({ friendName: 'Amit', amount: 100, dueDate: relativeDate(3) });

    const res = await api()
      .get(`/api/loans/${created.body.loan.id}`)
      .set(auth(bob.token));

    expect(res.status).toBe(404);
  });

  it('rejects a malformed id', async () => {
    const user = await createTestUser();

    const res = await api().get('/api/loans/not-a-uuid').set(auth(user.token));

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/loans/:id/repay', () => {
  it('marks a loan as repaid', async () => {
    const user = await createTestUser();

    const created = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 500, dueDate: relativeDate(-3) });

    const res = await api()
      .patch(`/api/loans/${created.body.loan.id}/repay`)
      .set(auth(user.token))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe('repaid');
    expect(res.body.loan.repaidAt).toEqual(expect.any(String));
    expect(res.body.loan.isOverdue).toBe(false);
  });

  it('is idempotent and keeps the original repaid date', async () => {
    const user = await createTestUser();

    const created = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 500, dueDate: relativeDate(-3) });

    const first = await api()
      .patch(`/api/loans/${created.body.loan.id}/repay`)
      .set(auth(user.token))
      .send({});

    const second = await api()
      .patch(`/api/loans/${created.body.loan.id}/repay`)
      .set(auth(user.token))
      .send({});

    expect(second.status).toBe(200);
    expect(second.body.loan.repaidAt).toBe(first.body.loan.repaidAt);
  });

  it('returns 404 when the loan belongs to someone else', async () => {
    const alice = await createTestUser('9000000001');
    const bob = await createTestUser('9000000002');

    const created = await api()
      .post('/api/loans')
      .set(auth(alice.token))
      .send({ friendName: 'Amit', amount: 500, dueDate: relativeDate(-3) });

    const res = await api()
      .patch(`/api/loans/${created.body.loan.id}/repay`)
      .set(auth(bob.token))
      .send({});

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/loans/:id/unrepay', () => {
  it('re-opens a repaid loan', async () => {
    const user = await createTestUser();

    const created = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 500, dueDate: relativeDate(-3) });

    await api()
      .patch(`/api/loans/${created.body.loan.id}/repay`)
      .set(auth(user.token))
      .send({});

    const res = await api()
      .patch(`/api/loans/${created.body.loan.id}/unrepay`)
      .set(auth(user.token))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe('pending');
    expect(res.body.loan.repaidAt).toBeNull();
    expect(res.body.loan.isOverdue).toBe(true);
  });
});

describe('DELETE /api/loans/:id', () => {
  it('deletes a loan', async () => {
    const user = await createTestUser();

    const created = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 500, dueDate: relativeDate(3) });

    const del = await api()
      .delete(`/api/loans/${created.body.loan.id}`)
      .set(auth(user.token));

    expect(del.status).toBe(204);

    const list = await api().get('/api/loans').set(auth(user.token));
    expect(list.body.loans).toHaveLength(0);
  });

  it('does not delete another user\'s loan', async () => {
    const alice = await createTestUser('9000000001');
    const bob = await createTestUser('9000000002');

    const created = await api()
      .post('/api/loans')
      .set(auth(alice.token))
      .send({ friendName: 'Amit', amount: 500, dueDate: relativeDate(3) });

    const del = await api()
      .delete(`/api/loans/${created.body.loan.id}`)
      .set(auth(bob.token));

    expect(del.status).toBe(404);
  });
});
