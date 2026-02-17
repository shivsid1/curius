// Curius Link Taxonomy - MECE Structure
// 5 top-level categories, 24 subcategories

export const TAXONOMY = {
  'Tech': {
    icon: '💻',
    description: 'Computing, software, AI, digital infrastructure',
    subcategories: [
      'AI & Machine Learning',
      'Software Engineering',
      'Infrastructure',
      'Hardware',
      'Developer Tools',
    ],
  },
  'Science': {
    icon: '🔬',
    description: 'Natural world, research, medicine',
    subcategories: [
      'Biology & Biotech',
      'Physics & Math',
      'Medicine & Health',
      'Climate & Environment',
      'Space & Astronomy',
    ],
  },
  'Business': {
    icon: '📈',
    description: 'Commerce, startups, finance, economics',
    subcategories: [
      'Startups',
      'Operations',
      'Finance',
      'Economics',
    ],
  },
  'Culture': {
    icon: '🎨',
    description: 'Humanities, arts, philosophy, society',
    subcategories: [
      'Philosophy',
      'Art & Design',
      'History',
      'Writing',
      'Society & Politics',
    ],
  },
  'Life': {
    icon: '🌱',
    description: 'Personal development, health, career, learning',
    subcategories: [
      'Career',
      'Learning',
      'Health',
      'Productivity',
      'Entertainment',
    ],
  },
} as const;

// Mapping from old taxonomy to new (for migration)
export const TAXONOMY_MIGRATION: Record<string, { category: string; subcategory: string }> = {
  // Tech mappings
  'Technology': { category: 'Tech', subcategory: 'Software Engineering' },
  'AI & Machine Learning': { category: 'Tech', subcategory: 'AI & Machine Learning' },
  'LLMs & Language Models': { category: 'Tech', subcategory: 'AI & Machine Learning' },
  'Computer Vision': { category: 'Tech', subcategory: 'AI & Machine Learning' },
  'AI Research': { category: 'Tech', subcategory: 'AI & Machine Learning' },
  'AI Tools & APIs': { category: 'Tech', subcategory: 'AI & Machine Learning' },
  'Developer Tools': { category: 'Tech', subcategory: 'Developer Tools' },
  'Software Engineering': { category: 'Tech', subcategory: 'Software Engineering' },
  'Web Development': { category: 'Tech', subcategory: 'Software Engineering' },
  'Mobile Development': { category: 'Tech', subcategory: 'Software Engineering' },
  'Programming Languages': { category: 'Tech', subcategory: 'Software Engineering' },
  'DevOps & Infrastructure': { category: 'Tech', subcategory: 'Infrastructure' },
  'Databases': { category: 'Tech', subcategory: 'Infrastructure' },
  'Security': { category: 'Tech', subcategory: 'Infrastructure' },
  'Hardware': { category: 'Tech', subcategory: 'Hardware' },

  // Science mappings
  'Biology & Biotech': { category: 'Science', subcategory: 'Biology & Biotech' },
  'Neuroscience': { category: 'Science', subcategory: 'Biology & Biotech' },
  'Physics': { category: 'Science', subcategory: 'Physics & Math' },
  'Physics & Math': { category: 'Science', subcategory: 'Physics & Math' },
  'Math': { category: 'Science', subcategory: 'Physics & Math' },
  'Chemistry': { category: 'Science', subcategory: 'Physics & Math' },
  'Medicine & Health': { category: 'Science', subcategory: 'Medicine & Health' },
  'Medicine': { category: 'Science', subcategory: 'Medicine & Health' },
  'Longevity': { category: 'Science', subcategory: 'Medicine & Health' },
  'Climate & Environment': { category: 'Science', subcategory: 'Climate & Environment' },
  'Space & Astronomy': { category: 'Science', subcategory: 'Space & Astronomy' },
  'Research Papers': { category: 'Science', subcategory: 'Biology & Biotech' },

  // Business mappings
  'Startups & Founders': { category: 'Business', subcategory: 'Startups' },
  'Startups': { category: 'Business', subcategory: 'Startups' },
  'Fundraising & VC': { category: 'Business', subcategory: 'Startups' },
  'Founder Stories': { category: 'Business', subcategory: 'Startups' },
  'Management & Leadership': { category: 'Business', subcategory: 'Operations' },
  'Marketing & Growth': { category: 'Business', subcategory: 'Operations' },
  'Hiring & Culture': { category: 'Business', subcategory: 'Operations' },
  'Investing & Finance': { category: 'Business', subcategory: 'Finance' },
  'Investing': { category: 'Business', subcategory: 'Finance' },
  'Markets & Trading': { category: 'Business', subcategory: 'Finance' },
  'Personal Finance': { category: 'Business', subcategory: 'Finance' },
  'Crypto & Web3': { category: 'Business', subcategory: 'Finance' },
  'Economics': { category: 'Business', subcategory: 'Economics' },

  // Culture mappings
  'Philosophy & Ideas': { category: 'Culture', subcategory: 'Philosophy' },
  'Philosophy': { category: 'Culture', subcategory: 'Philosophy' },
  'Ethics': { category: 'Culture', subcategory: 'Philosophy' },
  'Art & Design': { category: 'Culture', subcategory: 'Art & Design' },
  'Visual Design': { category: 'Culture', subcategory: 'Art & Design' },
  'UI/UX Design': { category: 'Culture', subcategory: 'Art & Design' },
  'Typography': { category: 'Culture', subcategory: 'Art & Design' },
  'History': { category: 'Culture', subcategory: 'History' },
  'Writing': { category: 'Culture', subcategory: 'Writing' },
  'Essays & Opinion': { category: 'Culture', subcategory: 'Writing' },
  'Fiction': { category: 'Culture', subcategory: 'Writing' },
  'Journalism': { category: 'Culture', subcategory: 'Writing' },
  'Books & Literature': { category: 'Culture', subcategory: 'Writing' },
  'Politics & Society': { category: 'Culture', subcategory: 'Society & Politics' },
  'Society': { category: 'Culture', subcategory: 'Society & Politics' },

  // Life mappings
  'Career & Skills': { category: 'Life', subcategory: 'Career' },
  'Career': { category: 'Life', subcategory: 'Career' },
  'Job Hunting': { category: 'Life', subcategory: 'Career' },
  'Remote Work': { category: 'Life', subcategory: 'Career' },
  'Learning & Education': { category: 'Life', subcategory: 'Learning' },
  'Education': { category: 'Life', subcategory: 'Learning' },
  'Online Courses': { category: 'Life', subcategory: 'Learning' },
  'Books & Reading': { category: 'Life', subcategory: 'Learning' },
  'Health & Fitness': { category: 'Life', subcategory: 'Health' },
  'Health': { category: 'Life', subcategory: 'Health' },
  'Fitness': { category: 'Life', subcategory: 'Health' },
  'Mental Health': { category: 'Life', subcategory: 'Health' },
  'Nutrition': { category: 'Life', subcategory: 'Health' },
  'Productivity': { category: 'Life', subcategory: 'Productivity' },
  'Life Advice': { category: 'Life', subcategory: 'Productivity' },
  'Entertainment': { category: 'Life', subcategory: 'Entertainment' },
  'Podcasts & Videos': { category: 'Life', subcategory: 'Entertainment' },
  'Gaming': { category: 'Life', subcategory: 'Entertainment' },
  'Sports': { category: 'Life', subcategory: 'Entertainment' },
  'News & Modern Events': { category: 'Life', subcategory: 'Entertainment' },
};

