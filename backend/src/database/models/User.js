export class UserModel {
  constructor(db) {
    this.db = db;
  }

  async create(userData) {
    const {
      username, email, passwordHash, phone, role = 'agent',
    } = userData;
    const query = `
      INSERT INTO users (username, email, password_hash, phone, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    return this.db.one(query, [username, email, passwordHash, phone, role]);
  }

  async findById(id) {
    return this.db.oneOrNone('SELECT * FROM users WHERE id = $1', [id]);
  }

  async findByEmail(email) {
    return this.db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
  }

  async findByUsername(username) {
    return this.db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
  }

  async update(id, userData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(userData).forEach((key) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(userData[key]);
      paramCount += 1;
    });

    values.push(id);
    const query = `
      UPDATE users
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *;
    `;
    return this.db.one(query, values);
  }

  async delete(id) {
    return this.db.one('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  }

  async getAll(limit = 50, offset = 0) {
    return this.db.many(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
  }

  async setOnlineStatus(id, isOnline) {
    return this.db.one(
      'UPDATE users SET is_online = $1, last_seen = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [isOnline, id],
    );
  }
}
