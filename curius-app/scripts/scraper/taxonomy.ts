// Curius Link Taxonomy - 6 Topics, 31 Subtopics
// Must match frontend taxonomy at lib/utils/taxonomy.ts exactly

export const TAXONOMY = {
  'Technology': {
    subcategories: [
      'AI & Machine Learning',
      'Developer Tools',
      'Software Engineering',
      'DevOps & Infrastructure',
      'Security',
      'Hardware',
    ],
  },
  'Culture': {
    subcategories: [
      'Art & Design',
      'Philosophy & Ideas',
      'Politics & Society',
      'History',
      'Books & Literature',
    ],
  },
  'Science': {
    subcategories: [
      'Biology & Biotech',
      'Physics & Math',
      'Medicine & Health',
      'Research Papers',
      'Climate & Environment',
    ],
  },
  'Business': {
    subcategories: [
      'Startups & Founders',
      'Investing & Finance',
      'Management & Leadership',
      'Marketing & Growth',
      'Economics',
    ],
  },
  'Personal': {
    subcategories: [
      'Life Advice',
      'Career & Skills',
      'Learning & Education',
      'Productivity',
      'Health & Fitness',
    ],
  },
  'Media': {
    subcategories: [
      'Entertainment',
      'Podcasts & Videos',
      'News & Modern Events',
      'Gaming',
      'Sports',
    ],
  },
} as const;

export type MainCategory = keyof typeof TAXONOMY;
export type SubCategory<T extends MainCategory> = typeof TAXONOMY[T]['subcategories'][number];

export function getAllCategories(): string[] {
  return Object.keys(TAXONOMY);
}

export function getSubcategories(mainCategory: MainCategory): readonly string[] {
  return TAXONOMY[mainCategory]?.subcategories || [];
}

export function formatTaxonomyForPrompt(): string {
  return Object.entries(TAXONOMY)
    .map(([main, data]) => `${main}: ${data.subcategories.join(', ')}`)
    .join('\n');
}
