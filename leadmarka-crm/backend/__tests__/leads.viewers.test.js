const request = require('supertest');

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = 'user-owner';
  req.userEmail = 'owner@example.com';
  next();
});

jest.mock('../config/supabase', () => {
  class Query {
    constructor(table) {
      this.table = table;
      this._select = null;
      this._filters = [];
      this._upsert = null;
      this._delete = false;
    }

    select(cols) {
      this._select = cols;
      return this;
    }

    eq(col, val) {
      this._filters.push([col, val]);
      return this;
    }

    lt(col, val) {
      this._filters.push([`${col}:lt`, val]);
      return this;
    }

    order() {
      return this;
    }

    upsert(values) {
      this._upsert = values;
      return this;
    }

    delete() {
      this._delete = true;
      return this;
    }

    single() {
      return this;
    }

    then(resolve, reject) {
      if (this.table === 'workspace_members' && this._select === 'owner_id, role') {
        return Promise.resolve({ data: { owner_id: 'user-owner', role: 'owner' }, error: null }).then(resolve, reject);
      }

      if (this.table === 'leads' && this._select === 'id') {
        return Promise.resolve({ data: { id: 'lead-1', user_id: 'user-owner' }, error: null }).then(resolve, reject);
      }

      if (this.table === 'profiles' && this._select === 'full_name') {
        return Promise.resolve({ data: { full_name: 'Alex Agent' }, error: null }).then(resolve, reject);
      }

      if (this.table === 'lead_viewers' && this._upsert) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }

      if (this.table === 'lead_viewers' && this._delete) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }

      if (this.table === 'lead_viewers' && this._select) {
        return Promise.resolve({
          data: [
            {
              user_id: 'user-owner',
              viewer_full_name: 'Alex Agent',
              last_seen_at: '2026-02-06T00:00:00.000Z',
            },
            {
              user_id: 'user-two',
              viewer_full_name: 'Bree Member',
              last_seen_at: '2026-02-06T00:00:10.000Z',
            },
          ],
          error: null,
        }).then(resolve, reject);
      }

      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    }
  }

  return {
    from: (table) => new Query(table),
    auth: {
      admin: {
        getUserById: jest.fn().mockResolvedValue({ data: { user: { email: 'owner@example.com' } }, error: null }),
      },
    },
  };
});

describe('Lead viewers API', () => {
  test('POST /api/leads/:id/viewing records heartbeat', async () => {
    const app = require('../app');
    const res = await request(app).post('/api/leads/lead-1/viewing');
    expect(res.status).toBe(204);
  });

  test('GET /api/leads/:id/viewers returns viewers', async () => {
    const app = require('../app');
    const res = await request(app).get('/api/leads/lead-1/viewers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'user-owner', fullName: 'Alex Agent', lastSeenAt: '2026-02-06T00:00:00.000Z' },
      { id: 'user-two', fullName: 'Bree Member', lastSeenAt: '2026-02-06T00:00:10.000Z' },
    ]);
  });
});
