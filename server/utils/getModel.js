const userSchema = require('../models/User');
const accountSchema = require('../models/Account');
const auditLogSchema = require('../models/AuditLog');
const journalEntrySchema = require('../models/JournalEntry');
const customerSchema = require('../models/Customer');
const vendorSchema = require('../models/Vendor');
const invoiceSchema = require('../models/Invoice');
const billSchema = require('../models/Bill');
const paymentSchema = require('../models/Payment');
const noteSchema = require('../models/Note');
const todoSchema = require('../models/ToDo');
const fixedAssetSchema = require('../models/FixedAsset');
const employeeSchema = require('../models/Employee');
const payrollRunSchema = require('../models/PayrollRun');
const bankAccountSchema = require('../models/BankAccount');
const budgetSchema = require('../models/Budget');
const inventoryItemSchema = require('../models/InventoryItem');
const apiKeySchema = require('../models/ApiKey');
const notificationSchema = require('../models/Notification');


const schemas = {
  User: userSchema, Account: accountSchema, AuditLog: auditLogSchema,
  JournalEntry: journalEntrySchema, Customer: customerSchema, Vendor: vendorSchema,
  Invoice: invoiceSchema, Bill: billSchema, Payment: paymentSchema,
  Note: noteSchema, ToDo: todoSchema, FixedAsset: fixedAssetSchema,
  Employee: employeeSchema, PayrollRun: payrollRunSchema,
  BankAccount: bankAccountSchema, Budget: budgetSchema,
  InventoryItem: inventoryItemSchema,
  ApiKey: apiKeySchema,
  Notification: notificationSchema,
};

function getModel(tenantDb, modelName, schema) {
  if (tenantDb.models[modelName]) return tenantDb.models[modelName];
  const modelSchema = schema || schemas[modelName];
  if (!modelSchema) throw new Error(`No schema for model: ${modelName}`);
  return tenantDb.model(modelName, modelSchema);
}

/**
 * Register every known schema on a tenant connection.
 *
 * Mongoose resolves .populate() targets against models registered on the SAME
 * connection. Registering only the queried model (e.g. Invoice) leaves populate
 * targets like Customer unregistered, which throws MissingSchemaError and
 * surfaces as a 500 — intermittently, since it only works if some earlier
 * request happened to register that model on this connection first.
 * Called once per connection at creation.
 */
function registerAllModels(tenantDb) {
  Object.keys(schemas).forEach((name) => {
    if (!tenantDb.models[name]) tenantDb.model(name, schemas[name]);
  });
  return tenantDb;
}

function registerSchema(n, s) { schemas[n] = s; }
module.exports = { getModel, registerSchema, registerAllModels };