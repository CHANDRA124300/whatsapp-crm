export class CustomerModel {
  constructor(db) {
    this.db = db;
  }

  async create(customerData) {
    const {
      phone, name, email, status = 'active', source, tags = [], notes,
    } = customerData;
    const query = `
      INSERT INTO customers (phone, name, email, status, source, tags, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (phone) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    return this.db.one(query, [phone, name, email, status, source, tags, notes]);
  }

  async findById(id) {
    return this.db.oneOrNone('SELECT * FROM customers WHERE id = $1', [id]);
  }

  async findByPhone(phone) {
    return this.db.oneOrNone('SELECT * FROM customers WHERE phone = $1', [phone]);
  }

  async update(id, customerData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(customerData).forEach((key) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(customerData[key]);
      paramCount += 1;
    });

    values.push(id);
    const query = `
      UPDATE customers
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *;
    `;
    return this.db.one(query, values);
  }

  async delete(id) {
    return this.db.one('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
  }

  async getAll(limit = 50, offset = 0) {
    return this.db.many(
      'SELECT * FROM customers ORDER BY updated_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
  }

  async search(query) {
    return this.db.many(
      'SELECT * FROM customers WHERE name ILIKE $1 OR phone LIKE $2 LIMIT 50',
      [`%${query}%`, `%${query}%`],
    );
  }

  async addTag(id, tag) {
    return this.db.one(
      'UPDATE customers SET tags = array_append(tags, $1) WHERE id = $2 RETURNING *',
      [tag, id],
    );
  }

  async removeTag(id, tag) {
    return this.db.one(
      'UPDATE customers SET tags = array_remove(tags, $1) WHERE id = $2 RETURNING *',
      [tag, id],
    );
  }

  async blockCustomer(id) {
    return this.db.one(
      'UPDATE customers SET is_blocked = TRUE WHERE id = $1 RETURNING *',
      [id],
    );
  }

  async unblockCustomer(id) {
    return this.db.one(
      'UPDATE customers SET is_blocked = FALSE WHERE id = $1 RETURNING *',
      [id],
    );
  }
}
