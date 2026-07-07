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


const schemas = {
  User: userSchema, Account: accountSchema, AuditLog: auditLogSchema,
  JournalEntry: journalEntrySchema, Customer: customerSchema, Vendor: vendorSchema,
  Invoice: invoiceSchema, Bill: billSchema, Payment: paymentSchema,
  Note: noteSchema, ToDo: todoSchema, FixedAsset: fixedAssetSchema,
  Employee: employeeSchema, PayrollRun: payrollRunSchema,
  BankAccount: bankAccountSchema, Budget: budgetSchema,
  InventoryItem: inventoryItemSchema,
  ApiKey: apiKeySchema,
};

function getModel(tenantDb, modelName, schema) {
  if (tenantDb.models[modelName]) return tenantDb.models[modelName];
  const modelSchema = schema || schemas[modelName];
  if (!modelSchema) throw new Error(`No schema for model: ${modelName}`);
  return tenantDb.model(modelName, modelSchema);
}

function registerSchema(n, s) { schemas[n] = s; }
module.exports = { getModel, registerSchema };