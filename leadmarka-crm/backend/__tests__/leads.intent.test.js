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
          product_or_service: this._insert.product_or_service || null,
          variant_specs: this._insert.variant_specs || null,
          budget_range: this._insert.budget_range || null,
          urgency: this._insert.urgency || null,
          status: this._insert.status || 'new',
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
          product_or_service: this._updates.product_or_service !== undefined ? this._updates.product_or_service : 'iPhone 13',
          variant_specs: this._updates.variant_specs !== undefined ? this._updates.variant_specs : '256GB',
          budget_range: this._updates.budget_range !== undefined ? this._updates.budget_range : '$500-$700',
          urgency: this._updates.urgency !== undefined ? this._updates.urgency : 'soon',
          status: this._updates.status || 'new',
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
            product_or_service: 'iPhone 13',
            variant_specs: '256GB',
            budget_range: '$500-$700',
            urgency: 'soon',
            status: 'new',
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

describe('POST /api/leads - intent fields', () => {
  test('creates lead with intent fields', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Jane Doe',
        phoneNumber: '+263771234567',
        productOrService: 'iPhone 13 Pro',
        variantSpecs: '256GB, Space Gray',
        budgetRange: '$500-$800',
        urgency: 'now',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      productOrService: 'iPhone 13 Pro',
      variantSpecs: '256GB, Space Gray',
      budgetRange: '$500-$800',
      urgency: 'now',
    });
  });

  test('rejects invalid urgency', async () => {
    const app = require('../app');
    const res = await request(app)
      .post('/api/leads')
      .send({
        name: 'Jane Doe',
        phoneNumber: '+263771234567',
        urgency: 'later',
      });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/leads/:id - intent fields', () => {
  test('updates lead intent fields', async () => {
    const app = require('../app');
    const res = await request(app)
      .put('/api/leads/lead-1')
      .send({
        productOrService: 'MacBook Air',
        variantSpecs: 'M2, 16GB',
        budgetRange: '$1200-$1500',
        urgency: 'soon',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      productOrService: 'MacBook Air',
      variantSpecs: 'M2, 16GB',
      budgetRange: '$1200-$1500',
      urgency: 'soon',
    });
  });
});
