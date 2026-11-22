import { MongoClient } from 'mongodb'

export const dbName = 'sro_variant7'
export const client = new MongoClient(
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  { serverSelectionTimeoutMS: 5000 },
)

export const stockStats = [
  {
    $group: {
      _id: '$supplierId',
      avgQuantity: { $avg: '$quantity' },
      totalQuantity: { $sum: '$quantity' },
      count: { $sum: 1 },
    },
  },
  { $sort: { avgQuantity: -1, _id: 1 } },
]
