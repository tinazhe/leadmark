const request = require('supertest');

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = 'user-member';
  req.userEmail = 'member@example.com';
  next();
});

jest.mock('../config/supabase', () => {
  class Query {
    constructor(table) {
      this.table = table;
      this._select = null;
      this._filters = [];
      this._inFilters = [];
    }

    select(cols) {
      this._select = cols;
      return this;
    }

    eq(col, val) {
      this._filters.push([col, val]);
      return this;
    }

    in(col, vals) {
      this._inFilters.push([col, vals]);
      return this;
    }

    order() {
      return this;
    }

    single() {
      return this;
    }

    _filterValue(col) {
      const match = this._filters.find(([filterCol]) => filterCol === col);
      return match ? match[1] : undefined;
    }

    then(resolve, reject) {
      if (this.table === 'workspace_members' && this._select === 'owner_id, role') {
        return Promise.resolve({
          data: { owner_id: 'user-owner', role: 'member' },
          error: null,
        }).then(resolve, reject);
      }

      if (this.table === 'leads' && this._select === 'id') {
        const leadId = this._filterValue('id');
        const ownerId = this._filterValue('user_id');
        if (leadId === 'lead-workspace' && ownerId === 'user-owner') {
          return Promise.resolve({ data: { id: 'lead-workspace' }, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: null, error: { message: 'Lead not found' } }).then(resolve, reject);
      }

      if (this.table === 'activity_logs' && this._select === '*') {
        return Promise.resolve({
          data: [
            {
              id: 'log-1',
              lead_id: 'lead-workspace',
              user_id: 'user-owner',
              action: 'lead_created',
              metadata: { source: 'test' },
              created_at: '2026-02-05T00:00:00.000Z',
            },
            {
              id: 'log-2',
              lead_id: 'lead-workspace',
              user_id: 'user-member',
              action: 'note_added',
              metadata: {},
              created_at: '2026-02-05T01:00:00.000Z',
            },
          ],
          error: null,
        }).then(resolve, reject);
      }

      if (this.table === 'profiles' && this._select === 'id, full_name, business_name, timezone') {
        const idsFilter = this._inFilters.find(([col]) => col === 'id');
        const ids = idsFilter ? idsFilter[1] : [];
        const profiles = [
          { id: 'user-owner', full_name: 'Owner Name', business_name: 'Owner Co', timezone: 'UTC' },
          { id: 'user-member', full_name: 'Member Name', business_name: 'Member Co', timezone: 'UTC' },
        ].filter((profile) => ids.includes(profile.id));
        return Promise.resolve({ data: profiles, error: null }).then(resolve, reject);
      }

      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    }
  }

  return {
    from: (table) => new Query(table),
  };
});

describe('GET /api/activity/lead/:leadId (workspace member)', () => {
  test('allows workspace members to load activity for workspace leads', async () => {
    const app = require('../app');
    const res = await request(app).get('/api/activity/lead/lead-workspace');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      leadId: 'lead-workspace',
      action: 'lead_created',
      user: { id: 'user-owner', fullName: 'Owner Name', businessName: 'Owner Co' },
    });
    expect(res.body[1]).toMatchObject({
      leadId: 'lead-workspace',
      action: 'note_added',
      user: { id: 'user-member', fullName: 'Member Name', businessName: 'Member Co' },
    });
  });

  test('returns 404 when lead is outside workspace', async () => {
    const app = require('../app');
    const res = await request(app).get('/api/activity/lead/lead-other');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Lead not found' });
  });
});
