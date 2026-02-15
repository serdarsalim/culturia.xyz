export interface Country {
  code: string; // ISO 3166-1 alpha-3 (e.g., "PSE" for Palestine)
  name: string;
  flag: string;
  languages: string[];
}

export type VideoCategory = 'inspiration' | 'music' | 'comedy' | 'daily_life' | 'talks';

export interface VideoSubmission {
  id: string;
  country_code: string;
  category: VideoCategory;
  youtube_url: string;
  youtube_video_id: string;
  title?: string;
  status: 'private' | 'pending' | 'approved' | 'rejected';
  was_approved?: boolean;
  user_id: string;
  user_email: string;
  flagged: boolean;
  flag_count: number;
  flag_reasons: string[];
  created_at: string;
  updated_at: string;
}

export interface VideoFlag {
  id: string;
  submission_id: string;
  user_id: string;
  reason: 'broken' | 'wrong_category' | 'inappropriate' | 'other';
  note?: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  created_at: string;
}

export interface VideoComment {
  id: string;
  user_id: string;
  video_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_display?: string; // Display name from user_profiles
}

// Legacy type alias for backwards compatibility during migration
export type CountryComment = VideoComment;

export interface CountryEntry {
  id: string;
  user_id: string;
  country_code: string;
  content: string;
  pros: string[];
  cons: string[];
  been_there: boolean;
  lived_there: boolean;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<VideoCategory, string> = {
  inspiration: 'Inspiration',
  music: 'Music',
  comedy: 'Comedy',
  daily_life: 'Daily Life',
  talks: 'Talks',
};

// Only expose the public-facing categories in UI components
export const VISIBLE_CATEGORIES: VideoCategory[] = ['music', 'comedy', 'daily_life', 'talks'];

export const FLAG_REASONS = [
  { value: 'broken', label: 'Video is broken or unavailable' },
  { value: 'wrong_category', label: 'Wrong category' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Other issue' },
] as const;
