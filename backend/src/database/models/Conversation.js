export class ConversationModel {
  constructor(db) {
    this.db = db;
  }

  async create(conversationData) {
    const { customerId, assignedTo = null } = conversationData;
    const query = `
      INSERT INTO conversations (customer_id, assigned_to)
      VALUES ($1, $2)
      RETURNING *;
    `;
    return this.db.one(query, [customerId, assignedTo]);
  }

  async findById(id) {
    return this.db.oneOrNone('SELECT * FROM conversations WHERE id = $1', [id]);
  }

  async findByCustomerId(customerId) {
    return this.db.one(
      'SELECT * FROM conversations WHERE customer_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [customerId],
    );
  }

  async update(id, conversationData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(conversationData).forEach((key) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(conversationData[key]);
      paramCount += 1;
    });

    values.push(id);
    const query = `
      UPDATE conversations
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *;
    `;
    return this.db.one(query, values);
  }

  async assignTo(id, userId) {
    return this.db.one(
      'UPDATE conversations SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [userId, id],
    );
  }

  async getAll(limit = 50, offset = 0, filters = {}) {
    let query = 'SELECT * FROM conversations WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount += 1;
    }

    if (filters.assignedTo) {
      query += ` AND assigned_to = $${paramCount}`;
      params.push(filters.assignedTo);
      paramCount += 1;
    }

    query += ` ORDER BY updated_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    return this.db.many(query, params);
  }

  async markAsRead(id) {
    return this.db.one(
      'UPDATE conversations SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id],
    );
  }

  async markAsUnread(id) {
    return this.db.one(
      'UPDATE conversations SET is_read = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id],
    );
  }
}
