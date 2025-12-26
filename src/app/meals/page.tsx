'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface FoodItem {
  id: string
  name: string
  source: string
  tags: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
}

export default function MealsPage() {
  const router = useRouter()
  const [orderTemplates, setOrderTemplates] = useState<FoodItem[]>([])
  const [catalogItems, setCatalogItems] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      router.push('/onboarding')
      return
    }

    loadMeals()
  }, [])

  const loadMeals = async () => {
    try {
      const response = await fetch('/api/meals')
      if (response.ok) {
        const data = await response.json()
        setOrderTemplates(data.orderTemplates.map((item: any) => ({
          ...item,
          tags: JSON.parse(item.tags || '[]')
        })))
        setCatalogItems(data.catalogItems.map((item: any) => ({
          ...item,
          tags: JSON.parse(item.tags || '[]')
        })))
      }
    } catch (error) {
      console.error('Failed to load meals:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTemplates = orderTemplates.filter(item => {
    if (filter === 'all') return true
    return item.tags.includes(filter)
  })

  const filteredCatalogItems = catalogItems.filter(item => {
    if (filter === 'all') return true
    return item.tags.includes(filter)
  })

  const allTags = Array.from(new Set([
    ...orderTemplates.flatMap(item => item.tags),
    ...catalogItems.flatMap(item => item.tags)
  ]))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Meals & Options</h1>
            <nav className="flex space-x-6">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</a>
              <a href="/reminders" className="text-gray-600 hover:text-gray-900">Reminders</a>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filter Tags */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Category</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-sm ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {allTags.slice(0, 12).map(tag => (
              <button
                key={tag}
                onClick={() => setFilter(tag)}
                className={`px-3 py-1 rounded-full text-sm capitalize ${
                  filter === tag
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tag.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Restaurant Orders */}
        {filteredTemplates.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🍽️ Restaurant Order Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(item => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-blue-600">{item.name}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded capitalize">
                      {item.source}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-center mb-3">
                    <div>
                      <div className="font-medium">{item.calories}</div>
                      <div className="text-gray-500">cal</div>
                    </div>
                    <div>
                      <div className="font-medium">{item.protein}g</div>
                      <div className="text-gray-500">protein</div>
                    </div>
                    <div>
                      <div className="font-medium">{item.carbs}g</div>
                      <div className="text-gray-500">carbs</div>
                    </div>
                    <div>
                      <div className="font-medium">{item.fat}g</div>
                      <div className="text-gray-500">fat</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="w-full bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700">
                    Log This Meal
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Home/Grocery Items */}
        {filteredCatalogItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">🏠 Home & Grocery Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredCatalogItems.map(item => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">{item.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded capitalize ${
                      item.source === 'home'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {item.source}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-center mb-3">
                    <div>
                      <div className="font-medium">{item.calories}</div>
                      <div className="text-gray-500">cal</div>
                    </div>
                    <div>
                      <div className="font-medium">{item.protein}g</div>
                      <div className="text-gray-500">protein</div>
                    </div>
                    <div>
                      <div className="font-medium">{item.carbs}g</div>
                      <div className="text-gray-500">carbs</div>
                    </div>
                    <div>
                      <div className="font-medium">{item.fat}g</div>
                      <div className="text-gray-500">fat</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="w-full bg-gray-600 text-white text-xs py-2 rounded hover:bg-gray-700">
                    Log Item
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredTemplates.length === 0 && filteredCatalogItems.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No meals found</h3>
            <p className="text-gray-500">Try adjusting your filter or check back later.</p>
          </div>
        )}
      </div>
    </div>
  )
}