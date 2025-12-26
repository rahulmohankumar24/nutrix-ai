/**
 * Utility functions for handling AI responses consistently
 */

export function cleanAIResponse(aiResponse: string): string {
  if (!aiResponse) return ''

  // Remove markdown code blocks
  let cleaned = aiResponse
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .replace(/^```\s*/gi, '')

  // Extract JSON content between first { and last }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleaned = jsonMatch[0]
  }

  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim()

  return cleaned
}

export function parseAIResponse(aiResponse: string): any {
  const cleaned = cleanAIResponse(aiResponse)

  try {
    return JSON.parse(cleaned)
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    console.error('Raw response:', aiResponse)
    console.error('Cleaned response:', cleaned)
    throw new Error(`Invalid JSON response from AI: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}