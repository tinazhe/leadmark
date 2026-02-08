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
      this._count = false;
    }

    select(cols, opts) {
      this._select = cols;
      this._count = Boolean(opts && opts.head);
      return this;
    }

    eq(col, val) {
      this._filters.push([col, val]);
      return this;
    }

    single() {
      return this;
    }

    maybeSingle() {
      return this;
    }

    then(resolve, reject) {
      if (this.table === 'workspace_members' && this._select === 'owner_id, role') {
        return Promise.resolve({ data: { owner_id: 'user-owner', role: 'owner' }, error: null }).then(resolve, reject);
      }
      if (this.table === 'workspace_settings' && this._select === 'company_name') {
        return Promise.resolve({ data: { company_name: 'Yuri Digital' }, error: null }).then(resolve, reject);
      }
      if (this.table === 'workspace_members' && this._count) {
        return Promise.resolve({ count: 1, error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    }
  }

  return {
    from: (table) => new Query(table),
  };
});

describe('GET /api/workspace/me', () => {
  test('returns workspace context for owner', async () => {
    process.env.TEAM_INBOX_ENABLED = 'true';
    const app = require('../app');
    const res = await request(app).get('/api/workspace/me');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      workspaceOwnerId: 'user-owner',
      role: 'owner',
      hasTeamMembers: false,
      teamInboxEnabled: true,
      workspaceCompanyName: 'Yuri Digital',
    });
  });
});
