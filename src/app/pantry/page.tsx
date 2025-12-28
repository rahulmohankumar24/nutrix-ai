'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  Plus,
  Camera,
  Sparkles,
  Package,
  Trash2,
  Check,
  X,
  ChefHat,
  Clock,
  ShoppingCart,
  RefreshCw,
  Apple,
  Beef,
  Wheat,
  Milk,
  Cookie,
  Salad,
  Droplet,
  ExternalLink,
  UtensilsCrossed
} from 'lucide-react'

interface PantryItem {
  id: string
  name: string
  category: string
  quantity: string | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  inStock: boolean
  isStaple: boolean
  expiresAt: string | null
}

interface MealSuggestion {
  name: string
  description: string
  prepTime: string
  ingredients: string[]
  instructions: string
  calories: number
  protein: number
  carbs: number
  fat: number
  mealType: string
  difficulty: string
}

interface ReadyToEat {
  name: string
  portion: string
  calories: number
  protein: number
  note?: string
}

const categoryIcons: Record<string, any> = {
  protein: Beef,
  carb: Wheat,
  vegetable: Salad,
  fruit: Apple,
  dairy: Milk,
  snack: Cookie,
  condiment: Droplet,
  beverage: Droplet,
  other: Package
}

const categoryColors: Record<string, string> = {
  protein: 'bg-red-500/10 text-red-600 border-red-500/20',
  carb: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  vegetable: 'bg-green-500/10 text-green-600 border-green-500/20',
  fruit: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  dairy: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  snack: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  condiment: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  beverage: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  other: 'bg-gray-500/10 text-gray-600 border-gray-500/20'
}

