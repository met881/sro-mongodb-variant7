import { ObjectId } from 'mongodb'
import { client, dbName } from './database.js'

const suppliers = [
  { _id: 'tekhsnab', name: 'ТехСнаб', city: 'Алматы' },
  { _id: 'packline', name: 'ПакЛайн', city: 'Кызылорда' },
  { _id: 'metiz', name: 'МетизСервис', city: 'Астана' },
]

const stock = [
  {
    _id: new ObjectId('674000000000000000000001'),
    name: 'Кабель USB-C',
    quantity: 120,
    supplierId: 'tekhsnab',
    location: { zone: 'A', rack: 2, bin: 'A-02-03' },
    history: [
      { action: 'receipt', quantity: 150, at: new Date('2026-11-10T04:00:00Z') },
      { action: 'issue', quantity: 30, at: new Date('2026-11-12T05:30:00Z') },
    ],
  },
  {
    _id: new ObjectId('674000000000000000000002'),
    name: 'Картонная коробка',
    quantity: 240,
    supplierId: 'packline',
    location: { zone: 'B', rack: 1, bin: 'B-01-02' },
    history: [{ action: 'receipt', quantity: 240, at: new Date('2026-11-11T03:15:00Z') }],
  },
  {
    _id: new ObjectId('674000000000000000000003'),
    name: 'Болты M8',
    quantity: 80,
    supplierId: 'metiz',
    location: { zone: 'C', rack: 3, bin: 'C-03-01' },
    history: [
      { action: 'receipt', quantity: 100, at: new Date('2026-11-08T07:00:00Z') },
      { action: 'issue', quantity: 20, at: new Date('2026-11-13T05:00:00Z') },
    ],
  },
  {
    _id: new ObjectId('674000000000000000000004'),
    name: 'Сетевой адаптер',
    quantity: 40,
    supplierId: 'tekhsnab',
    location: { zone: 'A', rack: 2, bin: 'A-02-04' },
    history: [{ action: 'receipt', quantity: 40, at: new Date('2026-11-14T05:00:00Z') }],
  },
]

try {
  await client.connect()
  const db = client.db(dbName)
  for (const [collection, documents] of [['suppliers', suppliers], ['stock', stock]]) {
    await db.collection(collection).bulkWrite(documents.map(({ _id, ...fields }) => ({
      updateOne: { filter: { _id }, update: { $setOnInsert: fields }, upsert: true },
    })))
  }
  const items = db.collection('stock')
  await items.createIndexes([
    { key: { name: 1 } },
    { key: { quantity: -1 } },
    { key: { supplierId: 1, quantity: -1 } },
    { key: { 'history.action': 1 } },
  ])
  console.log(dbName, {
    stock: await items.countDocuments(),
    suppliers: await db.collection('suppliers').countDocuments(),
    indexes: (await items.indexes()).map(({ name }) => name),
  })
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await client.close()
}
