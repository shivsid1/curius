// Curius Link Taxonomy
// Main categories with subcategories

export const TAXONOMY = {
  'AI/ML': {
    subcategories: [
      'LLMs & Language Models',
      'Computer Vision',
      'AI Research',
      'AI Tools & APIs',
      'AI Agents',
      'AI Ethics & Safety',
      'AI Hardware',
    ],
  },
  'Tech': {
    subcategories: [
      'Web Development',
      'Mobile Development',
      'DevOps & Infrastructure',
      'Databases',
      'Security',
      'Programming Languages',
      'Open Source',
    ],
  },
  'Startups': {
    subcategories: [
      'Fundraising & VC',
      'Growth & Marketing',
      'Product Management',
      'Hiring & Culture',
      'Strategy',
      'Founder Stories',
    ],
  },
  'Science': {
    subcategories: [
      'Biology & Biotech',
      'Physics',
      'Chemistry',
      'Space & Astronomy',
      'Climate & Environment',
      'Neuroscience',
    ],
  },
  'Finance': {
    subcategories: [
      'Investing',
      'Markets & Trading',
      'Personal Finance',
      'Economics',
      'Crypto & Web3',
    ],
  },
  'Design': {
    subcategories: [
      'UI/UX Design',
      'Visual Design',
      'Design Systems',
      'Typography',
      'Branding',
    ],
  },
  'Writing': {
    subcategories: [
      'Essays & Opinion',
      'Technical Writing',
      'Fiction',
      'Journalism',
      'Newsletters',
    ],
  },
  'Health': {
    subcategories: [
      'Longevity',
      'Fitness',
      'Mental Health',
      'Nutrition',
      'Medicine',
    ],
  },
  'Philosophy': {
    subcategories: [
      'Ethics',
      'Epistemology',
      'Rationality',
      'Politics',
      'History of Ideas',
    ],
  },
  'Education': {
    subcategories: [
      'Online Courses',
      'Learning Methods',
      'Research',
      'Tutorials',
      'Books & Reading',
    ],
  },
  'Media': {
    subcategories: [
      'Podcasts',
      'Videos',
      'News',
      'Music',
      'Games',
    ],
  },
  'Tools': {
    subcategories: [
      'Productivity',
      'Developer Tools',
      'Design Tools',
      'Automation',
      'Communication',
    ],
  },
  'Culture': {
    subcategories: [
      'Art',
      'History',
      'Society',
      'Travel',
      'Food',
    ],
  },
  'Career': {
    subcategories: [
      'Job Hunting',
      'Skill Development',
      'Networking',
      'Remote Work',
      'Leadership',
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