export default function PantryPage() {
  const router = useRouter()
  const { user, isLoaded, isSignedIn } = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [items, setItems] = useState<PantryItem[]>([])
  const [groupedItems, setGroupedItems] = useState<Record<string, PantryItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('other')
  const [newItemQuantity, setNewItemQuantity] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [scanningReceipt, setScanningReceipt] = useState(false)
  const [scannedItems, setScannedItems] = useState<any[]>([])
  const [showScannedItems, setShowScannedItems] = useState(false)

  // Meal suggestions state
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([])
  const [readyToEat, setReadyToEat] = useState<ReadyToEat[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)

  // Flip card and logging state
  const [flippedCard, setFlippedCard] = useState<string | null>(null)
  const [loggingId, setLoggingId] = useState<string | null>(null)
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push('/auth/signin')
      return
    }
    if (user?.id) {
      loadPantryItems()
    }
  }, [isLoaded, isSignedIn, user?.id, router])

  const loadPantryItems = async (autoSuggest = true) => {
    if (!user?.id) return
    setLoading(true)
    try {
      const response = await fetch(`/api/pantry?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
        setGroupedItems(data.grouped || {})

        // Auto-generate suggestions if there are items in stock
        if (autoSuggest && data.inStockCount > 0) {
          loadSuggestions()
        }
      }
    } catch (error) {
      console.error('Failed to load pantry:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSuggestions = async () => {
    if (!user?.id) return
    setLoadingSuggestions(true)
    try {
      const response = await fetch('/api/pantry/suggest-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.meals || [])
        setReadyToEat(data.readyToEat || [])
        setAiMessage(data.message || null)
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemName.trim() || !user?.id) return
    setAddingItem(true)
    try {
      const response = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          items: [{
            name: newItemName.trim(),
            category: newItemCategory,
            quantity: newItemQuantity || null
          }]
        })
      })
      if (response.ok) {
        setNewItemName('')
        setNewItemQuantity('')
        setShowAddForm(false)
        loadPantryItems()
      }
    } catch (error) {
      console.error('Failed to add item:', error)
    } finally {
      setAddingItem(false)
    }
  }

  const handleToggleStock = async (item: PantryItem) => {
    if (!user?.id) return
    try {
      await fetch('/api/pantry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          userId: user.id,
          inStock: !item.inStock
        })
      })
      loadPantryItems()
    } catch (error) {
      console.error('Failed to update item:', error)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!user?.id) return
    try {
      await fetch(`/api/pantry?itemId=${itemId}&userId=${user.id}`, {
        method: 'DELETE'
      })
      loadPantryItems()
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanningReceipt(true)
    try {
      // Convert to base64
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]

        const response = await fetch('/api/pantry/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 })
        })

        if (response.ok) {
          const data = await response.json()
          setScannedItems(data.items || [])
          setShowScannedItems(true)
        }
        setScanningReceipt(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Failed to scan receipt:', error)
      setScanningReceipt(false)
    }
  }

  const handleConfirmScannedItems = async () => {
    if (!user?.id || scannedItems.length === 0) return
    setAddingItem(true)
    try {
      const response = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          items: scannedItems
        })
      })
      if (response.ok) {
        setScannedItems([])
        setShowScannedItems(false)
        loadPantryItems()
      }
    } catch (error) {
      console.error('Failed to add scanned items:', error)
    } finally {
      setAddingItem(false)
    }
  }

  const removeScannedItem = (index: number) => {
    setScannedItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleLogMeal = async (
    id: string,
    name: string,
    calories: number,
    protein: number,
    carbs: number,
    fat: number,
    ingredients: string[]
  ) => {
    if (!user?.id) return
    setLoggingId(id)

    try {
      // Save the meal to meal log
      const response = await fetch('/api/save-custom-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          restaurantBrand: 'Home',
          title: name,
          description: `Made from pantry: ${ingredients.join(', ')}`,
          calories,
          protein,
          carbs,
          fat,
          mealType: getMealType()
        })
      })

      if (response.ok) {
        // Mark as logged
        setLoggedIds(prev => new Set([...prev, id]))

        // Reduce inventory for used ingredients
        await reduceInventory(ingredients)

        // Refresh pantry items
        loadPantryItems(false) // Don't auto-suggest again
      }
    } catch (error) {
      console.error('Failed to log meal:', error)
    } finally {
      setLoggingId(null)
    }
  }

  const handleLogSnack = async (
    id: string,
    name: string,
    calories: number,
    protein: number
  ) => {
    if (!user?.id) return
    setLoggingId(id)

    try {
      const response = await fetch('/api/save-custom-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          restaurantBrand: 'Home',
          title: name,
          description: 'Snack from pantry',
          calories,
          protein,
          carbs: 0,
          fat: 0,
          mealType: 'snack'
        })
      })

      if (response.ok) {
        setLoggedIds(prev => new Set([...prev, id]))

        // Find and reduce this item in inventory
        const matchingItem = items.find(item =>
          item.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(item.name.toLowerCase())
        )
        if (matchingItem) {
          await handleToggleStock(matchingItem)
        }

        loadPantryItems(false)
      }
    } catch (error) {
      console.error('Failed to log snack:', error)
    } finally {
      setLoggingId(null)
    }
  }

  const reduceInventory = async (ingredients: string[]) => {
    // For each ingredient used, try to mark it as out of stock
    for (const ingredient of ingredients) {
      const matchingItem = items.find(item =>
        item.name.toLowerCase().includes(ingredient.toLowerCase()) ||
        ingredient.toLowerCase().includes(item.name.toLowerCase())
      )
      if (matchingItem && matchingItem.inStock) {
        await fetch('/api/pantry', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: matchingItem.id,
            userId: user?.id,
            inStock: false
          })
        })
      }
    }
  }

  const getMealType = () => {
    const hour = new Date().getHours()
    if (hour < 11) return 'breakfast'
    if (hour < 16) return 'lunch'
    return 'dinner'
  }

  const getRecipeSearchUrl = (mealName: string) => {
    return `https://www.google.com/search?q=${encodeURIComponent(mealName + ' recipe')}`
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  const inStockItems = items.filter(i => i.inStock)
  const outOfStockItems = items.filter(i => !i.inStock)

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">My Pantry</h1>
            <p className="text-muted-foreground mt-1">
              {inStockItems.length} items in stock
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanningReceipt}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            >
              {scanningReceipt ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">Scan Receipt</span>
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Add Item</span>
            </button>
          </div>
        </div>

        {/* Scanned Items Review Modal */}
        {showScannedItems && scannedItems.length > 0 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Found {scannedItems.length} items
              </h2>
              <div className="space-y-2 mb-6">
                {scannedItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[item.category] || categoryColors.other}`}>
                        {item.category}
                      </span>
                      <span className="text-sm text-foreground">{item.name}</span>
                      {item.quantity && (
                        <span className="text-xs text-muted-foreground">({item.quantity})</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeScannedItem(index)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowScannedItems(false)
                    setScannedItems([])
                  }}
                  className="flex-1 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmScannedItems}
                  disabled={addingItem}
                  className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {addingItem ? 'Adding...' : 'Add All to Pantry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Item Form */}
        {showAddForm && (
          <div className="bg-card rounded-2xl p-5 border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-foreground">Add Item</h2>
              <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name (e.g., Chicken breast, Greek yogurt)"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm"
                >
                  <option value="protein">Protein</option>
                  <option value="carb">Carbs/Grains</option>
                  <option value="vegetable">Vegetables</option>
                  <option value="fruit">Fruit</option>
                  <option value="dairy">Dairy</option>
                  <option value="snack">Snacks</option>
                  <option value="condiment">Condiments</option>
                  <option value="beverage">Beverages</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="text"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(e.target.value)}
                  placeholder="Qty (optional)"
                  className="w-32 px-4 py-2.5 rounded-xl border border-border bg-background text-sm"
                />
              </div>
              <button
                onClick={handleAddItem}
                disabled={!newItemName.trim() || addingItem}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {addingItem ? 'Adding...' : 'Add to Pantry'}
              </button>
            </div>
          </div>
        )}

        {/* AI Meal Suggestions */}
        <div className="bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-transparent rounded-2xl p-5 border border-sky-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
                <ChefHat className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">What Can I Make?</h2>
                <p className="text-xs text-muted-foreground">AI-powered meal ideas from your pantry</p>
              </div>
            </div>
            <button
              onClick={loadSuggestions}
              disabled={loadingSuggestions || inStockItems.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loadingSuggestions ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Get Ideas
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {suggestions.map((meal, index) => {
                const cardId = `meal-${index}`
                const isFlipped = flippedCard === cardId
                const isLogging = loggingId === cardId
                const isLogged = loggedIds.has(cardId)

                return (
                  <div
                    key={index}
                    className="relative h-48 cursor-pointer [perspective:1000px]"
                    onClick={() => !isLogged && setFlippedCard(isFlipped ? null : cardId)}
                  >
                    <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                      {/* Front of card */}
                      <div className="absolute inset-0 bg-card rounded-xl p-4 border border-border/50 [backface-visibility:hidden]">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <UtensilsCrossed className="h-4 w-4 text-sky-500" />
                              <h3 className="font-medium text-foreground">{meal.name}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{meal.description}</p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {meal.prepTime}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <span className="px-2 py-0.5 rounded-full bg-muted text-xs">{meal.calories} cal</span>
                          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{meal.protein}g protein</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-3">Tap to see details</p>
                      </div>

                      {/* Back of card */}
                      <div className="absolute inset-0 bg-card rounded-xl p-4 border border-sky-500/30 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col">
                        <h3 className="font-medium text-foreground text-sm mb-2">{meal.name}</h3>
                        <p className="text-xs text-muted-foreground flex-1 overflow-y-auto">
                          {meal.instructions || meal.description}
                        </p>
                        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                          <a
                            href={getRecipeSearchUrl(meal.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Recipe
                          </a>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLogMeal(cardId, meal.name, meal.calories, meal.protein, meal.carbs, meal.fat, meal.ingredients)
                            }}
                            disabled={isLogging || isLogged}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isLogged
                                ? 'bg-green-500 text-white'
                                : 'bg-primary text-primary-foreground hover:opacity-90'
                            }`}
                          >
                            {isLogging ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : isLogged ? (
                              <><Check className="h-3.5 w-3.5" /> Logged</>
                            ) : (
                              <><Plus className="h-3.5 w-3.5" /> Log Meal</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {readyToEat.length > 0 && (
            <div className="mt-4 pt-4 border-t border-sky-500/20">
              <h3 className="text-sm font-medium text-foreground mb-3">Ready to Eat</h3>
              <div className="grid grid-cols-2 gap-2">
                {readyToEat.map((item, index) => {
                  const cardId = `snack-${index}`
                  const isFlipped = flippedCard === cardId
                  const isLogging = loggingId === cardId
                  const isLogged = loggedIds.has(cardId)

                  return (
                    <div
                      key={index}
                      className="relative h-32 cursor-pointer [perspective:1000px]"
                      onClick={() => !isLogged && setFlippedCard(isFlipped ? null : cardId)}
                    >
                      <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                        {/* Front */}
                        <div className="absolute inset-0 bg-card rounded-lg p-3 border border-border/50 [backface-visibility:hidden]">
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.portion} • {item.calories} cal • {item.protein}g protein
                          </p>
                          {item.note && (
                            <p className="text-xs text-sky-500 mt-1">{item.note}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-2">Tap to log</p>
                        </div>

                        {/* Back */}
                        <div className="absolute inset-0 bg-card rounded-lg p-3 border border-green-500/30 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{item.portion}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLogSnack(cardId, item.name, item.calories, item.protein)
                            }}
                            disabled={isLogging || isLogged}
                            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isLogged
                                ? 'bg-green-500 text-white'
                                : 'bg-primary text-primary-foreground hover:opacity-90'
                            }`}
                          >
                            {isLogging ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : isLogged ? (
                              <><Check className="h-3.5 w-3.5" /> Logged</>
                            ) : (
                              <><Plus className="h-3.5 w-3.5" /> Log Snack</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {aiMessage && (
            <div className="mt-4 pt-4 border-t border-sky-500/20 flex items-start gap-2">
              <ShoppingCart className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">{aiMessage}</p>
            </div>
          )}

          {inStockItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add some items to your pantry to get meal suggestions!
            </p>
          )}
        </div>

        {/* Pantry Items by Category */}
        {Object.entries(groupedItems).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([category, categoryItems]) => {
              const Icon = categoryIcons[category] || Package
              const inStockCategoryItems = categoryItems.filter(i => i.inStock)
              if (inStockCategoryItems.length === 0) return null

              return (
                <div key={category} className="bg-card rounded-2xl p-5 border border-border/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${categoryColors[category] || categoryColors.other}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="font-medium text-foreground capitalize">{category}</h2>
                    <span className="text-xs text-muted-foreground">({inStockCategoryItems.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {inStockCategoryItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggleStock(item)}
                            className="h-5 w-5 rounded border border-border flex items-center justify-center hover:border-primary/50"
                          >
                            <Check className="h-3 w-3 text-primary opacity-0 group-hover:opacity-50" />
                          </button>
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.name}</p>
                            {item.quantity && (
                              <p className="text-xs text-muted-foreground">{item.quantity}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-12 border border-border/50 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-foreground mb-2">Your pantry is empty</h2>
            <p className="text-muted-foreground mb-6">
              Add items manually or scan a grocery receipt to get started
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
              >
                <Camera className="h-4 w-4" />
                <span className="text-sm font-medium">Scan Receipt</span>
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Add Manually</span>
              </button>
            </div>
          </div>
        )}

        {/* Out of Stock Section */}
        {outOfStockItems.length > 0 && (
          <div className="bg-card rounded-2xl p-5 border border-border/50 opacity-60">
            <h2 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Out of Stock ({outOfStockItems.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {outOfStockItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleToggleStock(item)}
                  className="px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  + {item.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
