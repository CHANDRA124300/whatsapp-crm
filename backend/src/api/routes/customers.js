import { Router } from 'express';
import { CustomerModel } from '../database/models/Customer.js';
import db from '../database/connection.js';
import logger from '../utils/logger.js';

const router = Router();
const customerModel = new CustomerModel(db);

// Get all customers
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const customers = await customerModel.getAll(limit, offset);

    res.json({ success: true, data: customers, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single customer
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await customerModel.findById(id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    logger.error('Error fetching customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create customer
router.post('/', async (req, res) => {
  try {
    const { phone, name, email, source } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    const customer = await customerModel.create({
      phone,
      name,
      email,
      source,
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    logger.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCustomer = await customerModel.update(id, req.body);

    res.json({ success: true, data: updatedCustomer });
  } catch (error) {
    logger.error('Error updating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await customerModel.delete(id);

    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    logger.error('Error deleting customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search customers
router.get('/search/query', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const customers = await customerModel.search(q);

    res.json({ success: true, data: customers });
  } catch (error) {
    logger.error('Error searching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add tag to customer
router.post('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;

    if (!tag) {
      return res.status(400).json({ success: false, error: 'Tag required' });
    }

    const updated = await customerModel.addTag(id, tag);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error adding tag:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove tag from customer
router.delete('/:id/tags/:tag', async (req, res) => {
  try {
    const { id, tag } = req.params;
    const updated = await customerModel.removeTag(id, tag);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error removing tag:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Block customer
router.post('/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await customerModel.blockCustomer(id);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error blocking customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unblock customer
router.post('/:id/unblock', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await customerModel.unblockCustomer(id);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error unblocking customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
