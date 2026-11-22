import mongoose from 'mongoose'

const { Schema } = mongoose

const locationSchema = new Schema({
  zone: { type: String, required: true, trim: true },
  rack: {
    type: Number,
    required: true,
    min: 1,
    validate: Number.isSafeInteger,
  },
  bin: { type: String, required: true, trim: true },
}, { _id: false })

const movementSchema = new Schema({
  action: {
    type: String,
    required: true,
    enum: ['receipt', 'issue'],
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    validate: Number.isSafeInteger,
  },
  at: { type: Date, required: true },
}, { _id: false })

const supplierSchema = new Schema({
  _id: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  city: { type: String, trim: true },
}, { versionKey: false })

const stockSchema = new Schema({
  name: { type: String, required: true, trim: true },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    validate: Number.isSafeInteger,
  },
  supplierId: {
    type: String,
    required: true,
    trim: true,
    ref: 'Supplier',
  },
  location: { type: locationSchema, required: true },
  history: { type: [movementSchema], default: [] },
}, { versionKey: false })

export const Supplier = mongoose.model(
  'Supplier', supplierSchema, 'suppliers',
)

export const Stock = mongoose.model(
  'Stock', stockSchema, 'stock',
)