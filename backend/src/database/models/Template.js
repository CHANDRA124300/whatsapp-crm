export class TemplateModel {
  constructor(db) {
    this.db = db;
  }

  async create(templateData) {
    const {
      name, category, content, variables = [], buttons, tags = [], createdBy,
    } = templateData;
    const query = `
      INSERT INTO templates (name, category, content, variables, buttons, tags, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    return this.db.one(query, [
      name, category, content, variables, JSON.stringify(buttons), tags, createdBy,
    ]);
  }

  async findById(id) {
    return this.db.oneOrNone('SELECT * FROM templates WHERE id = $1', [id]);
  }

  async getAll(limit = 50, offset = 0) {
    return this.db.many(
      'SELECT * FROM templates WHERE is_active = TRUE ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
  }

  async getByCategory(category) {
    return this.db.many(
      'SELECT * FROM templates WHERE category = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [category],
    );
  }

  async update(id, templateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(templateData).forEach((key) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(templateData[key]);
      paramCount += 1;
    });

    values.push(id);
    const query = `
      UPDATE templates
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *;
    `;
    return this.db.one(query, values);
  }

  async delete(id) {
    return this.db.one('DELETE FROM templates WHERE id = $1 RETURNING id', [id]);
  }
}
