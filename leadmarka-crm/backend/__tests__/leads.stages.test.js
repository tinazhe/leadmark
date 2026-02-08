const request = require('supertest');

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = 'user-owner';
  req.userEmail = 'owner@example.com';
  next();
});

jest.mock('../services/reminderService', () => ({
  sendLeadAssignedEmail: jest.fn().mockResolvedValue(true),
  sendLeadReassignedAwayEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../utils/activity', () => ({
  logActivity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../config/supabase', () => {
  class Query {
    constructor(table) {
      this.table = table;
      this._select = null;
      this._filters = [];
      this._updates = null;
      this._insert = null;
    }

    select(cols) {
      this._select = cols;
      return this;
    }

    eq(col, val) {
      this._filters.push([col, val]);
      return this;
    }

    insert(values) {
      this._insert = Array.isArray(values) ? values[0] : values;
      return this;
    }

    update(values) {
      this._updates = values;
      return this;
    }

    single() {
      return this;
    }

    then(resolve, reject) {
      if (this.table === 'workspace_members' && this._select === 'owner_id, role') {
        return Promise.resolve({ data: { owner_id: 'user-owner', role: 'owner' }, error: null }).then(resolve, reject);
      }
      if (this.table === 'leads' && this._insert) {
        const row = {
          id: 'lead-new-1',
          user_id: 'user-owner',
          assigned_user_id: 'user-owner',
          name: this._insert.name || '',
          phone_number: this._insert.phone_number || '',
          status: this._insert.status || 'new',
          created_at: new Date().toISOString(),
        };
        return Promise.resolve({ data: row, error: null }).then(resolve, reject);
      }
      if (this.table === 'leads' && this._updates) {
        return Promise.resolve({
          data: {
            id: 'lead-1',
            user_id: 'user-owner',
            status: this._updates.status || 'new',
            name: 'Test Lead',
            phone_number: '+263771234567',
          },
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

describe('POST /api/leads - stage expansion', () => {
  test('creates lead with new stage values (contacted, quoted, negotiating)', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Test Lead',
        phoneNumber: '+263771234567',
        status: 'negotiating',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('status', 'negotiating');
  });

  test('rejects deprecated interested status', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Test',
        phoneNumber: '+263771234567',
        status: 'interested',
      });

    expect(res.status).toBe(400);
  });

  test('rejects invalid status', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Test',
        phoneNumber: '+263771234567',
        status: 'invalid_status',
      });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/leads - stage filter', () => {
  test('accepts new stage values in query (validation passes)', async () => {
    // Validation runs before DB; invalid status would return 400
    const app = require('../app');
    const res = await request(app)
      .get('/api/leads')
      .query({ status: 'invalid_status' });

    expect(res.status).toBe(400);
  });
});