export type MainCategory = keyof typeof TAXONOMY;
export type SubCategory<T extends MainCategory> = typeof TAXONOMY[T]['subcategories'][number];

export function getAllCategories(): MainCategory[] {
  return Object.keys(TAXONOMY) as MainCategory[];
}

export function getCategoryInfo(category: MainCategory) {
  return TAXONOMY[category];
}

export function getSubcategories(mainCategory: MainCategory): readonly string[] {
  return TAXONOMY[mainCategory]?.subcategories || [];
}

export function formatTaxonomyForPrompt(): string {
  return Object.entries(TAXONOMY)
    .map(([main, data]) => `${main}: ${data.subcategories.join(', ')}`)
    .join('\n');
}

// Get total number of subcategories across all categories
export function getTotalSubcategories(): number {
  return Object.values(TAXONOMY).reduce(
    (sum, cat) => sum + cat.subcategories.length,
    0
  );
}

// Flatten taxonomy into array of { topic, subtopic } pairs
export function getFlatTaxonomy(): Array<{ topic: MainCategory; subtopic: string }> {
  const flat: Array<{ topic: MainCategory; subtopic: string }> = [];
  for (const [topic, data] of Object.entries(TAXONOMY)) {
    for (const subtopic of data.subcategories) {
      flat.push({ topic: topic as MainCategory, subtopic });
    }
  }
  return flat;
}

// Check if a topic/subtopic combination is valid
export function isValidCategory(topic: string, subtopic?: string): boolean {
  if (!(topic in TAXONOMY)) return false;
  if (!subtopic) return true;
  return TAXONOMY[topic as MainCategory].subcategories.includes(subtopic as never);
}

// Migrate old category to new taxonomy
export function migrateCategory(oldCategory: string): { category: string; subcategory: string } | null {
  return TAXONOMY_MIGRATION[oldCategory] || null;
}
