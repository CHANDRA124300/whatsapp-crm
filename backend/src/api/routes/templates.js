import { Router } from 'express';
import { TemplateModel } from '../database/models/Template.js';
import db from '../database/connection.js';
import logger from '../utils/logger.js';
import { parseVariables } from '../utils/helpers.js';

const router = Router();
const templateModel = new TemplateModel(db);

// Get all templates
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, category } = req.query;

    let templates;
    if (category) {
      templates = await templateModel.getByCategory(category);
    } else {
      templates = await templateModel.getAll(limit, offset);
    }

    res.json({ success: true, data: templates, pagination: { limit, offset } });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single template
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await templateModel.findById(id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error fetching template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create template
router.post('/', async (req, res) => {
  try {
    const { name, category, content, variables, buttons, tags, createdBy } = req.body;

    if (!name || !content) {
      return res.status(400).json({ success: false, error: 'Name and content required' });
    }

    const template = await templateModel.create({
      name,
      category,
      content,
      variables,
      buttons,
      tags,
      createdBy,
    });

    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await templateModel.update(id, req.body);

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await templateModel.delete(id);

    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    logger.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Preview template with variables
router.post('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { variables } = req.body;

    const template = await templateModel.findById(id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const preview = parseVariables(template.content, variables);

    res.json({ success: true, data: { preview } });
  } catch (error) {
    logger.error('Error previewing template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
