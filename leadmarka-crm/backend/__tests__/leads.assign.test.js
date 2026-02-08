const request = require('supertest');

const MEMBER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_MEMBER_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.userId = global.__mockUserId || 'user-owner';
  req.userEmail = global.__mockUserEmail || 'owner@example.com';
  next();
});

jest.mock('../services/reminderService', () => ({
  sendLeadAssignedEmail: jest.fn().mockResolvedValue(true),
  sendLeadReassignedAwayEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../config/supabase', () => {
  class Query {
    constructor(table) {
      this.table = table;
      this._select = null;
      this._filters = [];
      this._updates = null;
    }

    select(cols) {
      this._select = cols;
      return this;
    }

    eq(col, val) {
      this._filters.push([col, val]);
      return this;
    }

    update(values) {
      this._updates = values;
      return this;
    }

    insert() {
      return this;
    }

    order() {
      return this;
    }

    single() {
      return this;
    }

    then(resolve, reject) {
      if (this.table === 'workspace_members' && this._select === 'owner_id, role') {
        const userIdFilter = this._filters.find(([col]) => col === 'user_id');
        const userId = userIdFilter ? userIdFilter[1] : 'user-owner';
        const role = userId === MEMBER_ID ? 'member' : 'owner';
        return Promise.resolve({ data: { owner_id: 'user-owner', role }, error: null }).then(resolve, reject);
      }
      if (this.table === 'workspace_members' && this._select === 'user_id') {
        return Promise.resolve({
          data: [
            { user_id: 'user-owner' },
            { user_id: MEMBER_ID },
            { user_id: OTHER_MEMBER_ID },
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (this.table === 'leads' && this._select && this._select.includes('assigned_user_id')) {
        return Promise.resolve({
          data: {
            id: 'lead-1',
            user_id: 'user-owner',
            assigned_user_id: global.__mockAssignedUserId ?? null,
            name: 'Test Lead',
            phone_number: '+263771234567',
          },
          error: null,
        }).then(resolve, reject);
      }
      if (this.table === 'leads' && this._updates) {
        return Promise.resolve({
          data: {
            id: 'lead-1',
            assigned_user_id: this._updates.assigned_user_id || null,
          },
          error: null,
        }).then(resolve, reject);
      }
      if (this.table === 'follow_ups' && this._updates) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
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

describe('PATCH /api/leads/:id/assign', () => {
  beforeEach(() => {
    global.__mockUserId = 'user-owner';
    global.__mockUserEmail = 'owner@example.com';
    global.__mockAssignedUserId = null;
  });

  test('assigns a lead to a workspace member', async () => {
    process.env.TEAM_INBOX_ENABLED = 'true';
    const app = require('../app');
    const memberId = MEMBER_ID;
    const res = await request(app)
      .patch('/api/leads/lead-1/assign')
      .send({ assignedUserId: memberId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('assignedUserId', memberId);
  });

  test('member can assign unassigned lead to self', async () => {
    process.env.TEAM_INBOX_ENABLED = 'true';
    global.__mockUserId = MEMBER_ID;
    global.__mockUserEmail = 'member@example.com';
    global.__mockAssignedUserId = null;
    const app = require('../app');
    const res = await request(app)
      .patch('/api/leads/lead-1/assign')
      .send({ assignedUserId: MEMBER_ID });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('assignedUserId', MEMBER_ID);
  });

  test('member cannot reassign lead owned by another user', async () => {
    process.env.TEAM_INBOX_ENABLED = 'true';
    global.__mockUserId = MEMBER_ID;
    global.__mockUserEmail = 'member@example.com';
    global.__mockAssignedUserId = OTHER_MEMBER_ID;
    const app = require('../app');
    const res = await request(app)
      .patch('/api/leads/lead-1/assign')
      .send({ assignedUserId: MEMBER_ID });

    expect(res.status).toBe(403);
  });
});
