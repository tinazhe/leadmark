const request = require('supertest');

let mockUserId = 'user-owner';
let mockUserEmail = 'owner@example.com';

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = mockUserId;
  req.userEmail = mockUserEmail;
  next();
});

jest.mock('../config/supabase', () => {
  class Query {
    constructor(table) {
      this.table = table;
      this._select = null;
      this._filters = [];
      this._upsert = null;
    }

    select(cols) {
      this._select = cols;
      return this;
    }

    eq(col, val) {
      this._filters.push([col, val]);
      return this;
    }

    upsert(values) {
      this._upsert = values;
      return this;
    }

    single() {
      return this;
    }

    then(resolve, reject) {
      if (this.table === 'workspace_members' && this._select === 'owner_id, role') {
        const filter = this._filters.find(([col]) => col === 'user_id');
        const userId = filter ? filter[1] : 'user-owner';
        const role = userId === 'user-owner' ? 'owner' : 'member';
        return Promise.resolve({ data: { owner_id: 'user-owner', role }, error: null }).then(resolve, reject);
      }
      if (this.table === 'workspace_settings' && this._upsert) {
        const companyName = this._upsert?.[0]?.company_name || null;
        return Promise.resolve({ data: { company_name: companyName }, error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    }
  }

  return {
    from: (table) => new Query(table),
  };
});

describe('PUT /api/workspace/settings', () => {
  test('owner can update workspace settings', async () => {
    process.env.TEAM_INBOX_ENABLED = 'true';
    mockUserId = 'user-owner';
    mockUserEmail = 'owner@example.com';
    const app = require('../app');
    const res = await request(app)
      .put('/api/workspace/settings')
      .send({ workspaceCompanyName: 'Yuri Digital' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ workspaceCompanyName: 'Yuri Digital' });
  });

  test('member cannot update workspace settings', async () => {
    process.env.TEAM_INBOX_ENABLED = 'true';
    mockUserId = 'user-member';
    mockUserEmail = 'member@example.com';
    const app = require('../app');
    const res = await request(app)
      .put('/api/workspace/settings')
      .send({ workspaceCompanyName: 'Not allowed' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Only owners can update workspace settings' });
  });
});
