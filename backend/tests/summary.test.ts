import { api, createTestUser, auth, relativeDate } from './helpers';

async function seed(userToken: string) {
  const create = (friendName: string, amount: number, dueInDays: number) =>
    api()
      .post('/api/loans')
      .set(auth(userToken))
      .send({ friendName, amount, dueDate: relativeDate(dueInDays) });

  const overdue = await create('Amit', 1000, -10);
  const overdue2 = await create('Amit', 500, -5);
  const upcoming = await create('Neha', 2000, 10);
  const repaid = await create('Rohit', 3000, -2);

  await api()
    .patch(`/api/loans/${repaid.body.loan.id}/repay`)
    .set(auth(userToken))
    .send({});

  return { overdue, overdue2, upcoming, repaid };
}

describe('GET /api/summary', () => {
  it('returns all zeroes for a user with no loans', async () => {
    const user = await createTestUser();

    const res = await api().get('/api/summary').set(auth(user.token));

    expect(res.status).toBe(200);
    expect(res.body.summary.totalLent).toBe(0);
    expect(res.body.summary.totalRepaid).toBe(0);
    expect(res.body.summary.totalOutstanding).toBe(0);
    expect(res.body.summary.overdueAmount).toBe(0);
    expect(res.body.summary.counts.total).toBe(0);
  });

  it('computes total lent, repaid, outstanding and overdue', async () => {
    const user = await createTestUser();
    await seed(user.token);

    const res = await api().get('/api/summary').set(auth(user.token));
    const s = res.body.summary;

    // Lent: 1000 + 500 + 2000 + 3000 = 6500
    expect(s.totalLent).toBe(6500);
    // Repaid: 3000
    expect(s.totalRepaid).toBe(3000);
    // Outstanding: 6500 - 3000 = 3500
    expect(s.totalOutstanding).toBe(3500);
    // Overdue (still pending and past due): 1000 + 500 = 1500
    expect(s.overdueAmount).toBe(1500);
  });

  it('counts entries by status', async () => {
    const user = await createTestUser();
    await seed(user.token);

    const res = await api().get('/api/summary').set(auth(user.token));
    const counts = res.body.summary.counts;

    expect(counts.total).toBe(4);
    expect(counts.pending).toBe(3);
    expect(counts.repaid).toBe(1);
    expect(counts.overdue).toBe(2);
  });

  it('breaks the totals down per friend', async () => {
    const user = await createTestUser();
    await seed(user.token);

    const res = await api().get('/api/summary').set(auth(user.token));
    const byFriend = res.body.summary.byFriend;

    const amit = byFriend.find((f: { friendName: string }) => f.friendName === 'Amit');
    expect(amit.totalLent).toBe(1500);
    expect(amit.outstanding).toBe(1500);
    expect(amit.overdueAmount).toBe(1500);
    expect(amit.entries).toBe(2);

    const rohit = byFriend.find((f: { friendName: string }) => f.friendName === 'Rohit');
    expect(rohit.totalLent).toBe(3000);
    expect(rohit.totalRepaid).toBe(3000);
    expect(rohit.outstanding).toBe(0);
  });

  it('does not count a repaid loan as overdue even if it was due in the past', async () => {
    const user = await createTestUser();

    const created = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Rohit', amount: 3000, dueDate: relativeDate(-2) });

    await api()
      .patch(`/api/loans/${created.body.loan.id}/repay`)
      .set(auth(user.token))
      .send({});

    const res = await api().get('/api/summary').set(auth(user.token));

    expect(res.body.summary.overdueAmount).toBe(0);
    expect(res.body.summary.counts.overdue).toBe(0);
  });

  it('never mixes two users together', async () => {
    const alice = await createTestUser('9000000001');
    const bob = await createTestUser('9000000002');

    await api()
      .post('/api/loans')
      .set(auth(alice.token))
      .send({ friendName: 'Amit', amount: 1000, dueDate: relativeDate(-5) });

    await api()
      .post('/api/loans')
      .set(auth(bob.token))
      .send({ friendName: 'Neha', amount: 9999, dueDate: relativeDate(-5) });

    const res = await api().get('/api/summary').set(auth(alice.token));

    expect(res.body.summary.totalLent).toBe(1000);
    expect(res.body.summary.counts.total).toBe(1);
  });

  it('stays consistent with the loans list after repaying an entry', async () => {
    const user = await createTestUser();

    const created = await api()
      .post('/api/loans')
      .set(auth(user.token))
      .send({ friendName: 'Amit', amount: 400, dueDate: relativeDate(-5) });

    const before = await api().get('/api/summary').set(auth(user.token));
    expect(before.body.summary.overdueAmount).toBe(400);

    await api()
      .patch(`/api/loans/${created.body.loan.id}/repay`)
      .set(auth(user.token))
      .send({});

    const after = await api().get('/api/summary').set(auth(user.token));
    expect(after.body.summary.overdueAmount).toBe(0);
    expect(after.body.summary.totalRepaid).toBe(400);
    expect(after.body.summary.totalOutstanding).toBe(0);
  });

  it('requires authentication', async () => {
    const res = await api().get('/api/summary');

    expect(res.status).toBe(401);
  });
});
