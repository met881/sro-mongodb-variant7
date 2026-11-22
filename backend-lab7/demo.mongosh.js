const lab = db.getSiblingDB('lab7_variant7');
const stock = lab.stock;

print('Коллекции и количество документов');
printjson({ collections: lab.getCollectionNames().sort(), stock: stock.countDocuments(), suppliers: lab.suppliers.countDocuments() });

print('Вложенность и поиск в массиве');
printjson(stock.find({ 'location.zone': 'A' }).toArray());
printjson(stock.find({ 'location.rack': { $gte: 2 } }, { name: 1, location: 1, _id: 0 }).toArray());
printjson(stock.find({ 'history.action': 'issue' }, { name: 1, _id: 0 }).toArray());
printjson(stock.find({ history: { $elemMatch: { action: 'receipt', quantity: { $gte: 150 } } } }, { name: 1, _id: 0 }).toArray());

print('db.stock.getIndexes()');
printjson(stock.getIndexes());

print('explain executionStats для поиска по имени');
const plan = stock.find({ name: 'Кабель USB-C' }).explain('executionStats');
printjson(plan.queryPlanner.winningPlan.queryPlan ?? plan.queryPlanner.winningPlan);
printjson({
  nReturned: plan.executionStats.nReturned,
  totalKeysExamined: plan.executionStats.totalKeysExamined,
  totalDocsExamined: plan.executionStats.totalDocsExamined,
});

print('Фильтры, сортировка и проекция');
printjson(stock.find({ quantity: { $gt: 100 } }, { name: 1, quantity: 1, _id: 0 }).toArray());
printjson(stock.find({ supplierId: { $in: ['tekhsnab', 'metiz'] } }, { name: 1, supplierId: 1, _id: 0 }).toArray());
printjson(stock.find({ name: /кабель/i }, { name: 1, _id: 0 }).toArray());
printjson(stock.find({ supplierId: 'tekhsnab', quantity: { $gt: 50, $lt: 200 } }, { name: 1, quantity: 1, _id: 0 }).toArray());
printjson(stock.find({}, { name: 1, quantity: 1, _id: 0 }).sort({ quantity: -1 }).limit(2).toArray());
printjson(stock.find({}, { name: 1, quantity: 1, _id: 0 }).toArray());

print('Агрегация по поставщикам');
printjson(stock.aggregate([
  { $group: { _id: '$supplierId', avgQuantity: { $avg: '$quantity' }, totalQuantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
  { $sort: { avgQuantity: -1, _id: 1 } },
]).toArray());
