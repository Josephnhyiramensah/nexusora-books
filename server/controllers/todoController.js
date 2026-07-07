const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getTodos = async (req, res) => {
  try {
    const ToDo = getModel(req.tenantDb, 'ToDo');
    const { status, priority, type } = req.query;
    const filter = {};

    // Users see their own + assigned to them
    filter.$or = [
      { createdBy: req.user._id },
      { assignedTo: req.user._id },
    ];

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (type) filter.type = type;

    const todos = await ToDo.find(filter)
      .populate('assignedTo', 'firstName lastName')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort({ priority: 1, dueDate: 1, createdAt: -1 })
      .lean();

    // Custom sort: high first, then medium, then low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    todos.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    res.json({ success: true, data: todos, count: todos.length });
  } catch (error) {
    console.error('[ToDo] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks.' });
  }
};

const getTodo = async (req, res) => {
  try {
    const ToDo = getModel(req.tenantDb, 'ToDo');
    const todo = await ToDo.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName')
      .populate('assignedBy', 'firstName lastName')
      .populate('comments.user', 'firstName lastName');
    if (!todo) return res.status(404).json({ success: false, message: 'Task not found.' });
    res.json({ success: true, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch task.' });
  }
};

const createTodo = async (req, res) => {
  try {
    const ToDo = getModel(req.tenantDb, 'ToDo');
    const { title, description, priority, dueDate, type, assignedTo, cycleType } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title required.' });

    const todo = await ToDo.create({
      title, description, priority: priority || 'medium',
      dueDate, type: type || 'personal',
      assignedTo, assignedBy: assignedTo ? req.user._id : undefined,
      cycleType, createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'todos',
      entityId: todo._id, entityType: 'ToDo',
      description: `Created task: ${title}`,
    }, req);

    res.status(201).json({ success: true, message: 'Task created.', data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create task.' });
  }
};

const updateTodo = async (req, res) => {
  try {
    const ToDo = getModel(req.tenantDb, 'ToDo');
    const todo = await ToDo.findById(req.params.id);
    if (!todo) return res.status(404).json({ success: false, message: 'Task not found.' });

    const fields = ['title', 'description', 'priority', 'status', 'dueDate', 'assignedTo'];
    fields.forEach((f) => { if (req.body[f] !== undefined) todo[f] = req.body[f]; });

    if (req.body.status === 'completed' && todo.status !== 'completed') {
      todo.completedAt = new Date();
    }
    if (req.body.status !== 'completed') {
      todo.completedAt = null;
    }

    await todo.save();
    res.json({ success: true, message: 'Task updated.', data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update task.' });
  }
};

const completeTodo = async (req, res) => {
  try {
    const ToDo = getModel(req.tenantDb, 'ToDo');
    const todo = await ToDo.findById(req.params.id);
    if (!todo) return res.status(404).json({ success: false, message: 'Task not found.' });

    todo.status = todo.status === 'completed' ? 'pending' : 'completed';
    todo.completedAt = todo.status === 'completed' ? new Date() : null;
    await todo.save();

    res.json({ success: true, message: `Task ${todo.status === 'completed' ? 'completed' : 'reopened'}.`, data: todo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to complete task.' });
  }
};

const deleteTodo = async (req, res) => {
  try {
    const ToDo = getModel(req.tenantDb, 'ToDo');
    await ToDo.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete task.' });
  }
};

const addComment = async (req, res) => {
  try {
    const ToDo = getModel(req.tenantDb, 'ToDo');
    const todo = await ToDo.findById(req.params.id);
    if (!todo) return res.status(404).json({ success: false, message: 'Task not found.' });

    todo.comments.push({ user: req.user._id, text: req.body.text });
    await todo.save();

    const updated = await ToDo.findById(todo._id).populate('comments.user', 'firstName lastName');
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add comment.' });
  }
};

module.exports = { getTodos, getTodo, createTodo, updateTodo, completeTodo, deleteTodo, addComment };