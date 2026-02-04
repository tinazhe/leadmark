/* eslint-disable global-require */
const request = require('supertest');

// Mock Supabase client BEFORE requiring app/routes
jest.mock('../config/supabase', () => {
  class Query {
    constructor(table) {
      this.table = table;
      this.cols = null;
      this.isCount = false;
      this.filters = [];
      this._range = null;
      this._limit = null;
    }

    select(cols, opts) {
      this.cols = cols;
      this.isCount = Boolean(opts && opts.head);
      return this;
    }

    gte(col, val) {
      this.filters.push(['gte', col, val]);
      return this;
    }

    eq(col, val) {
      this.filters.push(['eq', col, val]);
      return this;
    }

    not(col, op, val) {
      this.filters.push(['not', col, op, val]);
      return this;
    }

    order() {
      return this;
    }

    limit(n) {
      this._limit = n;
      return this;
    }

    range(fromIdx, toIdx) {
      this._range = { fromIdx, toIdx };
      return this;
    }

    _countResult() {
      // Base counts per table
      const base = {
        profiles: 10,
        leads: 25,
        follow_ups: 7,
        notes: 3,
      };

      // Status breakdown for leads
      const statusFilter = this.filters.find((f) => f[0] === 'eq' && f[1] === 'status');
      if (this.table === 'leads' && statusFilter) {
        const status = statusFilter[2];
        const byStatus = { new: 8, interested: 5, 'follow-up': 7, won: 3, lost: 2 };
        return byStatus[status] || 0;
      }

      // Completed/pending follow-ups
      if (this.table === 'follow_ups') {
        const completedFilter = this.filters.find((f) => f[0] === 'eq' && f[1] === 'completed');
        if (completedFilter) return completedFilter[2] === true ? 2 : 5;
      }

      // Feature adoption / not-null filters
      if (this.table === 'profiles') {
        const reminder = this.filters.find((f) => f[0] === 'eq' && f[1] === 'reminder_enabled');
        if (reminder) return 6;
        const summary = this.filters.find((f) => f[0] === 'eq' && f[1] === 'daily_summary_enabled');
        if (summary) return 9;
      }

      if (this.table === 'leads') {
        const notWhatsapp = this.filters.find((f) => f[0] === 'not' && f[1] === 'last_whatsapp_contact_at');
        if (notWhatsapp) return 4;
        const notLabel = this.filters.find((f) => f[0] === 'not' && f[1] === 'conversation_label');
        if (notLabel) return 6;
      }

      return base[this.table] || 0;
    }

    _dataResult() {
      // Time series query: profiles.created_at (limited)
      if (this.table === 'profiles' && this.cols === 'created_at') {
        return [
          { created_at: new Date().toISOString() },
          { created_at: new Date(Date.now() - 86400000).toISOString() },
        ].slice(0, this._limit || 2);
      }

      // Engagement distinct pagination: select user_id with range()
      if (this.cols === 'user_id') {
        const fromIdx = this._range?.fromIdx || 0;
        const pageSize = (this._range?.toIdx ?? 999) - fromIdx + 1;

        if (this.table === 'leads') {
          if (fromIdx === 0) {
            return Array.from({ length: pageSize }, (_, i) => ({ user_id: `u${i}` }));
          }
          return [{ user_id: 'u1001' }];
        }

        return [{ user_id: 'u1' }, { user_id: 'u2' }];
      }

      return [];
    }

    then(resolve, reject) {
      const payload = this.isCount
        ? { count: this._countResult(), error: null }
        : { data: this._dataResult(), error: null };
      return Promise.resolve(payload).then(resolve, reject);
    }
  }

  return {
    from: (table) => new Query(table),
  };
});

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = 'test_admin_key';
    delete process.env.ADMIN_EMAILS;
  });

  test('returns 401 without admin key', async () => {
    const app = require('../app');
    const res = await request(app).get('/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  test('returns 200 with X-Admin-Key', async () => {
    const app = require('../app');
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('X-Admin-Key', 'test_admin_key');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users.total');
    expect(res.body).toHaveProperty('signups.byDayLast30Days');
    expect(Array.isArray(res.body.signups.byDayLast30Days)).toBe(true);
    expect(res.body).toHaveProperty('leads.byStatus');
  });

  test('returns 200 with Authorization Bearer admin key', async () => {
    const app = require('../app');
    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', 'Bearer test_admin_key');

    expect(res.status).toBe(200);
  });
});

