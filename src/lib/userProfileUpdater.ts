import { supabase } from './supabase'

export class UserProfileUpdater {
  static async updateUserProfile(userId: string, message: string) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!profile) return

    const updates: any = {
      total_messages: (profile.total_messages || 0) + 1,
      last_chat_at: new Date().toISOString()
    }

    if (updates.total_messages > 20) {
      updates.personality_type = '老朋友'
    } else if (updates.total_messages > 10) {
      updates.personality_type = '熟悉的朋友'
    } else if (updates.total_messages > 5) {
      updates.personality_type = '认识的朋友'
    }

    const preferences = new Set(profile.preferences || [])
    if (message.includes('焦虑') || message.includes('紧张')) {
      preferences.add('焦虑支持')
    }
    if (message.includes('压力') || message.includes('工作')) {
      preferences.add('工作压力')
    }
    if (message.includes('情感') || message.includes('关系')) {
      preferences.add('情感支持')
    }

    updates.preferences = Array.from(preferences)

    await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', userId)
  }
}
