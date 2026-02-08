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
          email: this._insert.email || null,
          company_name: this._insert.company_name || null,
          source: this._insert.source || null,
          referrer_name: this._insert.referrer_name || null,
          status: this._insert.status || 'new',
          conversation_label: this._insert.conversation_label || null,
          created_at: new Date().toISOString(),
          last_whatsapp_contact_at: null,
        };
        return Promise.resolve({ data: row, error: null }).then(resolve, reject);
      }
      if (this.table === 'leads' && this._updates) {
        const row = {
          id: 'lead-1',
          user_id: 'user-owner',
          assigned_user_id: null,
          name: 'Test Lead',
          phone_number: '+263771234567',
          email: this._updates.email !== undefined ? this._updates.email : 'test@example.com',
          company_name: this._updates.company_name !== undefined ? this._updates.company_name : 'ACME',
          source: this._updates.source !== undefined ? this._updates.source : 'whatsapp',
          referrer_name: this._updates.referrer_name !== undefined ? this._updates.referrer_name : null,
          status: this._updates.status || 'new',
          conversation_label: null,
          updated_at: new Date().toISOString(),
        };
        return Promise.resolve({ data: row, error: null }).then(resolve, reject);
      }
      if (this.table === 'leads' && this._select) {
        return Promise.resolve({
          data: {
            id: 'lead-1',
            user_id: 'user-owner',
            name: 'Test Lead',
            phone_number: '+263771234567',
            email: 'test@example.com',
            company_name: 'ACME',
            source: 'whatsapp',
            referrer_name: null,
            status: 'new',
            conversation_label: null,
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

describe('POST /api/leads - identity and source', () => {
  test('creates lead with email, company, source, referrer', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Jane Doe',
        phoneNumber: '+263771234567',
        email: 'jane@acme.com',
        companyName: 'ACME Ltd',
        source: 'referral',
        referrerName: 'John Smith',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Jane Doe',
      phoneNumber: expect.stringContaining('263'),
      email: 'jane@acme.com',
      companyName: 'ACME Ltd',
      source: 'referral',
      referrerName: 'John Smith',
    });
  });

  test('creates lead with minimal required fields only', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Bob',
        phoneNumber: '+263771234567',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('name', 'Bob');
    expect(res.body).toHaveProperty('phoneNumber');
    expect(res.body.email).toBeNull();
    expect(res.body.companyName).toBeNull();
    expect(res.body.source).toBeNull();
    expect(res.body.referrerName).toBeNull();
  });

  test('rejects invalid email', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Test',
        phoneNumber: '+263771234567',
        email: 'not-an-email',
      });

    expect(res.status).toBe(400);
  });

  test('rejects invalid source', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Test',
        phoneNumber: '+263771234567',
        source: 'invalid_source',
      });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/leads/:id - identity and source', () => {
  test('updates lead with email, company, source, referrer', async () => {
    const app = require('../app');
    const res = await request(app)
      .put('/api/leads/lead-1')
      .send({
        email: 'updated@test.com',
        companyName: 'NewCo',
        source: 'walk_in',
        referrerName: null,
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'updated@test.com',
      companyName: 'NewCo',
      source: 'walk_in',
    });
  });
});
