export class MessageModel {
  constructor(db) {
    this.db = db;
  }

  async create(messageData) {
    const {
      conversationId, senderId, senderType = 'agent', messageType = 'text',
      content, mediaUrl, status = 'sent', templateId, buttons,
    } = messageData;
    const query = `
      INSERT INTO messages (
        conversation_id, sender_id, sender_type, message_type,
        content, media_url, status, template_id, buttons
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    return this.db.one(query, [
      conversationId, senderId, senderType, messageType,
      content, mediaUrl, status, templateId, JSON.stringify(buttons),
    ]);
  }

  async findById(id) {
    return this.db.oneOrNone('SELECT * FROM messages WHERE id = $1', [id]);
  }

  async getByConversation(conversationId, limit = 50, offset = 0) {
    return this.db.many(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3',
      [conversationId, limit, offset],
    );
  }

  async update(id, messageData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(messageData).forEach((key) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(messageData[key]);
      paramCount += 1;
    });

    values.push(id);
    const query = `
      UPDATE messages
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *;
    `;
    return this.db.one(query, values);
  }

  async markAsRead(id) {
    return this.db.one(
      'UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id],
    );
  }

  async markAsDelivered(id) {
    return this.db.one(
      'UPDATE messages SET status = \'delivered\', delivered_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id],
    );
  }

  async delete(id) {
    return this.db.one('DELETE FROM messages WHERE id = $1 RETURNING id', [id]);
  }
}
