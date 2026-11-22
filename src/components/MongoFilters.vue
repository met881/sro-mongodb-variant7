<script setup>
import { computed, onMounted, ref } from 'vue'

const API = import.meta.env.VITE_API_URL || '/api'
const items = ref([])
const stats = ref([])
const suppliers = ref([])
const filters = ref({ search: '', minQuantity: '', supplier: '', action: '', sort: '', limit: '' })
const error = ref('')
const statsError = ref('')
const loading = ref(true)
const supplierNames = computed(() => new Map(suppliers.value.map(({ _id, name }) => [_id, name])))
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeZone: 'Asia/Qyzylorda' })
const actionNames = { receipt: 'Приход', issue: 'Выдача' }

async function request(path) {
  const response = await fetch(`${API}${path}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || 'Не удалось загрузить данные.')
  }
  return response.json()
}

async function load() {
  error.value = ''
  loading.value = true
  try {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters.value)) {
      if (String(value).trim()) params.set(key, value)
    }
    items.value = await request(`/items?${params}`)
  } catch (cause) {
    error.value = cause.message
  } finally {
    loading.value = false
  }
}

async function loadMetadata() {
  try {
    const [newSuppliers, newStats] = await Promise.all([request('/suppliers'), request('/items/stats')])
    suppliers.value = newSuppliers
    stats.value = newStats
  } catch (cause) {
    statsError.value = cause.message
  }
}

onMounted(() => {
  load()
  loadMetadata()
})
</script>

<template>
  <main>
    <header>
      <h1>Складские остатки</h1>
      <p>Практическая работа по MongoDB · Вариант 7</p>
    </header>

    <section aria-labelledby="items-title">
      <h2 id="items-title">Товары на складе</h2>
      <form @submit.prevent="load">
        <label>Название
          <input v-model="filters.search" type="search" placeholder="Например, кабель">
        </label>
        <label>Мин. остаток
          <input v-model="filters.minQuantity" type="number" min="0" step="1" placeholder="Любой">
        </label>
        <label>Поставщик
          <select v-model="filters.supplier">
            <option value="">Все поставщики</option>
            <option v-for="supplier in suppliers" :key="supplier._id" :value="supplier._id">
              {{ supplier.name }}
            </option>
          </select>
        </label>
        <label>Операция в истории
          <select v-model="filters.action">
            <option value="">Все операции</option>
            <option value="receipt">Приход</option>
            <option value="issue">Выдача</option>
          </select>
        </label>
        <label>Сортировка
          <select v-model="filters.sort">
            <option value="">По умолчанию</option>
            <option value="quantity_asc">Остаток ↑</option>
            <option value="quantity_desc">Остаток ↓</option>
          </select>
        </label>
        <label>Лимит
          <input v-model="filters.limit" type="number" min="1" max="2147483647" step="1" placeholder="Все">
        </label>
        <button :disabled="loading">Найти</button>
      </form>

      <p v-if="loading" role="status">Загрузка товаров…</p>
      <p v-else-if="error" class="error" role="alert">{{ error }}</p>
      <p v-else-if="!items.length" role="status">По заданным фильтрам товаров нет.</p>
      <div v-else class="table-wrap">
        <p class="count" role="status">Найдено позиций — {{ items.length }}</p>
        <table>
          <thead>
            <tr><th>Товар</th><th>Остаток, шт.</th><th>Поставщик</th><th>Ячейка</th><th>История</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item._id">
              <th scope="row">{{ item.name }}</th>
              <td>{{ number.format(item.quantity) }}</td>
              <td>{{ supplierNames.get(item.supplierId) || item.supplierId }}</td>
              <td>{{ item.location.bin }}</td>
              <td>
                <details v-if="item.history.length">
                  <summary>Операций — {{ item.history.length }}</summary>
                  <ul>
                    <li v-for="(entry, index) in item.history" :key="index">
                      {{ actionNames[entry.action] }} · {{ entry.quantity }} шт. · {{ date.format(new Date(entry.at)) }}
                    </li>
                  </ul>
                </details>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="stats-title">
      <h2 id="stats-title">Статистика по поставщикам</h2>
      <p v-if="statsError" class="error" role="alert">{{ statsError }}</p>
      <div v-else-if="stats.length" class="table-wrap">
        <table>
          <thead>
            <tr><th>Поставщик</th><th>Средний остаток, шт.</th><th>Всего единиц</th><th>Позиций</th></tr>
          </thead>
          <tbody>
            <tr v-for="stat in stats" :key="stat._id">
              <th scope="row">{{ supplierNames.get(stat._id) || stat._id }}</th>
              <td>{{ number.format(stat.avgQuantity) }}</td>
              <td>{{ number.format(stat.totalQuantity) }}</td>
              <td>{{ stat.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else>Статистика появится после загрузки остатков.</p>
    </section>
  </main>
</template>

<style scoped>
main { max-width: 1140px; margin: 0 auto; padding: 36px 24px; }
header { margin-bottom: 24px; }
h1 { margin: 0; font-size: clamp(1.9rem, 5vw, 2.8rem); line-height: 1.15; }
header p, .count { color: #486157; }
header p { margin: 6px 0 0; }
section { margin-bottom: 16px; padding: 20px; border: 1px solid #d8e3dc; border-radius: 14px; background: #fff; }
h2 { font-size: 1.25rem; margin: 0 0 14px; }
form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 10px 12px; align-items: end; }
label { display: grid; gap: 4px; font-size: .875rem; font-weight: 600; }
input, select, button { min-height: 38px; border-radius: 8px; padding: 5px 10px; }
input, select { width: 100%; min-width: 0; border: 1px solid #aebfb4; background: #fff; color: inherit; }
button { border: 0; background: #246348; color: #fff; font-weight: 650; cursor: pointer; grid-column: 4; }
button:disabled { opacity: .65; cursor: wait; }
.table-wrap { overflow-x: auto; }
.count { font-size: .875rem; margin: 12px 0 5px; }
table { width: 100%; border-collapse: collapse; text-align: left; white-space: nowrap; }
th, td { padding: 8px 10px; border-bottom: 1px solid #e2ebe5; }
thead th { background: #edf4ef; }
summary { cursor: pointer; color: #23664a; }
ul { padding-left: 18px; margin: 5px 0; font-size: .875rem; }
.error { color: #9e2d2d; }
@media (max-width: 730px) {
  main { padding: 22px 12px; }
  section { padding: 14px; }
  form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  button { grid-column: 1 / -1; }
}
</style>
