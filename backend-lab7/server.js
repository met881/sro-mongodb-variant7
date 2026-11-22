import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { Stock, Supplier } from './models.js'
import { dbName, stockStats } from './database.js'

const app = express()
const port = Number(process.env.PORT || 3001)

const actions = ['receipt', 'issue']
const sorts = { quantity_asc: 1, quantity_desc: -1 }

app.use(cors())
app.use(express.json())

function isObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function validQuantity(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum
}

// Просмотр и поиск товаров
app.get('/api/items', async (req, res) => {
  const { minQuantity, supplier, action, search, sort, limit } = req.query

  if ([minQuantity, supplier, action, search, sort, limit].some(
    value => value !== undefined && !hasText(value),
  )) {
    return res.status(400).json({
      error: 'Каждый параметр должен иметь одно непустое значение.',
    })
  }

  if (minQuantity !== undefined && !validQuantity(Number(minQuantity))) {
    return res.status(400).json({
      error: 'minQuantity должен быть целым числом от 0.',
    })
  }

  if (
    limit !== undefined
    && (!validQuantity(Number(limit), 1) || Number(limit) > 2147483647)
  ) {
    return res.status(400).json({
      error: 'limit должен быть положительным целым числом до 2147483647.',
    })
  }

  if (
    (action && !actions.includes(action))
    || (sort && !Object.hasOwn(sorts, sort))
  ) {
    return res.status(400).json({
      error: 'Недопустимое значение action или sort.',
    })
  }

  const filter = {}

  if (minQuantity !== undefined) {
    filter.quantity = { $gte: Number(minQuantity) }
  }

  if (supplier) {
    filter.supplierId = supplier
  }

  if (action) {
    filter['history.action'] = action
  }

  if (search) {
    filter.name = {
      $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      $options: 'i',
    }
  }

  let query = Stock.find(filter)

  if (sort) {
    query = query.sort({ quantity: sorts[sort], _id: 1 })
  }

  if (limit !== undefined) {
    query = query.limit(Number(limit))
  }

  res.json(await query.lean())
})

// Статистика по поставщикам
app.get('/api/items/stats', async (_req, res) => {
  res.json(await Stock.aggregate(stockStats))
})

// Список поставщиков
app.get('/api/suppliers', async (_req, res) => {
  res.json(await Supplier.find().sort({ name: 1 }).lean())
})

// Добавление товара
app.post('/api/items', async (req, res) => {
  const {
    name,
    quantity,
    supplierId,
    location,
    history = [],
  } = req.body ?? {}

  if (
    !hasText(name)
    || !validQuantity(quantity)
    || !hasText(supplierId)
    || !isObject(location)
    || !hasText(location.zone)
    || !validQuantity(location.rack, 1)
    || !hasText(location.bin)
    || !Array.isArray(history)
  ) {
    return res.status(400).json({
      error: 'Укажите name, quantity, supplierId и location с полями zone, rack, bin. history должен быть массивом.',
    })
  }

  const movements = []

  for (const entry of history) {
    if (
      !isObject(entry)
      || !actions.includes(entry.action)
      || !validQuantity(entry.quantity, 1)
      || !hasText(entry.at)
      || !Number.isFinite(Date.parse(entry.at))
    ) {
      return res.status(400).json({
        error: 'Для операции укажите action (receipt или issue), положительное целое quantity и дату at.',
      })
    }

    movements.push({
      action: entry.action,
      quantity: entry.quantity,
      at: new Date(entry.at),
    })
  }

  const supplier = await Supplier.findById(supplierId.trim())

  if (!supplier) {
    return res.status(400).json({
      error: 'Поставщик с таким supplierId не найден.',
    })
  }

  const document = {
    name: name.trim(),
    quantity,
    supplierId: supplierId.trim(),
    location: {
      zone: location.zone.trim(),
      rack: location.rack,
      bin: location.bin.trim(),
    },
    history: movements,
  }

  const created = await Stock.create(document)

  res.status(201).json(created)
})
// Изменение названия и остатка товара
app.patch('/api/items/:id', async (req, res) => {
  const { id } = req.params

  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({ error: 'Некорректный ID товара.' })
  }

  if (!isObject(req.body)) {
    return res.status(400).json({ error: 'Передайте объект JSON.' })
  }

  const fields = Object.keys(req.body)

  if (
    fields.length === 0
    || fields.some(field => !['name', 'quantity'].includes(field))
  ) {
    return res.status(400).json({
      error: 'Можно изменить только name и quantity. Укажите хотя бы одно поле.',
    })
  }

  const changes = {}

  if (Object.hasOwn(req.body, 'name')) {
    if (!hasText(req.body.name)) {
      return res.status(400).json({
        error: 'Название должно быть непустой строкой.',
      })
    }

    changes.name = req.body.name.trim()
  }

  if (Object.hasOwn(req.body, 'quantity')) {
    if (!validQuantity(req.body.quantity)) {
      return res.status(400).json({
        error: 'Остаток должен быть целым числом от 0.',
      })
    }

    changes.quantity = req.body.quantity
  }

  const item = await Stock.findByIdAndUpdate(
    id,
    { $set: changes },
    { new: true, runValidators: true },
  )

  if (!item) {
    return res.status(404).json({ error: 'Товар не найден.' })
  }

  res.json(item)
})

// Удаление товара
app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params

  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({ error: 'Некорректный ID товара.' })
  }

  const item = await Stock.findByIdAndDelete(id)

  if (!item) {
    return res.status(404).json({ error: 'Товар не найден.' })
  }

  res.json({
    message: 'Товар удалён.',
    item,
  })
})
// Обработка ошибок
app.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Тело запроса должно быть корректным JSON.',
    })
  }

  if (
    error instanceof mongoose.Error.ValidationError
    || error instanceof mongoose.Error.CastError
  ) {
    return res.status(400).json({
      error: error.message,
    })
  }

  console.error(error)

  res.status(500).json({
    error: 'Ошибка при обработке запроса.',
  })
})

// Подключение к MongoDB через Mongoose и запуск сервера
try {
  await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
    {
      dbName,
      serverSelectionTimeoutMS: 5000,
    },
  )

  const server = app.listen(port, () => {
    console.log(`Mongoose: ${dbName} | API: http://localhost:${port}`)
  })

  server.on('error', async error => {
    console.error(error.message)
    await mongoose.disconnect()
    process.exitCode = 1
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => {
        await mongoose.disconnect()
      })
    })
  }
} catch (error) {
  console.error(error.message)
  await mongoose.disconnect()
  process.exitCode = 1
}