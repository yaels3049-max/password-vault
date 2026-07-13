import { tryGetAuthenticatedUserId } from '../auth';
import { isDevBuild } from '../dev/devMode';
import { getSupabaseClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import { formatUnknownError } from '../formatErrorChain';

export interface RegistryCategory {
  id: string;
  display_name: string;
  sort_order: number;
}

let sessionCache: RegistryCategory[] | null = null;

export function clearRegistryCategoryCache(): void {
  sessionCache = null;
}

export async function loadRegistryCategories(): Promise<RegistryCategory[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  if (sessionCache) {
    return sessionCache;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }

  try {
    // Authenticated session required for RLS; never create anonymous users.
    const userId = await tryGetAuthenticatedUserId();
    if (!userId) {
      return [];
    }

    const { data, error } = await supabase
      .from('categories')
      .select('id, display_name, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(formatUnknownError(error));
    }

    sessionCache = (data ?? []) as RegistryCategory[];
    return sessionCache;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[registry] Category catalog load failed:', error);
    }
    return [];
  }
}

/** Category ids for discovery filter chips (registry order; practice dev-only). */
export function discoveryCategoryIds(categories: RegistryCategory[]): string[] {
  return categories
    .filter((category) => isDevBuild() || category.id !== 'practice')
    .map((category) => category.id);
}

export function buildCategoryLabelMap(
  categories: RegistryCategory[],
  staticFallback: Record<string, string>,
): Record<string, string> {
  const labels: Record<string, string> = { ...staticFallback };

  for (const category of categories) {
    labels[category.id] = category.display_name;
  }

  return labels;
}

/** Category section order for Digital Home grouped layout. */
export function homeCategoryOrder(categories: RegistryCategory[]): string[] {
  if (categories.length === 0) {
    return ['practice', 'banking', 'health', 'shopping'];
  }

  return categories.map((category) => category.id);
}

export function resolveCategoryLabel(
  categoryId: string | undefined,
  labels: Record<string, string>,
): string {
  if (!categoryId) {
    return 'ללא קטגוריה';
  }

  return labels[categoryId] ?? categoryId;
}
